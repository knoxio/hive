import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { RoomList } from "./components/RoomList";
import { CreateRoomModal } from "./components/CreateRoomModal";
import { DeleteRoomModal } from "./components/DeleteRoomModal";
import { JoinRoomModal } from "./components/JoinRoomModal";
import { RoomSettingsPanel } from "./components/RoomSettingsPanel";
import { ConnectionStatusBar } from "./components/ConnectionStatusBar";
import ChatTimeline from "./components/ChatTimeline";
import { MemberPanel } from "./components/MemberPanel";
import { MessageInput } from "./components/MessageInput";
import { AgentGrid } from "./components/AgentGrid";
import { NotFoundPage } from "./components/ErrorPage";
import { useWebSocket } from "./hooks/useWebSocket";
import { useConnectionStatus } from "./hooks/useConnectionStatus";
import type { RoomMessage } from "./hooks/useWebSocket";
import { useMessageHistory } from "./hooks/useMessageHistory";
import type { Room } from "./components/RoomList";
import type { Member } from "./components/MemberPanel";
import { authHeader, clearToken, getToken, getUserFromToken } from "./lib/auth";
import { apiFetch } from "./lib/apiError";

type Tab = "rooms" | "agents" | "tasks" | "costs";

/** Extract two-char nav initials from the stored JWT. Returns "?" on failure. */
function getNavInitials(): string {
  const user = getUserFromToken();
  const name = user?.username ?? "";
  return name.length > 0 ? name.slice(0, 2).toUpperCase() : "?";
}

const TABS: Tab[] = ["rooms", "agents", "tasks", "costs"];

/** Return the role from the stored JWT, or null if not authenticated. */
function getStoredRole(): string | null {
  return getUserFromToken()?.role ?? null;
}

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";
const WS_BASE = API_BASE.replace(/^http/, "ws");

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // Derive active tab and room ID from URL path
  // e.g. /rooms/my-room → pathTab="rooms", pathRoomId="my-room"
  const pathSegments = location.pathname.split("/");
  const pathTab = pathSegments[1] as Tab;
  const pathRoomId: string | null =
    pathSegments[1] === "rooms" && pathSegments[2] ? pathSegments[2] : null;
  const isRootPath = location.pathname === "/" || location.pathname === "";
  const isKnownTab = TABS.includes(pathTab);
  const activeTab: Tab = isKnownTab ? pathTab : "rooms";
  const setActiveTab = useCallback(
    (tab: Tab) => navigate(`/${tab}`),
    [navigate]
  );

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showDeleteRoom, setShowDeleteRoom] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBrowseRooms, setShowBrowseRooms] = useState(false);

  /**
   * Set of room IDs the user has explicitly joined, persisted to localStorage.
   * Initialised lazily from "hive-joined-rooms"; on first load (key absent)
   * all workspace rooms are auto-joined for backward compatibility.
   */
  const [joinedRoomIds, setJoinedRoomIds] = useState<Set<string>>(() => {
    const raw = localStorage.getItem("hive-joined-rooms");
    if (raw !== null) {
      return new Set(raw ? raw.split(",") : []);
    }
    // Key not yet set — will be populated once rooms load.
    return new Set<string>();
  });
  /** Whether the initial localStorage seed has been applied. */
  const [joinedSeedDone, setJoinedSeedDone] = useState(
    () => localStorage.getItem("hive-joined-rooms") !== null
  );

  /** Per-room scroll positions — preserved across room switches. */
  const scrollPositions = useRef<Map<string, number>>(new Map());
  /** API-fetched member list (offline baseline). Refreshed on room selection. */
  const [apiMembers, setApiMembers] = useState<Member[]>([]);
  /** Ref to track which room the apiMembers were fetched for (avoids stale overwrites). */
  const apiMemberRoomRef = useRef<string | null>(null);

  /** Invalidate the server-side token and clear local auth state. */
  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        headers: authHeader(),
      });
    } catch {
      // Ignore — local state is always cleared regardless.
    } finally {
      clearToken();
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  // WebSocket connection to the selected room.
  // The JWT is passed as ?token= because the browser WebSocket API cannot
  // set the Authorization header during the upgrade handshake.
  const wsUrl = selectedRoomId
    ? `${WS_BASE}/ws/${selectedRoomId}?token=${encodeURIComponent(getToken() ?? "")}`
    : "";
  const { status, messages, sendMessage, clearMessages, connect, retryAt, lastConnectedAt } =
    useWebSocket({ url: wsUrl, autoConnect: !!selectedRoomId });

  // Debounced connection status for the UI indicator (MH-026)
  const { displayStatus, showRestoredToast, lastConnectedStr, nextRetryStr } =
    useConnectionStatus({ status, retryAt, lastConnectedAt });

  // Message history — loads historical messages from REST API when entering a room.
  const {
    historyMessages,
    hasMore: historyHasMore,
    isLoadingMore: historyLoading,
    loadInitial,
    loadMore,
    clearHistory,
  } = useMessageHistory();

  // De-duplicate: WS messages that are already in history (by ID) are suppressed.
  const historyIdSet = new Set(historyMessages.map((m) => m.id));
  const liveMessages = messages.filter((m) => !historyIdSet.has(m.id));

  // Combined message list: history (oldest first) + live WS messages.
  const allMessages: RoomMessage[] = [...historyMessages, ...liveMessages];

  // Fetch rooms from backend API on mount
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/rooms`, { headers: authHeader() })
      .then((res) => {
        if (res.status === 401) {
          clearToken();
          navigate("/login", { replace: true });
          return;
        }
        if (!res.ok) {
          console.warn(`Failed to fetch rooms: ${res.status}`);
          if (!cancelled) setRooms([]);
          return;
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled || !data) return;
        const roomList = (data.rooms || data || []) as Array<{
          id: string;
          name?: string;
          display_name?: string | null;
          description?: string | null;
        }>;
        const mapped: Room[] = roomList.map((r) => ({
          id: r.id || r.name || "",
          name: r.name || r.id || "",
          unreadCount: 0,
          display_name: r.display_name ?? null,
          description: r.description ?? null,
        }));
        setRooms(mapped);

        // Seed joinedRoomIds on first load (no localStorage entry yet):
        // auto-join all workspace rooms for backward compatibility.
        if (!joinedSeedDone && !cancelled) {
          const allIds = new Set(mapped.map((r) => r.id));
          setJoinedRoomIds(allIds);
          localStorage.setItem(
            "hive-joined-rooms",
            Array.from(allIds).join(",")
          );
          setJoinedSeedDone(true);
        }
      })
      .catch((err) => {
        console.warn("Cannot connect to hive-server:", err);
        if (!cancelled) setRooms([]);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, joinedSeedDone]);

  // Fetch API members when room selection changes (MH-020).
  useEffect(() => {
    if (!selectedRoomId) {
      setApiMembers([]);
      apiMemberRoomRef.current = null;
      return;
    }
    let cancelled = false;
    apiMemberRoomRef.current = selectedRoomId;
    type ApiMember = {
      username: string;
      display_name: string | null;
      role: string;
      presence: string;
    };
    fetch(`${API_BASE}/api/rooms/${selectedRoomId}/members`, {
      headers: authHeader(),
    })
      .then((res): Promise<{ members: ApiMember[] }> => {
        if (!res.ok) return Promise.resolve({ members: [] });
        return res.json() as Promise<{ members: ApiMember[] }>;
      })
      .then((data) => {
        if (cancelled || apiMemberRoomRef.current !== selectedRoomId) return;
        setApiMembers(
          data.members.map((m: ApiMember) => ({
            username: m.username,
            displayName: m.display_name ?? undefined,
            status: m.presence === "online" ? "online" : undefined,
            isAgent: /^(coder-|scout-|ba|r2d2|wall-e|saphire|bumblebee|sonnet-)/.test(
              m.username
            ),
            role: m.role,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setApiMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRoomId]);

  // Derive online members from WS messages — used as presence overlay over API baseline.
  const wsOnlineUsernames = new Set<string>();
  for (const msg of messages) {
    if (msg.user && msg.type !== "system") {
      wsOnlineUsernames.add(msg.user);
    }
  }

  // Merge: start from API baseline, overlay WS online presence.
  // Users seen in WS but absent from API list are appended (they joined after fetch).
  const members: Member[] = (() => {
    const merged = new Map<string, Member>();
    for (const m of apiMembers) {
      merged.set(m.username, {
        ...m,
        status: wsOnlineUsernames.has(m.username) ? "online" : m.status,
      });
    }
    for (const username of wsOnlineUsernames) {
      if (!merged.has(username)) {
        merged.set(username, {
          username,
          status: "online",
          isAgent: /^(coder-|scout-|ba|r2d2|wall-e|saphire|bumblebee|sonnet-)/.test(
            username
          ),
        });
      }
    }
    return Array.from(merged.values());
  })();

  // Sync selectedRoomId from URL path — the URL is the source of truth for room selection.
  // Saves the scroll position of the outgoing room, clears messages, then activates the new room.
  useEffect(() => {
    if (pathRoomId === selectedRoomId) return;

    if (selectedRoomId) {
      // Scroll position is managed by ChatTimeline's internal ref.
      // Clear the outgoing room's entry so it doesn't accumulate stale data.
      scrollPositions.current.delete(selectedRoomId);
    }

    clearMessages();
    if (selectedRoomId) clearHistory(selectedRoomId);
    setSelectedRoomId(pathRoomId);
    setShowSettings(false);

    if (pathRoomId) {
      setRooms((prev) =>
        prev.map((r) => (r.id === pathRoomId ? { ...r, unreadCount: 0 } : r))
      );
      // Load initial message history for the newly selected room.
      void loadInitial(pathRoomId);
    }
  }, [pathRoomId, selectedRoomId, clearMessages, clearHistory, loadInitial]);


  /** Navigate to /rooms/:roomId — the URL-sync effect will update selectedRoomId. */
  const handleSelectRoom = useCallback(
    (roomId: string) => {
      if (roomId !== selectedRoomId) {
        navigate(`/rooms/${roomId}`);
      }
    },
    [selectedRoomId, navigate]
  );

  /** Called when the settings panel saves changes — update room metadata in state. */
  const handleSettingsUpdated = useCallback(
    (updated: { display_name: string | null; description: string | null }) => {
      setRooms((prev) =>
        prev.map((r) =>
          r.id === selectedRoomId
            ? { ...r, display_name: updated.display_name, description: updated.description }
            : r
        )
      );
    },
    [selectedRoomId]
  );

  /** Persist the joined-room set to localStorage. */
  const persistJoined = useCallback((ids: Set<string>) => {
    localStorage.setItem("hive-joined-rooms", Array.from(ids).join(","));
  }, []);

  /** Called when user joins a room from the browse modal. */
  const handleJoinRoom = useCallback(
    async (roomId: string) => {
      await apiFetch(`${API_BASE}/api/rooms/${roomId}/join`, {
        method: "POST",
        headers: authHeader(),
      });
      setJoinedRoomIds((prev) => {
        const next = new Set(prev);
        next.add(roomId);
        persistJoined(next);
        return next;
      });
    },
    [persistJoined]
  );

  /** Called when user leaves a room (browse modal or room header button). */
  const handleLeaveRoom = useCallback(
    async (roomId: string) => {
      await apiFetch(`${API_BASE}/api/rooms/${roomId}/leave`, {
        method: "POST",
        headers: authHeader(),
      });
      setJoinedRoomIds((prev) => {
        const next = new Set(prev);
        next.delete(roomId);
        persistJoined(next);
        return next;
      });
      // Navigate away if the user just left the active room.
      if (roomId === selectedRoomId) {
        clearMessages();
        navigate("/rooms");
        setShowSettings(false);
      }
    },
    [selectedRoomId, clearMessages, persistJoined, navigate]
  );

  /** Called after a room is successfully created: add it to the list and navigate to it. */
  const handleRoomCreated = useCallback(
    (roomId: string) => {
      setRooms((prev) => {
        if (prev.some((r) => r.id === roomId)) return prev;
        return [{ id: roomId, name: roomId, unreadCount: 0 }, ...prev];
      });
      // Auto-join the newly created room.
      setJoinedRoomIds((prev) => {
        const next = new Set(prev);
        next.add(roomId);
        persistJoined(next);
        return next;
      });
      navigate(`/rooms/${roomId}`);
      setShowCreateRoom(false);
    },
    [navigate, persistJoined]
  );

  /** Called after a room is successfully deleted: remove it from the list and navigate away. */
  const handleRoomDeleted = useCallback(() => {
    if (selectedRoomId) {
      setJoinedRoomIds((prev) => {
        const next = new Set(prev);
        next.delete(selectedRoomId);
        persistJoined(next);
        return next;
      });
    }
    setRooms((prev) => prev.filter((r) => r.id !== selectedRoomId));
    navigate("/rooms");
    setShowDeleteRoom(false);
  }, [selectedRoomId, navigate, persistJoined]);

  // Handle sending messages
  const handleSend = useCallback(
    (content: string) => {
      sendMessage(content);
    },
    [sendMessage]
  );

  // Keyboard shortcuts for tab switching
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key >= "1" && e.key <= "4") {
        e.preventDefault();
        setActiveTab(TABS[parseInt(e.key) - 1]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setActiveTab]);

  // Render 404 for unknown routes (after hooks — hooks must always run)
  if (!isRootPath && !isKnownTab) {
    return <NotFoundPage />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-gray-100">
      {/* Top navigation tabs */}
      <nav className="flex items-center gap-1 px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="font-bold text-lg mr-4 text-blue-400">Hive</span>
        {(["rooms", "agents", "tasks", "costs"] as Tab[]).map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            aria-selected={activeTab === tab}
            role="tab"
            className={`px-3 py-1.5 rounded text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
            }`}
            title={`Ctrl+${i + 1}`}
          >
            {tab}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3">
          <ConnectionStatusBar
            displayStatus={displayStatus}
            serverUrl={API_BASE}
            lastConnectedStr={lastConnectedStr}
            nextRetryStr={nextRetryStr}
            showRestoredToast={showRestoredToast}
            onRetry={connect}
          />
          {getStoredRole() === "admin" && (
            <a
              href="/admin/users"
              data-testid="admin-nav-link"
              className="px-3 py-1 rounded text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
            >
              Admin
            </a>
          )}
          <button
            onClick={() => navigate("/settings/preferences")}
            data-testid="preferences-nav-button"
            className="px-3 py-1 rounded text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
            aria-label="Preferences"
            title="Preferences"
          >
            ⚙
          </button>
          <button
            onClick={() => navigate("/profile")}
            data-testid="profile-nav-button"
            className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold hover:bg-blue-500 transition-colors select-none"
            aria-label="View profile"
            title="Profile"
          >
            {getNavInitials()}
          </button>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            data-testid="logout-button"
            className="px-3 py-1 rounded text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Log out"
          >
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      </nav>

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-60 bg-gray-800 border-r border-gray-700 flex flex-col sidebar">
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {activeTab}
            </span>
            {activeTab === "rooms" && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowBrowseRooms(true)}
                  aria-label="Browse rooms"
                  data-testid="browse-rooms-button"
                  className="text-gray-500 hover:text-gray-200 transition-colors text-sm leading-none px-1"
                  title="Browse rooms"
                >
                  ⊕
                </button>
                <button
                  onClick={() => setShowCreateRoom(true)}
                  aria-label="Create room"
                  data-testid="create-room-button"
                  className="text-gray-500 hover:text-gray-200 transition-colors text-lg leading-none"
                  title="Create room"
                >
                  +
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {activeTab === "rooms" ? (
              <RoomList
                rooms={rooms.filter((r) => joinedRoomIds.has(r.id))}
                selectedRoomId={selectedRoomId}
                onSelectRoom={handleSelectRoom}
                onCreateRoom={() => setShowCreateRoom(true)}
              />
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">
                Coming soon
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden main-content">
          {activeTab === "rooms" && selectedRoomId ? (
            <>
              {/* Room header */}
              <div data-testid="room-header" className="px-4 py-2 border-b border-gray-700 bg-gray-800 flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  {rooms.find((r) => r.id === selectedRoomId)?.display_name ?? `#${selectedRoomId}`}
                </h2>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleLeaveRoom(selectedRoomId)}
                    aria-label="Leave room"
                    data-testid="leave-room-button"
                    className="text-xs text-gray-500 hover:text-yellow-400 transition-colors px-2 py-0.5 rounded border border-transparent hover:border-yellow-700"
                    title="Leave room (removes from sidebar)"
                  >
                    Leave
                  </button>
                  <button
                    onClick={() => setShowSettings((v) => !v)}
                    aria-label="Room settings"
                    data-testid="room-settings-button"
                    className={`text-gray-500 hover:text-gray-200 transition-colors text-base leading-none p-1 rounded ${showSettings ? "text-blue-400" : ""}`}
                    title="Room settings"
                  >
                    ⚙
                  </button>
                  <button
                    onClick={() => setShowDeleteRoom(true)}
                    aria-label="Delete room"
                    data-testid="delete-room-button"
                    className="text-gray-500 hover:text-red-400 transition-colors p-1"
                    title="Delete room"
                  >
                    🗑
                  </button>
                </div>
              </div>
              {/* Chat timeline */}
              <ChatTimeline
                key={selectedRoomId ?? ''}
                messages={allMessages}
                currentUser={getUserFromToken()?.username ?? "hive-user"}
                onLoadMore={() => void loadMore(selectedRoomId)}
                isLoadingMore={historyLoading}
                atBeginning={!historyHasMore && historyMessages.length > 0}
              />
              {/* Message input */}
              <MessageInput
                onSend={handleSend}
                connected={status === "connected"}
              />
            </>
          ) : activeTab === "agents" ? (
            <AgentGrid />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2 capitalize">
                  {activeTab}
                </h2>
                <p className="text-sm">
                  {activeTab === "rooms"
                    ? "Select a room from the sidebar"
                    : "Coming soon"}
                </p>
              </div>
            </div>
          )}
        </main>

        {/* Right context panel */}
        <aside className="w-72 bg-gray-800 border-l border-gray-700 flex flex-col context-panel">
          {activeTab === "rooms" && selectedRoomId ? (
            <MemberPanel members={members} roomName={selectedRoomId} />
          ) : (
            <>
              <div className="p-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Details
              </div>
              <div className="flex-1 px-3 text-sm text-gray-500">
                <p>No selection</p>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Reconnecting banner */}
      {status === "connecting" && selectedRoomId && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-yellow-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          Reconnecting to {selectedRoomId}...
        </div>
      )}

      {/* Create room modal */}
      {showCreateRoom && (
        <CreateRoomModal
          onCreated={handleRoomCreated}
          onClose={() => setShowCreateRoom(false)}
        />
      )}

      {/* Delete room modal */}
      {showDeleteRoom && selectedRoomId && (
        <DeleteRoomModal
          roomId={selectedRoomId}
          onDeleted={handleRoomDeleted}
          onClose={() => setShowDeleteRoom(false)}
        />
      )}

      {/* Room settings panel */}
      {showSettings && selectedRoomId && (() => {
        const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
        if (!selectedRoom) return null;
        return (
          <RoomSettingsPanel
            room={{
              id: selectedRoom.id,
              name: selectedRoom.name,
              display_name: selectedRoom.display_name ?? null,
              description: selectedRoom.description ?? null,
            }}
            onClose={() => setShowSettings(false)}
            onUpdated={handleSettingsUpdated}
          />
        );
      })()}

      {/* Browse / join-leave rooms modal */}
      {showBrowseRooms && (
        <JoinRoomModal
          allRooms={rooms}
          joinedRoomIds={joinedRoomIds}
          onJoin={handleJoinRoom}
          onLeave={handleLeaveRoom}
          onClose={() => setShowBrowseRooms(false)}
        />
      )}
    </div>
  );
}

export default App;

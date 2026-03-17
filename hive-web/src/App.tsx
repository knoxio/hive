import { useCallback, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { RoomList } from "./components/RoomList";
import { CreateRoomModal } from "./components/CreateRoomModal";
import { DeleteRoomModal } from "./components/DeleteRoomModal";
import { JoinRoomModal } from "./components/JoinRoomModal";
import { RoomSettingsPanel } from "./components/RoomSettingsPanel";
import ChatTimeline from "./components/ChatTimeline";
import { MemberPanel } from "./components/MemberPanel";
import { MessageInput } from "./components/MessageInput";
import { AgentGrid } from "./components/AgentGrid";
import { NotFoundPage } from "./components/ErrorPage";
import { useWebSocket } from "./hooks/useWebSocket";
import type { ConnectionStatus } from "./hooks/useWebSocket";
import type { Room } from "./components/RoomList";
import type { Member } from "./components/MemberPanel";
import { authHeader, clearToken, getUserFromToken } from "./lib/auth";
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

/** Connection status indicator dot. */
function StatusDot({ status }: { status: ConnectionStatus }) {
  const colors: Record<ConnectionStatus, string> = {
    connected: "bg-green-500",
    connecting: "bg-yellow-500 animate-pulse",
    disconnected: "bg-red-500",
  };
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-400">
      <span className={`w-2 h-2 rounded-full ${colors[status]}`} />
      {status}
    </div>
  );
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // Derive active tab from URL path
  const pathTab = location.pathname.split("/")[1] as Tab;
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

  // WebSocket connection to the selected room
  const wsUrl = selectedRoomId ? `${WS_BASE}/ws/${selectedRoomId}` : "";
  const { status, messages, sendMessage, clearMessages } = useWebSocket({
    url: wsUrl,
    autoConnect: !!selectedRoomId,
  });

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

  // Extract members from messages
  const members: Member[] = (() => {
    const seen = new Map<string, Member>();
    for (const msg of messages) {
      if (msg.user && !seen.has(msg.user)) {
        seen.set(msg.user, {
          username: msg.user,
          status: msg.type === "system" ? undefined : "online",
          isAgent: /^(coder-|scout-|ba|r2d2|wall-e|saphire|bumblebee|sonnet-)/.test(
            msg.user
          ),
        });
      }
    }
    return Array.from(seen.values());
  })();

  // Handle room selection — close settings panel when switching rooms.
  const handleSelectRoom = useCallback(
    (roomId: string) => {
      if (roomId !== selectedRoomId) {
        clearMessages();
        setSelectedRoomId(roomId);
        setShowSettings(false);
      }
    },
    [selectedRoomId, clearMessages]
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
      // Deselect the room if the user just left it.
      if (roomId === selectedRoomId) {
        clearMessages();
        setSelectedRoomId(null);
        setShowSettings(false);
      }
    },
    [selectedRoomId, clearMessages, persistJoined]
  );

  /** Called after a room is successfully created: add it to the list and select it. */
  const handleRoomCreated = useCallback((roomId: string) => {
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
    clearMessages();
    setSelectedRoomId(roomId);
    setShowCreateRoom(false);
  }, [clearMessages, persistJoined]);

  /** Called after a room is successfully deleted: remove it from the list and deselect. */
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
    clearMessages();
    setSelectedRoomId(null);
    setShowDeleteRoom(false);
  }, [selectedRoomId, clearMessages, persistJoined]);

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
          <StatusDot status={status} />
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
              <div className="px-4 py-2 border-b border-gray-700 bg-gray-800 flex items-center justify-between">
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
              <div className="flex-1 overflow-y-auto" data-testid="chat-timeline">
                <ChatTimeline messages={messages} currentUser="hive-user" />
              </div>
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

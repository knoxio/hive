import { useCallback, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { RoomList } from "./components/RoomList";
import ChatTimeline from "./components/ChatTimeline";
import { MemberPanel } from "./components/MemberPanel";
import { MessageInput } from "./components/MessageInput";
import { AgentGrid } from "./components/AgentGrid";
import { useWebSocket } from "./hooks/useWebSocket";
import type { ConnectionStatus } from "./hooks/useWebSocket";
import type { Room } from "./components/RoomList";
import type { Member } from "./components/MemberPanel";

type Tab = "rooms" | "agents" | "tasks" | "costs";
const TABS: Tab[] = ["rooms", "agents", "tasks", "costs"];

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

interface RoomsState {
  loading: boolean;
  daemonOffline: boolean;
  rooms: Room[];
  /** Increment to trigger a re-fetch (e.g. on Retry). */
  fetchId: number;
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // Derive active tab from URL path
  const pathTab = location.pathname.split("/")[1] as Tab;
  const activeTab: Tab = TABS.includes(pathTab) ? pathTab : "rooms";
  const setActiveTab = useCallback(
    (tab: Tab) => navigate(`/${tab}`),
    [navigate]
  );

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  /**
   * Rooms fetch state. Initial `loading: true` means the skeleton is shown
   * immediately without any synchronous setState inside the effect.
   * Increment `fetchId` (outside the effect) to trigger a re-fetch.
   */
  const [roomsState, setRoomsState] = useState<RoomsState>({
    loading: true,
    daemonOffline: false,
    rooms: [],
    fetchId: 0,
  });

  // WebSocket connection to the selected room
  const wsUrl = selectedRoomId ? `${WS_BASE}/ws/${selectedRoomId}` : "";
  const { status, messages, sendMessage, clearMessages } = useWebSocket({
    url: wsUrl,
    autoConnect: !!selectedRoomId,
  });

  // Fetch rooms. All setState calls happen in async callbacks or event handlers
  // — never synchronously in the effect body — to satisfy react-hooks/set-state-in-effect.
  useEffect(() => {
    let cancelled = false;

    fetch(`${API_BASE}/api/rooms`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 503) {
          setRoomsState((s) => ({
            ...s,
            loading: false,
            daemonOffline: true,
            rooms: [],
          }));
          return;
        }
        if (!res.ok) {
          console.warn(`Failed to fetch rooms: ${res.status}`);
          setRoomsState((s) => ({ ...s, loading: false, rooms: [] }));
          return;
        }
        const data = (await res.json()) as
          | { rooms?: Array<{ id: string; name?: string }> }
          | Array<{ id: string; name?: string }>;
        if (cancelled) return;
        const raw = Array.isArray(data) ? data : (data.rooms ?? []);
        const rooms: Room[] = raw.map((r) => ({
          id: r.id || r.name || "",
          name: r.name || r.id || "",
          unreadCount: 0,
        }));
        setRoomsState((s) => ({
          ...s,
          loading: false,
          daemonOffline: false,
          rooms,
        }));
      })
      .catch((err) => {
        console.warn("Cannot connect to hive-server:", err);
        if (!cancelled) {
          setRoomsState((s) => ({
            ...s,
            loading: false,
            daemonOffline: true,
            rooms: [],
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [roomsState.fetchId]);

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

  // Handle room selection
  const handleSelectRoom = useCallback(
    (roomId: string) => {
      if (roomId !== selectedRoomId) {
        clearMessages();
        setSelectedRoomId(roomId);
      }
    },
    [selectedRoomId, clearMessages]
  );

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
        <div className="ml-auto">
          <StatusDot status={status} />
        </div>
      </nav>

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-60 bg-gray-800 border-r border-gray-700 flex flex-col sidebar">
          <div className="p-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {activeTab}
          </div>
          <div className="flex-1 overflow-y-auto">
            {activeTab === "rooms" ? (
              <RoomList
                rooms={roomsState.rooms}
                selectedRoomId={selectedRoomId}
                onSelectRoom={handleSelectRoom}
                loading={roomsState.loading}
                daemonOffline={roomsState.daemonOffline}
                daemonUrl={API_BASE}
                onRetry={() =>
                  setRoomsState((s) => ({
                    ...s,
                    loading: true,
                    daemonOffline: false,
                    fetchId: s.fetchId + 1,
                  }))
                }
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
              <div className="px-4 py-2 border-b border-gray-700 bg-gray-800">
                <h2 className="text-sm font-semibold">#{selectedRoomId}</h2>
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
    </div>
  );
}

export default App;

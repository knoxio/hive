import { useState } from "react";
import { RoomList } from "./components/RoomList";
import type { Room } from "./components/RoomList";

type Tab = "rooms" | "agents" | "tasks" | "costs";

// Placeholder rooms for development
const DEMO_ROOMS: Room[] = [
  { id: "room-dev", name: "room-dev", unreadCount: 3 },
  { id: "room-qa", name: "room-qa", unreadCount: 0 },
  { id: "room-design", name: "room-design", unreadCount: 12 },
];

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("rooms");
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-gray-100">
      {/* Top navigation tabs */}
      <nav className="flex items-center gap-1 px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="font-bold text-lg mr-6 text-blue-400">Hive</span>
        {(["rooms", "agents", "tasks", "costs"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-60 bg-gray-800 border-r border-gray-700 flex flex-col">
          <div className="p-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {activeTab === "rooms" ? "Rooms" : activeTab === "agents" ? "Agents" : activeTab === "tasks" ? "Tasks" : "Costs"}
          </div>
          <div className="flex-1 overflow-y-auto">
            {activeTab === "rooms" ? (
              <RoomList
                rooms={DEMO_ROOMS}
                selectedRoomId={selectedRoomId}
                onSelectRoom={setSelectedRoomId}
              />
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">No items yet</div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2 capitalize">{activeTab}</h2>
              <p className="text-sm">Select an item from the sidebar</p>
            </div>
          </div>
        </main>

        {/* Right context panel */}
        <aside className="w-72 bg-gray-800 border-l border-gray-700 flex flex-col">
          <div className="p-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Details
          </div>
          <div className="flex-1 px-3 text-sm text-gray-500">
            <p>No selection</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;

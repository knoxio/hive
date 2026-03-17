import { useCallback, useEffect, useState } from 'react';
import { EmptyState } from './EmptyState';
import { AgentGridSkeleton } from './Skeleton';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/** Agent data from the /api/agents endpoint. */
export interface Agent {
  username: string;
  personality: string;
  model: string;
  pid: number;
  health: 'healthy' | 'warning' | 'stale' | 'exited';
  status?: string;
  uptime?: string;
  spawned_at?: string;
}

/** Health status indicator with color coding. */
function HealthDot({ health }: { health: Agent['health'] }) {
  const colors: Record<Agent['health'], string> = {
    healthy: 'bg-green-500',
    warning: 'bg-yellow-500',
    stale: 'bg-orange-500',
    exited: 'bg-red-500',
  };
  return (
    <span
      className={`w-2.5 h-2.5 rounded-full inline-block ${colors[health]}`}
      title={health}
    />
  );
}

/** Single agent card in the grid. */
function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div
      className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-blue-500 transition-colors cursor-pointer"
      data-testid="agent-card"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🤖</span>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-gray-100 truncate">{agent.username}</div>
          <div className="text-xs text-gray-400">{agent.personality}</div>
        </div>
        <HealthDot health={agent.health} />
      </div>

      <div className="space-y-1 text-xs text-gray-400">
        <div className="flex justify-between">
          <span>Model</span>
          <span className="text-gray-300">{agent.model}</span>
        </div>
        <div className="flex justify-between">
          <span>PID</span>
          <span className="text-gray-300">{agent.pid}</span>
        </div>
        {agent.uptime && (
          <div className="flex justify-between">
            <span>Uptime</span>
            <span className="text-gray-300">{agent.uptime}</span>
          </div>
        )}
      </div>

      {agent.status && (
        <div className="mt-3 pt-2 border-t border-gray-700 text-xs text-gray-400 truncate">
          {agent.status}
        </div>
      )}
    </div>
  );
}

/** Agent grid view for the Agents tab. */
export function AgentGrid() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [daemonOffline, setDaemonOffline] = useState(false);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/agents`);
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || data || []);
        setDaemonOffline(false);
      } else if (res.status === 503) {
        setDaemonOffline(true);
        setAgents([]);
      } else {
        // 501 (not implemented) or other — show empty, not offline
        setAgents([]);
        setDaemonOffline(false);
      }
    } catch {
      setDaemonOffline(true);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 5000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  const healthCounts = {
    healthy: agents.filter((a) => a.health === 'healthy').length,
    warning: agents.filter((a) => a.health === 'warning').length,
    stale: agents.filter((a) => a.health === 'stale').length,
    exited: agents.filter((a) => a.health === 'exited').length,
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-hidden" data-testid="agent-grid">
        <AgentGridSkeleton />
      </div>
    );
  }

  if (daemonOffline) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden" data-testid="agent-grid">
        <EmptyState
          icon="🔌"
          title="Daemon offline"
          description={`Cannot reach the Hive server at ${API_BASE}. Check that it is running.`}
          action={{ label: 'Retry', onClick: fetchAgents }}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" data-testid="agent-grid">
      {/* Summary bar */}
      <div className="px-4 py-2 border-b border-gray-700 bg-gray-800 flex items-center gap-4 text-sm">
        <span className="font-medium text-gray-300">
          {agents.length} agent{agents.length !== 1 ? 's' : ''}
        </span>
        {agents.length > 0 && (
          <div className="flex gap-3 text-xs text-gray-400">
            {healthCounts.healthy > 0 && (
              <span className="flex items-center gap-1">
                <HealthDot health="healthy" /> {healthCounts.healthy}
              </span>
            )}
            {healthCounts.warning > 0 && (
              <span className="flex items-center gap-1">
                <HealthDot health="warning" /> {healthCounts.warning}
              </span>
            )}
            {healthCounts.stale > 0 && (
              <span className="flex items-center gap-1">
                <HealthDot health="stale" /> {healthCounts.stale}
              </span>
            )}
            {healthCounts.exited > 0 && (
              <span className="flex items-center gap-1">
                <HealthDot health="exited" /> {healthCounts.exited}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Grid or no-agents empty state */}
      <div className="flex-1 overflow-y-auto">
        {agents.length === 0 ? (
          <EmptyState
            icon="🤖"
            title="No agents connected"
            description="No agents are currently registered. Use /spawn in a room to start one."
            action={{
              label: 'View documentation',
              href: 'https://github.com/knoxio/room#agents',
            }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {agents.map((agent) => (
              <AgentCard key={agent.username} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

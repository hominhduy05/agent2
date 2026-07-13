'use client';

import { useEffect, useState } from 'react';

import { AgentAlerts } from '../../../components/agent/AgentAlerts';
import { AgentOverview } from '../../../components/agent/AgentOverview';
import { AgentRecommendations } from '../../../components/agent/AgentRecommendations';
import { AgentRunTimeline } from '../../../components/agent/AgentRunTimeline';
import { getAgentStatus, listAgentRuns, runAgentCheck } from '../../../lib/agent-api';
import type { AgentRun, AgentStatus } from '../../../lib/agent-types';

export default function AgentPage() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [nextStatus, nextRuns] = await Promise.all([
      getAgentStatus(),
      listAgentRuns(10),
    ]);
    setStatus(nextStatus);
    setRuns(nextRuns.items);
  }

  useEffect(() => {
    refresh().catch((err) => {
      setError(err instanceof Error ? err.message : 'Cannot load agent page');
    });
  }, []);

  async function handleRunCheck() {
    setLoading(true);
    setError(null);
    try {
      await runAgentCheck();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cannot run agent check');
    } finally {
      setLoading(false);
    }
  }

  if (!status) {
    return <div className="p-6 text-sm text-slate-500">Loading agent status...</div>;
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-950">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Agentic AI Supervisor</h1>
          <p className="mt-1 text-sm text-slate-500">
            Deterministic monitoring, evidence-backed alerts, and safe recommendations.
          </p>
        </div>
        <button
          className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          disabled={loading}
          onClick={handleRunCheck}
        >
          {loading ? 'Running...' : 'Run check'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <AgentOverview status={status} />

        <section>
          <h2 className="mb-3 text-lg font-semibold">Active alerts</h2>
          <AgentAlerts alerts={status.active_alerts} />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Recommendations</h2>
          <AgentRecommendations recommendations={status.recommendations} />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Run timeline</h2>
          <AgentRunTimeline runs={runs} />
        </section>
      </div>
    </main>
  );
}


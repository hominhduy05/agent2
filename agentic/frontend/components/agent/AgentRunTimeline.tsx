import type { AgentRun } from '../../lib/agent-types';

export function AgentRunTimeline({ runs }: { runs: AgentRun[] }) {
  if (!runs.length) {
    return <p className="text-sm text-slate-500">No agent runs yet.</p>;
  }

  return (
    <ol className="space-y-3">
      {runs.map((run) => (
        <li key={run.run_id} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="font-medium text-slate-950">{run.summary}</div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs">
              {run.status}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {new Date(run.started_at).toLocaleString()}
          </div>
        </li>
      ))}
    </ol>
  );
}


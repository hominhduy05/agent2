import type { AgentStatus } from '../../lib/agent-types';

export function AgentOverview({ status }: { status: AgentStatus }) {
  const latest = status.latest_run;
  const critical = status.active_alerts.filter(
    (alert) => alert.severity === 'critical'
  ).length;
  const warnings = status.active_alerts.filter(
    (alert) => alert.severity === 'warning'
  ).length;

  return (
    <section className="grid gap-4 md:grid-cols-4">
      <Metric label="Latest run" value={latest?.status ?? 'No data'} />
      <Metric label="Active alerts" value={status.active_alerts.length} />
      <Metric label="Critical" value={critical} />
      <Metric label="Warnings" value={warnings} />
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}


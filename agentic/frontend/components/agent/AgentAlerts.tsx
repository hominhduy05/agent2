import type { AgentAlert } from '../../lib/agent-types';

export function AgentAlerts({ alerts }: { alerts: AgentAlert[] }) {
  if (!alerts.length) {
    return <p className="text-sm text-slate-500">No active agent alerts.</p>;
  }

  return (
    <section className="space-y-3">
      {alerts.map((alert) => (
        <article
          key={alert.alert_id}
          className="rounded-lg border border-slate-200 bg-white p-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500">
                {alert.code} · {alert.severity}
              </div>
              <h3 className="mt-1 text-base font-semibold text-slate-950">
                {alert.title}
              </h3>
              <p className="mt-1 text-sm text-slate-600">{alert.message}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
              {alert.status}
            </span>
          </div>
          <pre className="mt-3 max-h-40 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-100">
            {JSON.stringify(alert.evidence, null, 2)}
          </pre>
        </article>
      ))}
    </section>
  );
}


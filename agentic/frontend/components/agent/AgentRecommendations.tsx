import type { AgentRecommendation } from '../../lib/agent-types';

export function AgentRecommendations({
  recommendations,
}: {
  recommendations: AgentRecommendation[];
}) {
  if (!recommendations.length) {
    return <p className="text-sm text-slate-500">No recommendations yet.</p>;
  }

  return (
    <section className="space-y-3">
      {recommendations.map((item) => (
        <article
          key={item.recommendation_id}
          className="rounded-lg border border-slate-200 bg-white p-4"
        >
          <div className="text-xs font-semibold uppercase text-slate-500">
            Priority {item.priority}
          </div>
          <p className="mt-1 text-sm text-slate-700">{item.recommendation}</p>
          {item.action_key && (
            <div className="mt-2 text-xs text-slate-500">
              Proposed action: {item.action_key}
            </div>
          )}
        </article>
      ))}
    </section>
  );
}


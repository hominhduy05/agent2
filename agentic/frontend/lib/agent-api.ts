import type {
  AgentActionDefinition,
  AgentAlert,
  AgentRecommendation,
  AgentRun,
  AgentStatus,
} from './agent-types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000';

export async function getAgentStatus(): Promise<AgentStatus> {
  const res = await fetch(`${API_BASE}/api/agent/status`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Cannot load agent status');
  return res.json();
}

export async function runAgentCheck(): Promise<AgentRun> {
  const res = await fetch(`${API_BASE}/api/agent/runs`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Cannot run agent check');
  return res.json();
}

export async function listAgentRuns(limit = 20): Promise<{ items: AgentRun[] }> {
  const res = await fetch(`${API_BASE}/api/agent/runs?limit=${limit}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Cannot load agent runs');
  return res.json();
}

export async function listAgentAlerts(): Promise<{ items: AgentAlert[] }> {
  const res = await fetch(`${API_BASE}/api/agent/alerts`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Cannot load agent alerts');
  return res.json();
}

export async function acknowledgeAgentAlert(alertId: string): Promise<AgentAlert> {
  const res = await fetch(`${API_BASE}/api/agent/alerts/${alertId}/acknowledge`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Cannot acknowledge alert');
  return res.json();
}

export async function listAgentRecommendations(): Promise<{
  items: AgentRecommendation[];
}> {
  const res = await fetch(`${API_BASE}/api/agent/recommendations`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Cannot load recommendations');
  return res.json();
}

export async function listAgentActions(): Promise<{
  items: AgentActionDefinition[];
}> {
  const res = await fetch(`${API_BASE}/api/agent/actions`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Cannot load agent actions');
  return res.json();
}


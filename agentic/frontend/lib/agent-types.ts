export type AgentSeverity = 'info' | 'warning' | 'critical';
export type AgentRunStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'PARTIAL';
export type AgentRiskLevel =
  | 'SAFE_READ'
  | 'SAFE_WRITE'
  | 'CONFIRM_REQUIRED'
  | 'FORBIDDEN';

export interface AgentRun {
  run_id: string;
  started_at: string;
  finished_at?: string | null;
  status: AgentRunStatus;
  trigger_source: string;
  summary: string;
  anomalies_found: number;
  recommendations_found: number;
  error?: string | null;
}

export interface AgentAlert {
  alert_id: string;
  code: string;
  severity: AgentSeverity;
  title: string;
  message: string;
  source: string;
  camera_slot?: number | null;
  status: string;
  evidence: Record<string, unknown>;
  first_seen_at: string;
  last_seen_at: string;
}

export interface AgentRecommendation {
  recommendation_id: string;
  alert_id?: string | null;
  priority: number;
  recommendation: string;
  action_key?: string | null;
  requires_confirmation: boolean;
  evidence_keys: string[];
  created_at: string;
}

export interface AgentActionDefinition {
  action_key: string;
  title: string;
  description: string;
  risk_level: AgentRiskLevel;
  requires_confirmation: boolean;
}

export interface AgentStatus {
  latest_run: AgentRun | null;
  active_alerts: AgentAlert[];
  recommendations: AgentRecommendation[];
}


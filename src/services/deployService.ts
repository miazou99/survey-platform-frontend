export interface DeployServiceInfo {
  name: string;
  image: string;
  state: string;
  running: boolean;
  createdAt: string;
  startedAt: string;
  uptime: string;
  restartCount: number;
  exitCode?: number;
  error?: string;
}

export interface DeployStatus {
  generatedAt: string;
  count: number;
  services: DeployServiceInfo[];
}

const DEPLOY_API_BASE = '/deploy-api';

function getToken(): string | null {
  return localStorage.getItem('deploy_token');
}

export async function getDeployStatus(): Promise<DeployStatus> {
  const headers: Record<string, string> = {};
  const t = getToken();
  if (t) headers['X-Deploy-Token'] = t;
  const res = await fetch(`${DEPLOY_API_BASE}/status`, { headers });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `请求失败: ${res.status}`);
  }
  return res.json();
}

export async function getDeployLogs(svc: string, tail = 200): Promise<string> {
  const headers: Record<string, string> = {};
  const t = getToken();
  if (t) headers['X-Deploy-Token'] = t;
  const res = await fetch(`${DEPLOY_API_BASE}/logs?svc=${encodeURIComponent(svc)}&tail=${tail}`, { headers });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `请求失败: ${res.status}`);
  }
  return res.text();
}

export function setDeployToken(token: string) {
  if (token) localStorage.setItem('deploy_token', token);
  else localStorage.removeItem('deploy_token');
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Server, Database, Globe, Terminal, KeyRound, X } from 'lucide-react';
import { getDeployStatus, getDeployLogs, setDeployToken, type DeployStatus, type DeployServiceInfo } from '../../services/deployService';

function fmtTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

const SERVICE_META: Record<string, { label: string; icon: typeof Server }> = {
  'survey-backend': { label: '后端 API', icon: Server },
  'survey-frontend': { label: '前端 Web', icon: Globe },
  'survey-postgres': { label: '数据库', icon: Database },
};

export default function DeployPanel() {
  const [status, setStatus] = useState<DeployStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [logSvc, setLogSvc] = useState('survey-backend');
  const [logs, setLogs] = useState('');
  const [logsLoading, setLogsLoading] = useState(false);
  const logBoxRef = useRef<HTMLPreElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setStatus(await getDeployStatus());
    } catch (e: any) {
      setError(e.message || '加载失败');
      if (e.message === 'unauthorized' || (e as any)?.status === 401) setShowToken(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    if (!logSvc) return;
    setLogsLoading(true);
    try {
      setLogs(await getDeployLogs(logSvc, 300));
    } catch (e: any) {
      setLogs(`[加载日志失败] ${e.message}`);
    } finally {
      setLogsLoading(false);
    }
  }, [logSvc]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const saveToken = () => {
    setDeployToken(tokenInput.trim());
    setShowToken(false);
    setTokenInput('');
    load();
  };

  const renderCard = (svc: DeployServiceInfo) => {
    const meta = SERVICE_META[svc.name] || { label: svc.name, icon: Server };
    const Icon = meta.icon;
    const up = svc.running;
    return (
      <div key={svc.name} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${up ? 'bg-green-100' : 'bg-red-100'}`}>
              <Icon className={`w-5 h-5 ${up ? 'text-green-600' : 'text-red-600'}`} />
            </div>
            <div>
              <div className="font-semibold text-gray-900">{meta.label}</div>
              <div className="text-xs text-gray-400 font-mono">{svc.name}</div>
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${up ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            {up ? '● 运行中' : '● 已停止'}
          </span>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">部署时间</span><span className="text-gray-800 font-mono text-xs">{fmtTime(svc.createdAt)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">运行时长</span><span className="text-gray-800">{svc.uptime || '—'}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">重启次数</span><span className="text-gray-800">{svc.restartCount}</span></div>
          <div className="flex justify-between items-center"><span className="text-gray-500">镜像</span><span className="text-gray-400 font-mono text-xs truncate max-w-[160px]" title={svc.image}>{svc.image}</span></div>
        </div>
        <button onClick={() => setLogSvc(svc.name)} className="mt-4 w-full py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-1">
          <Terminal className="w-3 h-3" /> 查看日志
        </button>
      </div>
    );
  };

  return (
    <div className="p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">部署面板</h1>
          <p className="text-gray-500 mt-1">前后端服务部署状态与日志监控</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowToken(true)} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1">
            <KeyRound className="w-3 h-3" /> 访问令牌
          </button>
          <button onClick={() => setAutoRefresh(!autoRefresh)} className={`px-3 py-1.5 text-xs border rounded-lg flex items-center gap-1 ${autoRefresh ? 'bg-blue-50 border-blue-300 text-blue-600' : 'border-gray-300 hover:bg-gray-50'}`}>
            <RefreshCw className={`w-3 h-3 ${autoRefresh ? 'animate-spin' : ''}`} /> {autoRefresh ? '自动刷新中' : '自动刷新'}
          </button>
          <button onClick={load} disabled={loading} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> 刷新
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm">
          {error}
          {error.includes('401') || error.includes('unauthorized') ? '（需要先配置访问令牌）' : ''}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {status ? status.services.map(renderCard) : loading ? <div className="text-gray-400 text-sm">加载中…</div> : null}
      </div>

      {/* 日志查看器 */}
      <div className="bg-gray-900 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Terminal className="w-4 h-4" />
            <span className="font-semibold">日志</span>
            <select value={logSvc} onChange={(e) => setLogSvc(e.target.value)} className="ml-2 bg-gray-800 text-gray-200 text-xs rounded px-2 py-1 border border-gray-700">
              {(status?.services || []).map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <button onClick={loadLogs} disabled={logsLoading} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
            <RefreshCw className={`w-3 h-3 ${logsLoading ? 'animate-spin' : ''}`} /> 刷新日志
          </button>
        </div>
        <pre ref={logBoxRef} className="p-4 text-xs text-green-400 font-mono h-80 overflow-auto whitespace-pre-wrap">{logs || (logsLoading ? '加载中…' : '暂无日志')}</pre>
      </div>

      {/* Token 弹窗 */}
      {showToken && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowToken(false)}>
          <div className="bg-white rounded-xl p-6 w-96 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">访问令牌</h3>
              <button onClick={() => setShowToken(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-3">输入部署面板的访问令牌（由服务器环境变量 DEPLOY_AGENT_TOKEN 配置）。</p>
            <input value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="输入访问令牌" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowToken(false)} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg">取消</button>
              <button onClick={saveToken} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

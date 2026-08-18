import { useState, useEffect, useCallback, useRef } from 'react';
import { Gift, Send, Search, Download, RefreshCw, Filter, Pause, Play } from 'lucide-react';
import { hongbaoCenterApi, projectApi } from '../../services/api';
import { showToast, showConfirm } from '../../components/Toast';

export default function HongbaoCenter() {
  const [activeTab, setActiveTab] = useState<'records' | 'send'>('records');

  // 红包发放进度状态（提升到顶层，底部进度卡跨 Tab 可见）
  const [sendPhase, setSendPhase] = useState<'idle' | 'sending' | 'paused' | 'done'>('idle');
  const [sendProgress, setSendProgress] = useState({ total: 0, done: 0, success: 0, failed: 0, notified: 0 });
  const pauseRef = useRef(false);

  const handlePause = () => {
    pauseRef.current = true;
    showToast('正在暂停...当前批次发送完成后将自动停止', 'info');
  };

  // 校验 localStorage 中的待发数据是否还有效
  const [hasPendingData, setHasPendingData] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem('hongbao_center_pending');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.openids && data.openids.length > 0) {
          setHasPendingData(true);
          setSendPhase('paused');
          setSendProgress(prev => ({
            ...prev,
            total: prev.total || (data.totalCount || data.openids.length),
          }));
        }
      } catch { /* ignore */ }
    }
  }, []);

  const handleResume = () => {
    const saved = localStorage.getItem('hongbao_center_pending');
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      if (!data.openids || data.openids.length === 0) return;
      pauseRef.current = false;
      setSendPhase('sending');
      // 实际恢复由 SendTab 内部的 useEffect 通过 checkPendingResume 触发
      setHasPendingData(false); // 标记为"已触发恢复"
    } catch { /* ignore */ }
  };

  // 发送结束后清除
  const clearProgress = () => {
    setSendPhase('idle');
    setSendProgress({ total: 0, done: 0, success: 0, failed: 0, notified: 0 });
    localStorage.removeItem('hongbao_center_pending');
    setHasPendingData(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('records')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'records'
              ? 'bg-white text-blue-600 border border-gray-200 border-b-white -mb-px'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Gift className="w-4 h-4 inline mr-1.5" />
          发放记录
        </button>
        <button
          onClick={() => setActiveTab('send')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'send'
              ? 'bg-white text-blue-600 border border-gray-200 border-b-white -mb-px'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Send className="w-4 h-4 inline mr-1.5" />
          发放红包
        </button>
      </div>

      {activeTab === 'records' ? <RecordsTab /> : (
        <SendTab
          sendPhase={sendPhase}
          setSendPhase={setSendPhase}
          sendProgress={sendProgress}
          setSendProgress={setSendProgress}
          pauseRef={pauseRef}
          hasPendingData={hasPendingData}
          onResumeTriggered={() => setHasPendingData(false)}
        />
      )}

      {/* 底部进度卡 — 跨 Tab 可见 */}
      {sendPhase !== 'idle' && (
        <div className={`px-6 py-3 rounded-lg border ${
          sendPhase === 'done' ? 'bg-green-50 border-green-200' :
          sendPhase === 'paused' ? 'bg-orange-50 border-orange-200' :
          'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`text-sm font-medium ${
                sendPhase === 'done' ? 'text-green-700' :
                sendPhase === 'paused' ? 'text-orange-700' :
                'text-blue-700'
              }`}>
                {sendPhase === 'done' ? '✅ 红包发放完成' : sendPhase === 'paused' ? '⏸️ 红包发放已暂停' : (
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    正在发放红包...
                  </span>
                )}
              </div>
              <div className={`text-sm font-semibold ${
                sendPhase === 'done' ? 'text-green-700' :
                sendPhase === 'paused' ? 'text-orange-700' :
                'text-blue-700'
              }`}>
                {sendProgress.done} / {sendProgress.total}
                <span className="text-xs ml-1 opacity-75">
                  ({sendProgress.total > 0 ? Math.round((sendProgress.done / sendProgress.total) * 100) : 0}%)
                </span>
              </div>
              <span className="text-xs text-gray-500">
                成功 <span className="font-semibold text-green-600">{sendProgress.success}</span>
                {' '}失败 <span className="font-semibold text-red-600">{sendProgress.failed}</span>
                {sendProgress.notified > 0 && (
                  <> {' '}通知 <span className="font-semibold text-yellow-600">{sendProgress.notified}</span></>
                )}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {/* 进度条 */}
              <div className={`w-48 rounded-full h-2 overflow-hidden ${
                sendPhase === 'done' ? 'bg-green-100' :
                sendPhase === 'paused' ? 'bg-orange-100' :
                'bg-blue-100'
              }`}>
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    sendPhase === 'done' ? 'bg-green-500' :
                    sendPhase === 'paused' ? 'bg-orange-400' :
                    'bg-blue-500'
                  }`}
                  style={{ width: `${sendProgress.total > 0 ? Math.round((sendProgress.done / sendProgress.total) * 100) : 0}%` }}
                />
              </div>
              {/* 暂停 / 继续按钮 */}
              {sendPhase === 'sending' && (
                <button
                  onClick={handlePause}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-orange-100 text-orange-600 rounded hover:bg-orange-200 transition"
                >
                  <Pause className="w-3 h-3" /> 暂停
                </button>
              )}
              {sendPhase === 'paused' && (
                <button
                  onClick={handleResume}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-600 rounded hover:bg-green-200 transition"
                >
                  <Play className="w-3 h-3" /> 继续
                </button>
              )}
              {sendPhase === 'done' && (
                <button
                  onClick={clearProgress}
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  清除
                </button>
              )}
            </div>
          </div>
          {sendPhase === 'paused' && sendProgress.total > sendProgress.done && (
            <p className="mt-1 text-xs text-orange-500">
              剩余 {sendProgress.total - sendProgress.done} 人未发放
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ======================== 发放记录 Tab ========================
function RecordsTab() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(30);
  const [filters, setFilters] = useState({ status: '', keyword: '', projectId: '' });
  const [inputKeyword, setInputKeyword] = useState('');
  const [inputProjectId, setInputProjectId] = useState('');

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const result = await hongbaoCenterApi.list({
        page,
        pageSize,
        status: filters.status || undefined,
        keyword: filters.keyword || undefined,
        projectId: filters.projectId || undefined,
      });
      setRecords(result.data || []);
      setTotal(result.total || 0);
    } catch {
      setRecords([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleSearch = () => {
    setFilters(prev => ({ ...prev, keyword: inputKeyword, projectId: inputProjectId }));
    setPage(1);
  };

  const handleExport = async () => {
    try {
      const url = hongbaoCenterApi.exportUrl({
        status: filters.status || undefined,
        keyword: filters.keyword || undefined,
        projectId: filters.projectId || undefined,
      });
      const token = localStorage.getItem('auth_token');
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: '导出失败' }));
        showToast(err.message || '导出失败', 'error');
        return;
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `红包记录_${new Date().toISOString().substring(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch {
      showToast('导出失败', 'error');
    }
  };

  const statusZh = (s: string) => {
    switch (s) {
      case 'success': return '成功';
      case 'failed': return '失败';
      case 'notified': return '已通知';
      case 'pending': return '处理中';
      default: return s;
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* 搜索栏 */}
      <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filters.status}
            onChange={e => { setFilters(prev => ({ ...prev, status: e.target.value })); setPage(1); }}
            className="border border-gray-200 rounded px-3 py-1.5 text-sm text-gray-600"
          >
            <option value="">全部状态</option>
            <option value="success">成功</option>
            <option value="failed">失败</option>
            <option value="notified">已通知</option>
            <option value="pending">处理中</option>
          </select>
        </div>
        <input
          type="text"
          placeholder="项目ID（可选）"
          value={inputProjectId}
          onChange={e => setInputProjectId(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
          className="border border-gray-200 rounded px-3 py-1.5 text-sm w-48"
        />
        <input
          type="text"
          placeholder="搜索 openid / 订单号"
          value={inputKeyword}
          onChange={e => setInputKeyword(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
          className="border border-gray-200 rounded px-3 py-1.5 text-sm w-48"
        />
        <button
          onClick={handleSearch}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          搜索
        </button>
        <div className="flex-1" />
        <button
          onClick={fetchRecords}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
        <button
          onClick={handleExport}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 border border-green-200 rounded hover:bg-green-50 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          导出CSV
        </button>
      </div>

      {/* 表格 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              <th className="px-6 py-3 font-medium text-gray-500 w-16">序号</th>
              <th className="px-6 py-3 font-medium text-gray-500">项目</th>
              <th className="px-6 py-3 font-medium text-gray-500">OpenID</th>
              <th className="px-6 py-3 font-medium text-gray-500">金额</th>
              <th className="px-6 py-3 font-medium text-gray-500">状态</th>
              <th className="px-6 py-3 font-medium text-gray-500">备注</th>
              <th className="px-6 py-3 font-medium text-gray-500">订单号</th>
              <th className="px-6 py-3 font-medium text-gray-500">错误信息</th>
              <th className="px-6 py-3 font-medium text-gray-500">时间</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-gray-400">
                  <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
                  加载中...
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-gray-400">暂无记录</td>
              </tr>
            ) : (
              records.map((r: any, i: number) => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-2 text-gray-400">{(page - 1) * pageSize + i + 1}</td>
                  <td className="px-6 py-2">
                    {r.projectCode ? (
                      <span className="text-blue-600 text-xs font-mono">{r.projectCode}</span>
                    ) : (
                      <span className="text-orange-500 text-xs font-medium">无项目关联</span>
                    )}
                  </td>
                  <td className="px-6 py-2 font-mono text-xs text-gray-600">{r.openid?.substring(0, 12)}...</td>
                  <td className="px-6 py-2 font-semibold text-gray-800">
                    ¥{r.amountYuan ?? (r.amount / 100).toFixed(2)}
                  </td>
                  <td className="px-6 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      r.status === 'success' ? 'bg-green-100 text-green-700' :
                      r.status === 'failed' ? 'bg-red-100 text-red-700' :
                      r.status === 'notified' ? 'bg-yellow-100 text-yellow-700' :
                      r.status === 'pending' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {statusZh(r.status)}
                    </span>
                  </td>
                  <td className="px-6 py-2 text-xs text-gray-600 max-w-[120px] truncate" title={r.remark || ''}>
                    {r.remark || '-'}
                  </td>
                  <td className="px-6 py-2 font-mono text-xs text-gray-400">
                    {r.outBillNo?.substring(0, 16)}...
                  </td>
                  <td className="px-6 py-2 text-xs text-gray-400 max-w-[120px] truncate" title={r.errorMsg}>
                    {r.errorMsg || '-'}
                  </td>
                  <td className="px-6 py-2 text-xs text-gray-400">
                    {r.sentAt ? new Date(r.sentAt).toLocaleString('zh-CN') : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between text-sm">
          <span className="text-gray-400">共 {total} 条记录</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-200 rounded text-gray-600 disabled:opacity-30 hover:bg-gray-50"
            >
              上一页
            </button>
            <span className="px-3 text-gray-500">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 border border-gray-200 rounded text-gray-600 disabled:opacity-30 hover:bg-gray-50"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ======================== 发放红包 Tab ========================
function SendTab({
  sendPhase,
  setSendPhase,
  sendProgress,
  setSendProgress,
  pauseRef,
  hasPendingData,
  onResumeTriggered,
}: {
  sendPhase: 'idle' | 'sending' | 'paused' | 'done';
  setSendPhase: (v: 'idle' | 'sending' | 'paused' | 'done') => void;
  sendProgress: { total: number; done: number; success: number; failed: number; notified: number };
  setSendProgress: (v: { total: number; done: number; success: number; failed: number; notified: number }) => void;
  pauseRef: React.MutableRefObject<boolean>;
  hasPendingData: boolean;
  onResumeTriggered: () => void;
}) {
  const [mode, setMode] = useState<'total_to_average' | 'average_to_total'>('total_to_average');
  const [inputValue, setInputValue] = useState('');
  const [openidsText, setOpenidsText] = useState('');
  const [projectId, setProjectId] = useState('');
  const [remark, setRemark] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<any>(null);
  const [sendLog, setSendLog] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const allResultsRef = useRef<any[]>([]);
  const prevPhaseRef = useRef(sendPhase);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    projectApi.list().then((res: any) => {
      setProjects(res.data || res.projects || res as any[] || []);
    }).catch(() => {});
  }, []);

  // 读取 localStorage 恢复表单和进度
  useEffect(() => {
    if (!hasPendingData) return;
    const saved = localStorage.getItem('hongbao_center_pending');
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      if (data.openidsText) setOpenidsText(data.openidsText);
      if (data.projectId) setProjectId(data.projectId);
      if (data.remark) setRemark(data.remark);
      if (data.mode) setMode(data.mode);
      // 恢复金额（用 total_to_average 模式）
      if (data.totalAmount) {
        setMode('total_to_average');
        setInputValue(String(data.totalAmount));
      }
      if (data.amount) setInputValue(String(data.amount));
      // 恢复进度
      if (data.totalCount) {
        setSendProgress({
          total: data.totalCount,
          done: data.totalCount - data.openids.length,
          success: data.accumulatedSuccess || 0,
          failed: data.accumulatedFailed || 0,
          notified: data.accumulatedNotified || 0,
        });
      }
      allResultsRef.current = data.previousResults || [];
      setSendLog(data.previousResults || []);
    } catch { /* ignore */ }
  }, [hasPendingData]);

  // 父组件点击"继续"后触发恢复发送（仅当 paused→sending 时才执行）
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = sendPhase;
    // 只有从 paused 切换到 sending 才是恢复操作（首次发送是 idle→sending）
    if (prev !== 'paused' || sendPhase !== 'sending') return;

    const saved = localStorage.getItem('hongbao_center_pending');
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      if (!data.openids || data.openids.length === 0) return;
      onResumeTriggered();
      setSending(true);
      // 启动恢复发送
      runChunkedSend(
        data.openids, 0,
        data.accumulatedSuccess || 0,
        data.accumulatedFailed || 0,
        data.accumulatedNotified || 0,
        data.totalCount || data.openids.length,
      );
    } catch { /* ignore */ }
  }, [sendPhase]);

  // 解析并校验 openid 列表（微信 openid：28位，以 o 开头）
  const rawOpenids = openidsText
    .split(/[\n,，]+/)
    .map(s => s.trim())
    .filter(Boolean);
  const validOpenids = rawOpenids.filter((s) => /^o[\w-]{27}$/.test(s));
  const invalidOpenids = rawOpenids.filter((s) => !/^o[\w-]{27}$/.test(s));

  const count = validOpenids.length;
  const amount = parseFloat(inputValue) || 0;

  // 计算人均和总金额
  const perAmount = mode === 'total_to_average' && count > 0
    ? amount / count
    : mode === 'average_to_total'
    ? amount
    : 0;
  const totalAmount = mode === 'average_to_total' && count > 0
    ? amount * count
    : mode === 'total_to_average'
    ? amount
    : 0;

  // 分块发送核心函数
  const runChunkedSend = async (
    openidList: string[],
    startIndex: number,
    accSuccess: number,
    accFailed: number,
    accNotified: number,
    totalCount: number,
  ) => {
    if (!isMountedRef.current) return;
    const CHUNK_SIZE = 10;
    const DELAY = 500;
    let success = accSuccess;
    let failed = accFailed;
    let notified = accNotified;

    for (let i = startIndex; i < openidList.length; i += CHUNK_SIZE) {
      // 组件卸载立即停止
      if (!isMountedRef.current) return;
      // 暂停检查
      if (pauseRef.current) {
        const remaining = openidList.slice(i);
        localStorage.setItem('hongbao_center_pending', JSON.stringify({
          openids: remaining,
          amount: perAmount,
          totalAmount,
          projectId,
          remark,
          mode,
          openidsText,
          totalCount,
          accumulatedSuccess: success,
          accumulatedFailed: failed,
          accumulatedNotified: notified,
          previousResults: allResultsRef.current,
        }));
        setSendPhase('paused');
        setSending(false);
        return;
      }

      const chunk = openidList.slice(i, i + CHUNK_SIZE);
      let chunkResult;
      try {
        chunkResult = await hongbaoCenterApi.sendBatch({
          openids: chunk,
          amount: Number(perAmount.toFixed(2)),
          projectId: projectId || undefined,
          remark: remark || undefined,
        });
      } catch (err: any) {
        chunkResult = {
          total: chunk.length,
          success: 0,
          failed: chunk.length,
          notified: 0,
          results: chunk.map((o: string) => ({ openid: o, errcode: -1, errmsg: err?.message || '批次请求失败' })),
        };
      }

      success += chunkResult.success || 0;
      failed += chunkResult.failed || 0;
      notified += chunkResult.notified || 0;
      const done = Math.min(i + CHUNK_SIZE, openidList.length);

      allResultsRef.current.push(...(chunkResult.results || []));
      setSendLog([...allResultsRef.current]);
      setSendProgress({ total: totalCount, done, success, failed, notified });

      // 批次间隔
      if (i + CHUNK_SIZE < openidList.length) {
        await new Promise(r => setTimeout(r, DELAY));
      }
    }

    // 全部发完
    localStorage.removeItem('hongbao_center_pending');
    allResultsRef.current = [];
    setSendPhase('done');
    setSending(false);
    setSendLog([]);
    setSendResult({ total: totalCount, success, failed, notified });
    showToast(`发放完成：${success} 成功 / ${failed} 失败`, failed > 0 ? 'warning' : 'success');
  };

  const handleSend = async () => {
    if (sending) return;
    if (validOpenids.length === 0) { showToast('请输入至少一个有效的 openid', 'warning'); return; }
    if (!amount || amount <= 0) { showToast('金额必须大于 0', 'warning'); return; }
    if (!await showConfirm(`确认发放红包？\n\n人数：${count} 人\n人均：¥${perAmount.toFixed(2)}\n总金额：¥${totalAmount.toFixed(2)}${remark ? `\n备注：${remark}` : ''}`)) return;

    setSending(true);
    setSendPhase('sending');
    setSendResult(null);
    setSendLog([]);
    allResultsRef.current = [];
    pauseRef.current = false;
    setSendProgress({ total: count, done: 0, success: 0, failed: 0, notified: 0 });

    await runChunkedSend(validOpenids, 0, 0, 0, 0, count);
  };

  const resetForm = () => {
    if (sending) return;
    setInputValue('');
    setOpenidsText('');
    setProjectId('');
    setRemark('');
    setSendResult(null);
    setSendLog([]);
    allResultsRef.current = [];
    localStorage.removeItem('hongbao_center_pending');
  };

  const isDisabled = sending || sendPhase === 'sending';

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 max-w-2xl">
      <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
        <Send className="w-4 h-4 text-blue-500" />
        批量发放红包
      </h3>
      <p className="text-xs text-gray-400 mb-5">
        适用于活动奖励、补偿、补发等场景。可关联已有项目，也可不关联。
      </p>

      <div className="space-y-4">
        {/* 计算方式 */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">计算方式</label>
          <div className="flex gap-2">
            <button
              onClick={() => !isDisabled && setMode('total_to_average')}
              disabled={isDisabled}
              className={`flex-1 px-3 py-2 text-sm rounded border transition-colors ${
                mode === 'total_to_average'
                  ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50'
              }`}
            >
              总金额 → 人均
            </button>
            <button
              onClick={() => !isDisabled && setMode('average_to_total')}
              disabled={isDisabled}
              className={`flex-1 px-3 py-2 text-sm rounded border transition-colors ${
                mode === 'average_to_total'
                  ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50'
              }`}
            >
              人均 → 总金额
            </button>
          </div>
        </div>

        {/* 金额输入 */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {mode === 'total_to_average' ? '总金额（元）' : '人均金额（元）'}
            <span className="text-red-500"> *</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">¥</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={inputValue}
              onChange={e => !isDisabled && setInputValue(e.target.value)}
              disabled={isDisabled}
              placeholder={mode === 'total_to_average' ? '输入总金额' : '输入人均金额'}
              className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded text-sm focus:border-blue-400 focus:outline-none disabled:bg-gray-100 disabled:opacity-50"
            />
          </div>
        </div>

        {/* OpenID 批量输入 */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            用户 OpenID <span className="text-red-500">*</span>
            <span className="text-gray-400 font-normal ml-2">多个用换行或逗号分隔，支持从 Excel 粘贴</span>
          </label>
          <textarea
            value={openidsText}
            onChange={e => !isDisabled && setOpenidsText(e.target.value)}
            disabled={isDisabled}
            placeholder={`例如（28位，以o开头）：
oABC12345678901234567890123
oDEF78901234567890123456789`}
            rows={6}
            className="w-full p-3 border border-gray-200 rounded text-sm font-mono focus:border-blue-400 focus:outline-none resize-y disabled:bg-gray-100 disabled:opacity-50"
          />
          {rawOpenids.length > 0 && (
            <div className="mt-2 text-xs">
              <span className="text-gray-500">
                有效 <span className="font-semibold text-green-600">{count}</span> 人
                {invalidOpenids.length > 0 && (
                  <span className="ml-2 text-orange-600">
                    ⚠ 无效 <span className="font-semibold">{invalidOpenids.length}</span> 条：
                    <span className="font-mono ml-1">{invalidOpenids.slice(0, 5).join(', ')}{invalidOpenids.length > 5 ? '…' : ''}</span>
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* 关联项目 */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">关联项目（可选）</label>
          <select
            value={projectId}
            onChange={e => !isDisabled && setProjectId(e.target.value)}
            disabled={isDisabled}
            className="w-full border border-gray-200 rounded px-3 py-2 text-sm text-gray-600 focus:border-blue-400 focus:outline-none disabled:bg-gray-100 disabled:opacity-50"
          >
            <option value="">不关联项目</option>
            {projects.map((p: any) => (
              <option key={p.id} value={p.id}>{p.project_code || p.id} - {p.name || '(未命名)'}</option>
            ))}
          </select>
        </div>

        {/* 备注 */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">备注（用户可见）</label>
          <input
            type="text"
            value={remark}
            onChange={e => !isDisabled && setRemark(e.target.value)}
            disabled={isDisabled}
            placeholder="如：活动奖励 / 补偿发放"
            className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:border-blue-400 focus:outline-none disabled:bg-gray-100 disabled:opacity-50"
          />
        </div>

        {/* 预览卡片 */}
        {count > 0 && amount > 0 && (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-xs text-gray-400">发放人数</div>
              <div className="text-lg font-bold text-gray-800">{count} 人</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-400">人均金额</div>
              <div className="text-lg font-bold text-blue-600">¥{perAmount.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-400">预计总支出</div>
              <div className="text-lg font-bold text-orange-600">¥{totalAmount.toFixed(2)}</div>
            </div>
          </div>
        )}

        {/* 按钮 */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSend}
            disabled={isDisabled || count === 0 || amount <= 0}
            className="flex-1 px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {isDisabled ? (
              <><RefreshCw className="w-4 h-4 animate-spin" />发放中...</>
            ) : (
              <><Send className="w-4 h-4" />确认发放</>
            )}
          </button>
          <button
            onClick={resetForm}
            disabled={isDisabled}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            重置
          </button>
        </div>
      </div>

      {/* 发送结果 */}
      {sendResult && (
        <div className={`mt-5 p-4 rounded-lg border text-sm ${
          sendResult.failed > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'
        }`}>
          <div className="font-medium mb-2">
            发放完成：{sendResult.success} 成功 / {sendResult.failed} 失败 / {sendResult.total} 总计
            {sendResult.notified > 0 && <span className="text-yellow-600 ml-2">({sendResult.notified} 通知待领取)</span>}
          </div>
          {sendResult.results && sendResult.results.length > 0 && (
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {sendResult.results.map((r: any, i: number) => (
                <div
                  key={i}
                  className={`px-3 py-1.5 rounded text-xs font-mono flex items-center gap-2 ${
                    r.errcode === 0 ? 'bg-green-100' : 'bg-red-100'
                  }`}
                >
                  <span className={r.errcode === 0 ? 'text-green-600' : 'text-red-600'}>
                    {r.errcode === 0 ? '✓' : '✗'}
                  </span>
                  <span className="text-gray-600 truncate flex-1">{r.openid}</span>
                  <span className="text-gray-400">{(r.errmsg || '').substring(0, 30)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 实时发送日志（发送进行中时显示） */}
      {sendPhase === 'sending' && sendLog.length > 0 && (
        <div className="mt-4 p-4 rounded-lg border border-blue-200 bg-blue-50 text-sm">
          <div className="font-medium text-blue-700 mb-2">实时进度：{sendLog.length} 条已处理</div>
          <div className="max-h-[200px] overflow-y-auto space-y-1">
            {sendLog.slice(-20).map((r: any, i: number) => (
              <div
                key={i}
                className={`px-3 py-1 rounded text-xs font-mono flex items-center gap-2 ${
                  r.errcode === 0 ? 'bg-green-100' : r.errcode === -1 ? 'bg-orange-100' : 'bg-red-100'
                }`}
              >
                <span className={r.errcode === 0 ? 'text-green-600' : 'text-red-600'}>
                  {r.errcode === 0 ? '✓' : '✗'}
                </span>
                <span className="text-gray-600 truncate flex-1">{r.openid?.substring(0, 12)}...</span>
                <span className="text-gray-400 text-xs">{(r.errmsg || '').substring(0, 25)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

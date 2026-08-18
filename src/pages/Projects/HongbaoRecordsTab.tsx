/**
 * 红包记录 Tab - 6 张统计卡片 + 过滤 + 列表 + 导出 + 单条重试
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Download, RefreshCw, Search, Copy, AlertCircle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { hongbaoApi } from '../../services/api';
import { showToast, showConfirm } from '../../components/Toast';
import { Project } from '../../types/types';

type StatusFilter = 'all' | 'success' | 'notified' | 'failed' | 'pending';


interface HongbaoRecord {
  id: string;
  projectId: string;
  openid: string;
  amount: number;            // 分
  amountYuan: number;
  actualAmount: number | null;
  actualAmountYuan: number | null;
  status: 'success' | 'notified' | 'failed' | 'pending';
  remark: string | null;
  claimStatus: string | null;
  errorCode: string | null;
  errorMsg: string | null;
  retryCount: number;
  outBillNo: string;
  transferBillNo: string | null;
  sentAt: string;
  completedAt: string | null;
}

interface Statistics {
  totalAmount: number;
  totalCount: number;
  successAmount: number;
  successCount: number;
  notifiedAmount: number;
  notifiedCount: number;
  failedAmount: number;
  failedCount: number;
}

interface Props {
  project: Project;
}

export default function HongbaoRecordsTab({ project }: Props) {
  const [records, setRecords] = useState<HongbaoRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0); // 「全部」总数，首次加载后不变
  // 每个状态的记录总数缓存（从列表 API 获取，切走不丢）
  const [statusTotals, setStatusTotals] = useState<Record<StatusFilter, number>>({
    all: 0, success: 0, notified: 0, failed: 0,
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [keyword, setKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [batchRetrying, setBatchRetrying] = useState(false);

  // 搜索 debounce
  useEffect(() => {
    const t = setTimeout(() => setKeyword(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // 加载列表
  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hongbaoApi.list(project.id, {
        page,
        pageSize,
        status: statusFilter === 'all' ? undefined : statusFilter,
        keyword: keyword || undefined,
      });
      setRecords(res.data || []);
      setTotal(res.total || 0);
      // 缓存当前筛选的 total，切到别的状态也不会丢
      setStatusTotals((prev) => ({
        ...prev,
        [statusFilter]: res.total || 0,
      }));
      // 首次无筛选加载时记下「全部」总数
      if (statusFilter === 'all' && !keyword) {
        setGrandTotal(res.total || 0);
      }
    } catch (e) {
      console.error('加载红包记录失败:', e);
    } finally {
      setLoading(false);
    }
  }, [project.id, page, pageSize, statusFilter, keyword]);

  // 加载统计
  const loadStats = useCallback(async () => {
    try {
      const s = await hongbaoApi.statistics(project.id);
      setStats(s);
    } catch (e) {
      console.error('加载统计失败:', e);
    }
  }, [project.id]);

  useEffect(() => { loadRecords(); }, [loadRecords]);
  useEffect(() => { loadStats(); }, [loadStats]);

  // 首次加载时并行拉取所有状态的 total，避免 stats 去重导致失败数为 0
  useEffect(() => {
    const loadAllTotals = async () => {
      const statuses: StatusFilter[] = ['success', 'notified', 'failed'];
      const results = await Promise.allSettled(
        statuses.map((s) =>
          hongbaoApi.list(project.id, { page: 1, pageSize: 1, status: s }),
        ),
      );
      setStatusTotals((prev) => {
        const next = { ...prev };
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            next[statuses[i]] = r.value.total || 0;
          }
        });
        return next;
      });
    };
    loadAllTotals();
  }, [project.id]);

  // 状态筛选标签上的数量
  // - 「全部」用首次加载的 grandTotal
  // - 当前选中状态用列表 total（与表格一致）
  // - 其他状态用预加载的 statusTotals（列表 API，不去重）
  const countByStatus = useMemo(() => {
    return {
      all: grandTotal || total,
      success: statusFilter === 'success' ? total : statusTotals.success,
      notified: statusFilter === 'notified' ? total : statusTotals.notified,
      failed: statusFilter === 'failed' ? total : statusTotals.failed,
    };
  }, [total, grandTotal, statusTotals, statusFilter]);

  // 复制到剪贴板
  const copy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  // 导出 CSV（带 auth token）
  const handleExport = async () => {
    try {
      const url = hongbaoApi.exportUrl(project.id, {
        status: statusFilter === 'all' ? undefined : statusFilter,
        keyword: keyword || undefined,
      });
      const token = localStorage.getItem('auth_token');
      const response = await fetch(url, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        showToast(`导出失败: ${response.status} ${text}`, 'error');
        return;
      }
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${project.name}_红包记录.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (e: any) {
      showToast(`导出失败: ${e.message}`, 'error');
    }
  };

  // 单条重试
  const handleRetry = async (record: HongbaoRecord) => {
    const amountYuan = record.amountYuan.toFixed(2);
    const remarkText = record.remark || '无备注';
    const confirmed = await showConfirm(
      `确认重新发送红包？\n\nopenid: ${record.openid}\n金额: ¥${amountYuan}\n备注: ${remarkText}`,
    );
    if (!confirmed) return;

    setRetryingId(record.id);
    try {
      const res = await hongbaoApi.retry(project.id, record.id);
      showToast(res.success ? '重试成功' : `重试失败：${res.errmsg || '未知错误'}`, res.success ? 'success' : 'error');
      loadRecords();
      loadStats();
    } catch (e: any) {
      showToast(`重试出错：${e?.message || '网络错误'}`, 'error');
    } finally {
      setRetryingId(null);
    }
  };

  // 批量重试失败项
  const handleBatchRetry = async () => {
    if (batchRetrying) return;  // ⚠️ 防双击
    const failedRecords = records.filter(r => r.status === 'failed');
    if (failedRecords.length === 0) {
      showToast('没有失败的红包记录', 'info');
      return;
    }
    const totalYuan = (failedRecords.reduce((sum, r) => sum + r.amount, 0) / 100).toFixed(2);
    const confirmed = await showConfirm(
      `确认批量重新发送 ${failedRecords.length} 笔失败红包？\n\n合计金额: ¥${totalYuan}\n\n将逐条重新发送，请确认`,
    );
    if (!confirmed) return;

    setBatchRetrying(true);
    let successCount = 0;
    let failCount = 0;
    for (const record of failedRecords) {
      try {
        const res = await hongbaoApi.retry(project.id, record.id);
        if (res.success) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }
    setBatchRetrying(false);
    showToast(`批量重试完成：成功 ${successCount} 笔，失败 ${failCount} 笔`, successCount > 0 ? 'success' : 'error');
    loadRecords();
    loadStats();
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      {/* ===== 统计卡片 ===== */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="应发金额" value={stats?.totalAmount ?? 0} suffix="元" color="blue" sub="项目预算" />
        <StatCard label="应发人数" value={stats?.totalCount ?? 0} suffix="人" color="gray" sub="应发总数" />
        <StatCard label="成功发放金额" value={stats?.successAmount ?? 0} suffix="元" color="green" sub="实际到账" />
        <StatCard label="成功发放人数" value={stats?.successCount ?? 0} suffix="人" color="green" sub="笔数" />
        <StatCard label="已通知待领取" value={stats?.notifiedAmount ?? 0} suffix="元" color="blue" sub={`${stats?.notifiedCount ?? 0} 人`} />
        <StatCard label="失败发放金额" value={stats?.failedAmount ?? 0} suffix="元" color="red" sub="待补发" />
      </div>

      {/* ===== 过滤工具栏 ===== */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          {(['all', 'success', 'notified', 'failed'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 text-sm rounded-md transition ${
                statusFilter === s
                  ? s === 'success' ? 'bg-green-100 text-green-700 font-medium'
                  : s === 'notified' ? 'bg-blue-100 text-blue-700 font-medium'
                  : s === 'failed' ? 'bg-red-100 text-red-700 font-medium'
                  : 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {s === 'all' ? '全部' : s === 'success' ? '✓ 成功' : s === 'notified' ? '🔔 已通知' : '✗ 失败'}
              <span className="ml-1 text-xs opacity-75">
                ({s === 'all' ? countByStatus.all : s === 'success' ? countByStatus.success : s === 'notified' ? countByStatus.notified : countByStatus.failed})
              </span>
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-[180px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="搜索 openid / 订单号 / 错误码"
            className="w-full pl-10 pr-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <select
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          className="px-2 py-1.5 border border-gray-300 rounded-md text-sm"
        >
          <option value={20}>20/页</option>
          <option value={50}>50/页</option>
          <option value={100}>100/页</option>
        </select>

        <button
          onClick={handleExport}
          disabled={total === 0}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition flex items-center gap-1.5 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          导出 CSV
        </button>

        {statusFilter === 'failed' && records.length > 0 && (
          <button
            onClick={handleBatchRetry}
            disabled={batchRetrying}
            className="px-3 py-1.5 bg-orange-600 text-white rounded-md text-sm hover:bg-orange-700 transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${batchRetrying ? 'animate-spin' : ''}`} />
            {batchRetrying ? '重试中...' : `批量重试 (${countByStatus.failed})`}
          </button>
        )}
      </div>

      {/* ===== 列表表格 ===== */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">加载中...</div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <div className="text-gray-500 text-sm">该项目还没有红包发放记录</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">#</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">openid</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-600">申请金额</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-600">实际金额</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">状态</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">备注</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">错误码</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">商户单号</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">微信单号</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">发送时间</th>
                  <th className="px-3 py-2.5 text-center font-semibold text-gray-600">重试</th>
                  <th className="px-3 py-2.5 text-center font-semibold text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-500">{(page - 1) * pageSize + idx + 1}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-700 max-w-[200px]">
                      <div className="flex items-center gap-1">
                        <span className="truncate" title={r.openid}>{r.openid}</span>
                        <button onClick={() => copy(r.openid)} className="text-gray-400 hover:text-blue-600 flex-shrink-0">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">¥{r.amountYuan.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.actualAmountYuan != null ? (
                        <span className="text-green-700">¥{r.actualAmountYuan.toFixed(2)}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.status === 'success' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                          <CheckCircle2 className="w-3 h-3" /> 成功
                        </span>
                      ) : r.status === 'notified' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                          <Clock className="w-3 h-3" /> {r.claimStatus === 'confirmed' ? '待回调' : '已通知'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                          <XCircle className="w-3 h-3" /> 失败
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 max-w-[120px] truncate" title={r.remark || ''}>
                      {r.remark || '-'}
                    </td>
                    <td className="px-3 py-2 text-xs text-red-600 max-w-[160px] truncate" title={r.errorMsg || ''}>
                      {r.errorCode || '-'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-600 max-w-[160px]">
                      <div className="flex items-center gap-1">
                        <span className="truncate" title={r.outBillNo}>{r.outBillNo}</span>
                        <button onClick={() => copy(r.outBillNo)} className="text-gray-400 hover:text-blue-600 flex-shrink-0">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-600 max-w-[160px]">
                      {r.transferBillNo ? (
                        <div className="flex items-center gap-1">
                          <span className="truncate" title={r.transferBillNo}>{r.transferBillNo}</span>
                          <button onClick={() => copy(r.transferBillNo!)} className="text-gray-400 hover:text-blue-600 flex-shrink-0">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      ) : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                      {r.sentAt.replace('T', ' ').substring(0, 19)}
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-gray-600">{r.retryCount}</td>
                    <td className="px-3 py-2 text-center">
                      {r.status === 'failed' ? (
                        <button
                          onClick={() => handleRetry(r)}
                          disabled={retryingId === r.id}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs hover:bg-blue-100 transition disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3 h-3 ${retryingId === r.id ? 'animate-spin' : ''}`} />
                          {retryingId === r.id ? '重试中' : '重新发送'}
                        </button>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== 分页 ===== */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div>共 {total} 条 · 第 {page} / {totalPages} 页</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              上一页
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, suffix, color, sub }: { label: string; value: number; suffix: string; color: 'blue' | 'gray' | 'green' | 'red'; sub: string }) {
  const colorMap: Record<string, string> = {
    blue: 'border-blue-200 bg-blue-50/30',
    gray: 'border-gray-200 bg-white',
    green: 'border-green-200 bg-green-50/30',
    red: 'border-red-200 bg-red-50/30',
  };
  const valueColor: Record<string, string> = {
    blue: 'text-blue-700',
    gray: 'text-gray-700',
    green: 'text-green-700',
    red: 'text-red-700',
  };
  return (
    <div className={`border ${colorMap[color]} rounded-lg p-4`}>
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${valueColor[color]} tabular-nums`}>
        {value.toFixed(2)}<span className="text-sm font-normal ml-0.5">{suffix}</span>
      </div>
      <div className="text-xs text-gray-400 mt-1">{sub}</div>
    </div>
  );
}

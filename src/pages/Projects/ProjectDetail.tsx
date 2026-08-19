import { useState, useMemo, useRef, useEffect } from 'react';
import { showToast, showConfirm as confirmDialog } from '../../components/Toast';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Settings,
  Database,
  Gift,
  Download,
  Users,
  TrendingUp,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Calculator,
  FileText,
  Send,
  Target,
  Calendar,
  Pause,
  Play,
  ChevronUp,
  ChevronDown,
  Wallet,
} from 'lucide-react';
import { Project, AnswerRecord, HongbaoConfig, QuotaItem } from '../../types/types';
import { projectApi, userApi, excludeApi, hongbaoApi } from '../../services/api';
// Mock 数据已移除，全部走真实 API
import * as XLSX from 'xlsx';
import EmptyState from '../../components/EmptyState/EmptyState';
import HongbaoRecordsTab from './HongbaoRecordsTab';

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  draft: { label: '草稿', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  pending: { label: '待发红包', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  pending_hongbao: { label: '待发红包', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  active: { label: '进行中', color: 'text-green-600', bgColor: 'bg-green-100' },
  in_progress: { label: '进行中', color: 'text-green-600', bgColor: 'bg-green-100' },
  completed: { label: '已完成', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  paused: { label: '暂停', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
};

/** 格式化为北京时间：06-17 19:53
 *  核心原理：new Date() 把任何格式（UTC/+08:00/无时区）都归一为 UTC epoch，
 *  再加 8 小时得到北京时间（用 getUTC* 方法读取，不依赖浏览器本地时区） */
function formatBJTime(dateStr: string | Date): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  // 取 UTC epoch，加 8 小时 = 北京时间
  const bj = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  const mo = String(bj.getUTCMonth() + 1).padStart(2, '0');
  const dy = String(bj.getUTCDate()).padStart(2, '0');
  const hh = String(bj.getUTCHours()).padStart(2, '0');
  const mm = String(bj.getUTCMinutes()).padStart(2, '0');
  return `${mo}-${dy} ${hh}:${mm}`;
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载项目详情
  useEffect(() => {
    if (!id) return;

    const loadProject = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const data = await projectApi.get(id);
        setProject(data);
      } catch (err: any) {
        console.error('加载项目失败:', err);
        setError(err.message || '加载失败');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">{error || '项目不存在'}</p>
          <button
            onClick={() => navigate('/projects')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            返回项目列表
          </button>
        </div>
      </div>
    );
  }

  // 草稿箱状态 - 直接跳转到新建页面继续编辑
  if (project.status === 'draft') {
    return <DraftProjectEdit project={project} navigate={navigate} />;
  }

  // 根据状态确定显示哪些 Tab
  const tabs = getTabsForStatus(project.status);

  // 切换项目状态（更新本地 state，不刷新页面，避免白屏）
  const handleProjectStatusChange = (newStatus: string) => {
    setProject((prev: any) => (prev ? { ...prev, status: newStatus } : prev));
  };

  return (
    <ProjectTabs
      project={project}
      tabs={tabs}
      navigate={navigate}
      onProjectUpdated={handleProjectStatusChange}
    />
  );
}

function getTabsForStatus(status: Project['status']) {
  const baseTabs = [{ key: 'settings', label: '基础设置', icon: Settings }];

  switch (status) {
    case 'active':
    case 'in_progress':
      // 进行中：基础设置 + 答题数据
      baseTabs.push({ key: 'answers', label: '答题数据', icon: Database });
      break;
    case 'pending_hongbao':
    case 'pending':
      // 待发红包：基础设置 + 答题数据 + 发红包
      baseTabs.push({ key: 'answers', label: '答题数据', icon: Database });
      baseTabs.push({ key: 'hongbao', label: '发红包', icon: Gift });
      break;
    case 'completed':
      // 已完成：基础设置 + 答题数据 + 红包记录
      baseTabs.push({ key: 'answers', label: '答题数据', icon: Database });
      baseTabs.push({ key: 'hongbao-records', label: '红包记录', icon: Wallet });
      break;
  }

  return baseTabs;
}

function DraftProjectEdit({ project, navigate }: { project: Project; navigate: any }) {
  // 草稿箱项目 - 跳转到新建项目页面继续编辑
  const handleContinueEdit = () => {
    navigate(`/projects/new?draftId=${project.id}`);
  };

  return (
    <div className="h-full flex flex-col">
      {/* 顶部导航 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_CONFIG.draft.bgColor} ${STATUS_CONFIG.draft.color}`}>
              {STATUS_CONFIG.draft.label}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5 font-mono">{project.project_code}</p>
        </div>
      </div>

      {/* 草稿箱提示 */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-lg text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">草稿项目</h2>
          <p className="text-gray-500 mb-6">
            此项目尚未完成创建，上次编辑停在第 <span className="font-bold text-gray-700">{project.draft_step || 1}</span> 步
          </p>
          <div className="space-y-3">
            <button
              onClick={handleContinueEdit}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium"
            >
              继续编辑
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full text-gray-500 hover:text-gray-700 px-6 py-2"
            >
              返回项目列表
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectTabs({
  project,
  tabs,
  navigate,
  onProjectUpdated,
}: {
  project: Project;
  tabs: any[];
  navigate: any;
  onProjectUpdated: (status: string) => void;
}) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.key || 'settings');
  const [answerRecords, setAnswerRecords] = useState<AnswerRecord[]>([]);
  const [recordsLoaded, setRecordsLoaded] = useState(false);
  const [answerPage, setAnswerPage] = useState(1);
  const [totalAnswerRecords, setTotalAnswerRecords] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  // 一次性加载全部答题记录，避免分页导致发红包时漏掉超出首屏的记录
  const pageSize = 10000;

  // 模板消息推送进度状态
  const [pushProgress, setPushProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [pushPhase, setPushPhase] = useState<'idle' | 'sending' | 'paused' | 'done'>('idle');
  const [pushPaused, setPushPaused] = useState(false);
  const pushPauseRef = useRef(false);

  // 进入页面时：恢复推送进度（页面刷新后）
  useEffect(() => {
    if (project.pendingOpenids) {
      try {
        const remaining: string[] = JSON.parse(project.pendingOpenids);
        if (remaining && remaining.length > 0) {
          // 从 sentSamples 推算已完成数
          const totalEstimate = (project.sent_samples || 0) + remaining.length;
          setPushProgress({ done: project.sent_samples || 0, total: totalEstimate });
          setPushPhase('paused');
          console.log(`[恢复推送进度] 剩余 ${remaining.length} 人待发送`);
        }
      } catch (e) {}
    }
  }, [project.pendingOpenids, project.sent_samples]);

  // 进入页面时自动加载答题记录
  useEffect(() => {
    loadAnswerRecords(1);
  }, [project.id]);

  const loadAnswerRecords = async (page: number) => {
    try {
      const result = await projectApi.getAnswerRecords(project.id, page, pageSize);
      setAnswerRecords(result.data || []);
      setTotalAnswerRecords(result.total || 0);
      setAnswerPage(page);
    } catch (err) {
      console.error('加载答题记录失败:', err);
    } finally {
      setRecordsLoaded(true);
    }
  };

  const totalPages = Math.ceil(totalAnswerRecords / pageSize);

  // 手动同步答题数据（从后端 answer_records 表拉取最新数据）
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await projectApi.getAnswerRecords(project.id, 1, 10000);
      setAnswerRecords(result.data || []);
      setTotalAnswerRecords(result.total || 0);
      setAnswerPage(1);

      const now = formatBJTime(new Date());
      setLastSyncTime(now);
      showToast(`同步完成！\n当前共 ${result.total || 0} 条答题记录（已按 openid 排重）\n同步时间：${now}`, 'success');
    } catch (err: any) {
      showToast(`同步失败: ${err.message || '网络错误'}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // 暂停发送（设置 ref 标志，前端分块循环检测到后自动停止）
  const handlePauseProject = async (id: string) => {
    pushPauseRef.current = true;
    try {
      await projectApi.update(id, { status: 'paused' });
    } catch (err: any) {
      showToast(`暂停失败: ${err.message || '网络错误'}`, 'error');
    }
    setPushPaused(true);
    showToast('已发送暂停请求，当前批次发送完成后将自动停止', 'success');
  };

  // 继续发送（前端分块续发，实时显示进度）
  const handleResumeProject = async (id: string) => {
    // 重新拉取最新项目数据，避免使用组件 props 中过期的 pendingOpenids 导致重复推送
    let latest = project;
    try {
      latest = await projectApi.get(id);
    } catch (e) {
      // 拉取失败时退回 props 数据，尽量续发
    }

    // 获取剩余 openids
    let remaining: string[] = [];
    if (latest.pendingOpenids) {
      try {
        remaining = JSON.parse(latest.pendingOpenids);
      } catch (e) {
        showToast('无法解析待发送列表', 'error');
        return;
      }
    }
    
    if (remaining.length === 0) {
      showToast('没有待发送的用户', 'warning');
      return;
    }
    
    // 恢复状态
    try {
      await projectApi.update(id, { status: 'in_progress' });
    } catch (e: any) {
      showToast(`恢复状态失败: ${e.message}`, 'error');
      return;
    }
    
    // 开始分块发送
    const CHUNK_SIZE = 20;
    let successCount = 0;
    let failCount = 0;
    pushPauseRef.current = false;
    setPushPaused(false);
    setPushPhase('sending');
    setPushProgress({ done: pushProgress.done, total: pushProgress.total || remaining.length });
    
    for (let i = 0; i < remaining.length; i += CHUNK_SIZE) {
      // 检查暂停
      if (pushPauseRef.current) {
        const left = remaining.slice(i);
        try {
          await projectApi.update(id, { status: 'paused', pendingOpenids: JSON.stringify(left) });
          setPushPhase('paused');
          showToast(`⏸️ 已暂停\n已发: ${successCount}，剩余: ${left.length}`, 'success');
        } catch {}
        return;
      }
      
      const chunk = remaining.slice(i, Math.min(i + CHUNK_SIZE, remaining.length));
      try {
        const result: any = await projectApi.sendTemplate(id, chunk);
        successCount += result.success || 0;
        failCount += result.failed || 0;
        
        const doneSoFar = pushProgress.done + successCount;
        setPushProgress({ done: doneSoFar, total: pushProgress.total || remaining.length });
        
        const left = remaining.slice(i + CHUNK_SIZE);
        try {
          await projectApi.update(id, { pendingOpenids: JSON.stringify(left) });
        } catch {}
      } catch (e: any) {
        failCount += chunk.length;
      }
    }
    
    // 全部完成
    setPushPhase('done');
    setPushProgress({ done: pushProgress.total || remaining.length, total: pushProgress.total || remaining.length });
    try {
      await projectApi.update(id, { status: 'in_progress', pendingOpenids: JSON.stringify([]) });
    } catch {}
    
    if (failCount === 0) {
      showToast(`✅ 全部发送完成！共 ${successCount + pushProgress.done} 人`, 'success');
    } else {
      showToast(`⚠️ 发送完成\n成功: ${successCount}，失败: ${failCount}`, 'warning');
    }
  };

  // 按 openid 排重，保留最后答题记录
  const uniqueAnswers = useMemo(() => {
    const openidMap = new Map<string, AnswerRecord>();
    answerRecords.forEach((record) => {
      const existing = openidMap.get(record.openid);
      if (!existing || new Date(record.answer_time) > new Date(existing.answer_time)) {
        openidMap.set(record.openid, record);
      }
    });
    return Array.from(openidMap.values());
  }, [answerRecords]);

  return (
    <div className="h-full flex flex-col">
      {/* 顶部导航 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_CONFIG[project.status].bgColor} ${STATUS_CONFIG[project.status].color}`}>
              {STATUS_CONFIG[project.status].label}
            </span>
            {/* 暂停 / 继续发送按钮 */}
            {project.status === 'in_progress' || project.status === 'active' ? (
              <button
                onClick={() => handlePauseProject(project.id)}
                className="px-3 py-1.5 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition flex items-center gap-1.5"
              >
                <Pause className="w-3.5 h-3.5" />
                暂停发送
              </button>
            ) : project.status === 'paused' ? (
              <button
                onClick={() => handleResumeProject(project.id)}
                className="px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                继续发送
              </button>
            ) : null}
          </div>
          <p className="text-sm text-gray-500 mt-0.5 font-mono">{project.project_code}</p>
        </div>
      </div>

      {/* Tab 导航 */}
      <div className="bg-white border-b border-gray-200 px-6">
        <nav className="flex gap-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-3 flex items-center gap-2 text-sm font-medium border-b-2 transition ${
                activeTab === key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-auto p-6 bg-gray-50">
        {activeTab === 'settings' && <SettingsTab project={project} />}
        {activeTab === 'answers' && (
          <AnswersTab
            project={project}
            answerRecords={uniqueAnswers}
            isSyncing={isSyncing}
            lastSyncTime={lastSyncTime}
            handleSync={handleSync}
            answerPage={answerPage}
            pageSize={pageSize}
            totalPages={totalPages}
            totalAnswerRecords={totalAnswerRecords}
            loadAnswerRecords={loadAnswerRecords}
            onProjectUpdated={onProjectUpdated}
          />
        )}
        {activeTab === 'hongbao' && (
          <HongbaoTab project={project} answerRecords={uniqueAnswers} />
        )}
        {activeTab === 'export' && <ExportTab project={project} answerRecords={uniqueAnswers} />}
        {activeTab === 'hongbao-records' && <HongbaoRecordsTab project={project} />}
      </div>

      {/* 页面底部推送进度卡（页面刷新后自动恢复、关闭弹窗后仍可见） */}
      {pushPhase !== 'idle' && (
        <div className={`px-6 py-3 border-t ${pushPhase === 'done' ? 'bg-green-50 border-green-200' : pushPhase === 'paused' ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`text-sm font-medium ${pushPhase === 'done' ? 'text-green-700' : pushPhase === 'paused' ? 'text-orange-700' : 'text-blue-700'}`}>
                {pushPhase === 'done' ? '✅ 模板消息发送完成' : pushPhase === 'paused' ? '⏸️ 模板消息发送已暂停' : (
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    正在发送模板消息...
                  </span>
                )}
              </div>
              <div className={`text-sm font-semibold ${pushPhase === 'done' ? 'text-green-700' : pushPhase === 'paused' ? 'text-orange-700' : 'text-blue-700'}`}>
                {pushProgress.done} / {pushProgress.total}
                <span className="text-xs ml-1 opacity-75">
                  ({pushProgress.total > 0 ? Math.round((pushProgress.done / pushProgress.total) * 100) : 0}%)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* 进度条 */}
              <div className={`w-48 rounded-full h-2 overflow-hidden ${pushPhase === 'done' ? 'bg-green-100' : pushPhase === 'paused' ? 'bg-orange-100' : 'bg-blue-100'}`}>
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${pushPhase === 'done' ? 'bg-green-500' : pushPhase === 'paused' ? 'bg-orange-400' : 'bg-blue-500'}`}
                  style={{ width: `${pushProgress.total > 0 ? Math.round((pushProgress.done / pushProgress.total) * 100) : 0}%` }}
                />
              </div>
              {/* 暂停/继续按钮 */}
              {pushPhase === 'sending' && !pushPaused && (
                <button
                  onClick={() => {
                    pushPauseRef.current = true;
                    setPushPaused(true);
                    // 暂停后的 pendingOpenids 由分块循环自动保存
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-orange-100 text-orange-600 rounded hover:bg-orange-200 transition"
                >
                  <Pause className="w-3 h-3" /> 暂停
                </button>
              )}
              {pushPhase === 'paused' && (
                <button
                  onClick={() => handleResumeProject(project.id)}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-600 rounded hover:bg-green-200 transition"
                >
                  <Play className="w-3 h-3" /> 继续
                </button>
              )}
            </div>
          </div>
          {pushPhase === 'paused' && (
            <div className="max-w-5xl mx-auto mt-1">
              <p className="text-xs text-orange-500">
                剩余 {pushProgress.total - pushProgress.done} 人未发送
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SettingsTab({ project }: { project: Project }) {
  // 按维度分组配额数据
  const quotasByDimension = project.quotas.reduce((acc, item) => {
    if (!acc[item.dimension_key]) {
      acc[item.dimension_key] = {
        label: item.dimension_label,
        items: [],
      };
    }
    acc[item.dimension_key].items.push(item);
    return acc;
  }, {} as Record<string, { label: string; items: QuotaItem[] }>);

  // 维度中文名映射
  const dimensionLabels: Record<string, string> = {
    gender: '性别',
    age: '年龄',
    region: '地区',
    industry: '行业',
    occupation: '职业',
    income: '收入',
    education: '学历',
    city_level: '城市级别',
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* 项目基础信息 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-6">项目基础信息</h2>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">项目编号</label>
              <p className="text-gray-900 font-mono">{project.project_code}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">项目名称</label>
              <p className="text-gray-900">{project.name}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">问卷链接</label>
              <a
                href={project.survey_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {project.survey_link}
              </a>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">问卷主题</label>
              <p className="text-gray-900">{project.survey_subject || project.name}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">开始时间</label>
              <p className="text-gray-900">{formatBJTime(project.start_time)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">结束时间</label>
              <p className="text-gray-900">{formatBJTime(project.end_time)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 项目配额情况 - 仅自动抽样投放项目显示 */}
      {project.sampling_mode !== 'manual' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Target className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">项目配额情况</h2>
          </div>

          {project.quotas.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>暂无配额数据</p>
            </div>
          ) : (
            <>
              {/* 汇总信息 */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <div className="text-sm text-blue-600 mb-1">目标投放总量</div>
                  <div className="text-2xl font-bold text-blue-700">{project.total_samples.toLocaleString()}</div>
                  <div className="text-xs text-blue-500 mt-1">人</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                  <div className="text-sm text-green-600 mb-1">抽样维度</div>
                  <div className="text-2xl font-bold text-green-700">{project.selected_dimensions.length}</div>
                  <div className="text-xs text-green-500 mt-1">个维度</div>
                </div>
              </div>

              {/* 已选维度标签 */}
              <div className="mb-4">
                <div className="text-sm font-medium text-gray-700 mb-2">已选维度：</div>
                <div className="flex flex-wrap gap-2">
                  {project.selected_dimensions.map((dim) => (
                    <span
                      key={dim}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-medium"
                    >
                      {dimensionLabels[dim] || dim}
                    </span>
                  ))}
                </div>
              </div>

              {/* 各维度配额表格 */}
              <div className="space-y-4">
                {Object.entries(quotasByDimension).map(([dimKey, dimData]) => (
                  <div key={dimKey} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                      <h3 className="font-bold text-gray-700">{dimData.label}</h3>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-4 py-2 font-bold text-gray-600">标签</th>
                          <th className="text-right px-4 py-2 font-bold text-gray-600">配额占比</th>
                          <th className="text-right px-4 py-2 font-bold text-gray-600">目标数量</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {dimData.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 text-gray-900">{item.tag_name}</td>
                            <td className="px-4 py-2.5 text-right text-gray-600">{item.quota_percent}%</td>
                            <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                              {item.target_count.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 指定样本投放提示 */}
      {project.sampling_mode === 'manual' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-bold text-gray-900">投放方式</h2>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <p className="text-green-700 font-medium">指定样本投放</p>
            <p className="text-sm text-green-600 mt-1">
              本项目采用指定 openid 方式投放，共投放 {project.sent_samples || 0} 个样本
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function AnswersTab({
  project,
  answerRecords,
  isSyncing,
  lastSyncTime,
  handleSync,
  answerPage,
  pageSize,
  totalPages,
  totalAnswerRecords,
  loadAnswerRecords,
  onProjectUpdated,
}: {
  project: Project;
  answerRecords: AnswerRecord[];
  isSyncing: boolean;
  lastSyncTime: string | null;
  handleSync: () => Promise<void>;
  answerPage: number;
  pageSize: number;
  totalPages: number;
  totalAnswerRecords: number;
  loadAnswerRecords: (page: number) => Promise<void>;
  onProjectUpdated: (status: string) => void;
}) {
  const [showHongbaoConfirm, setShowHongbaoConfirm] = useState(false);

  // 进行中：显示同步按钮 + 结束推送按钮；待发红包/已完成：不显示同步按钮
  const showSyncButton = project.status === 'active' || project.status === 'in_progress';
  // 进行中：显示结束推送按钮
  const showEndPushButton = project.status === 'active' || project.status === 'in_progress';
  // 已完成：显示有效答题统计
  const showValidStatus = project.status === 'completed';

  // 计算5个核心指标
  const plannedTotal = project.total_samples || 0; // 计划发放人数
  const sentSamples = project.sent_samples; // 成功发放人数
  const answeredCount = answerRecords.length; // 已答题人数（排重后）
  const pushRate = plannedTotal > 0 ? (sentSamples / plannedTotal) * 100 : 0; // 推送率
  const responseRate = sentSamples > 0 ? (answeredCount / sentSamples) * 100 : 0; // 响应率
  const validCount = answerRecords.filter((r) => r.is_valid).length; // 有效答题

  // 切换到待发红包状态
  const handleSwitchToHongbao = async () => {
    try {
      await projectApi.update(project.id, { status: 'pending' });
      setShowHongbaoConfirm(false);
      // 直接更新本地状态触发重渲染，不用 window.location.reload() 避免整页白屏
      onProjectUpdated('pending');
      showToast('已切换到发红包阶段', 'success');
    } catch (err: any) {
      showToast(`切换失败: ${err.message || '网络错误'}`, 'error');
    }
  };

  return (
    <div className="max-w-5xl">
      {/* 数据导出（复用原 ExportTab 组件） */}
      <ExportTab project={project} answerRecords={answerRecords} />

      {/* 统计 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900">项目指标</h2>
            <p className="text-sm text-gray-500 mt-1">
              已按 openid 排重（同一用户答多次只保留最后一次）
              {lastSyncTime && <span className="ml-2 text-xs">上次同步：{lastSyncTime}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {showSyncButton && (
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className={`px-4 py-2.5 rounded-lg flex items-center gap-2 transition ${
                  isSyncing
                    ? 'bg-gray-300 text-white cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? '同步中...' : '同步答题数据'}
              </button>
            )}
          </div>
        </div>

        {/* 5个核心指标卡片 */}
        <div className="grid grid-cols-5 gap-4">
          {/* 计划发放 */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <Target className="w-4 h-4" />
              <span className="text-sm font-medium">计划发放</span>
            </div>
            <div className="text-2xl font-bold text-blue-700">{plannedTotal.toLocaleString()}</div>
            <div className="text-xs text-blue-500 mt-1">计划发放人数</div>
          </div>

          {/* 成功发放人数 */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-2 text-green-600 mb-2">
              <Send className="w-4 h-4" />
              <span className="text-sm font-medium">成功发放</span>
            </div>
            <div className="text-2xl font-bold text-green-700">{sentSamples.toLocaleString()}</div>
            <div className="text-xs text-green-500 mt-1">已推送微信公众号</div>
          </div>

          {/* 已答题人数 */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center gap-2 text-purple-600 mb-2">
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">已答题</span>
            </div>
            <div className="text-2xl font-bold text-purple-700">{answeredCount.toLocaleString()}</div>
            <div className="text-xs text-purple-500 mt-1">排重后答题人数</div>
          </div>

          {/* 成功推送率 */}
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
            <div className="flex items-center gap-2 text-orange-600 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">推送率</span>
            </div>
            <div className="text-2xl font-bold text-orange-700">{pushRate.toFixed(1)}%</div>
            <div className="text-xs text-orange-500 mt-1">成功推送 ÷ 发放</div>
          </div>

          {/* 响应率 */}
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-4 border border-indigo-200">
            <div className="flex items-center gap-2 text-indigo-600 mb-2">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">响应率</span>
            </div>
            <div className="text-2xl font-bold text-indigo-700">{responseRate.toFixed(1)}%</div>
            <div className="text-xs text-indigo-500 mt-1">已答题 ÷ 成功推送</div>
          </div>
        </div>

        {/* 已完成状态额外显示有效答题 */}
        {showValidStatus && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-600">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-medium">有效答题</span>
              <span className="text-sm text-gray-500 ml-2">（已完成项目，排除无效答卷）</span>
            </div>
            <div className="text-xl font-bold text-gray-900">
              {validCount.toLocaleString()} / {answeredCount.toLocaleString()}
            </div>
          </div>
        )}

        {/* 进行中状态：结束推送按钮 */}
        {showEndPushButton && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setShowHongbaoConfirm(true)}
                className="px-5 py-2.5 rounded-lg flex items-center gap-2 bg-orange-600 text-white hover:bg-orange-700 transition font-medium"
              >
                <Gift className="w-4 h-4" />
                结束推送，开始发红包
              </button>
              <span className="text-xs text-red-500">⚠️ 切换前请先在腾讯问卷后台关闭问卷回收</span>
            </div>
          </div>
        )}
      </div>

      {/* 答题记录列表 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="font-bold text-gray-700">答题记录列表（排重后）</h3>
        </div>
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 font-bold text-gray-600">序号</th>
                <th className="text-left px-4 py-3 font-bold text-gray-600">用户 OpenID</th>
                <th className="text-left px-4 py-3 font-bold text-gray-600">答题时间</th>
                {showValidStatus && (
                  <th className="text-left px-4 py-3 font-bold text-gray-600">状态</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {/* 同步中骨架屏 */}
              {isSyncing && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-3"><div className="h-4 w-6 bg-gray-200 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-32 bg-gray-200 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-24 bg-gray-200 rounded" /></td>
                  {showValidStatus && <td className="px-4 py-3"><div className="h-4 w-12 bg-gray-200 rounded" /></td>}
                </tr>
              ))}

              {/* 空状态 */}
              {!isSyncing && answerRecords.length === 0 && (
                <tr>
                  <td colSpan={showValidStatus ? 4 : 3} className="px-4 py-12">
                    <EmptyState
                      variant="empty"
                      title="暂无答题记录"
                      description="还没有用户提交答卷"
                    />
                  </td>
                </tr>
              )}

              {/* 数据列表 */}
              {!isSyncing && answerRecords.length > 0 && answerRecords.map((record, index) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{(answerPage - 1) * pageSize + index + 1}</td>
                  <td className="px-4 py-3 font-mono text-gray-900">{record.openid}</td>
                  <td className="px-4 py-3 text-gray-600">{formatBJTime(record.answer_time)}</td>
                  {showValidStatus && (
                    <td className="px-4 py-3">
                      {record.is_valid ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          有效
                        </span>
                      ) : (
                        <span className="text-red-600 flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" />
                          无效
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between text-sm">
            <span className="text-gray-500">
              共 {totalAnswerRecords} 条，第 {answerPage}/{totalPages} 页
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => loadAnswerRecords(1)}
                disabled={answerPage <= 1}
                className="px-3 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                首页
              </button>
              <button
                onClick={() => loadAnswerRecords(answerPage - 1)}
                disabled={answerPage <= 1}
                className="px-3 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <button
                onClick={() => loadAnswerRecords(answerPage + 1)}
                disabled={answerPage >= totalPages}
                className="px-3 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                下一页
              </button>
              <button
                onClick={() => loadAnswerRecords(totalPages)}
                disabled={answerPage >= totalPages}
                className="px-3 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                末页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 切换到待发红包确认弹窗 */}
      {showHongbaoConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <Gift className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">确认切换为发红包阶段</h3>
                <p className="text-sm text-gray-500">切换后将无法继续推送问卷</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-800">
                <span className="font-medium">提醒：</span>切换前请确认已在问卷后台关闭问卷回收功能，停止收集新的答卷。
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowHongbaoConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                取消
              </button>
              <button
                onClick={handleSwitchToHongbao}
                className="flex-1 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
              >
                确认切换
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HongbaoTab({
  project,
  answerRecords,
}: {
  project: Project;
  answerRecords: AnswerRecord[];
}) {
  // 问卷系统判定无效的用户列表
  const tencentInvalidRecords = answerRecords.filter((r) => r.is_valid === false);

  // 框1：问卷无效用户的勾选状态（打勾 = 排除）
  // 初始值：所有问卷无效用户都在这里面（全部打勾 = 全部排除）
  const [tencentCheckedOpenids, setTencentCheckedOpenids] = useState<Set<string>>(
    () => new Set(tencentInvalidRecords.map((r) => r.openid))
  );

  // 框2：人工批量输入的 openids（独立状态）
  const [batchExcludeInput, setBatchExcludeInput] = useState('');

  // tencentInvalidSet：所有问卷无效用户的 openid 集合
  const tencentInvalidSet = useMemo(() => new Set(tencentInvalidRecords.map((r) => r.openid)), [tencentInvalidRecords]);

  // batchExcludeSet：从框2输入解析出的 openids 集合
  const batchExcludeSet = useMemo(() => {
    return new Set(
      batchExcludeInput
        .split(/[\n,，]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    );
  }, [batchExcludeInput]);

  // 框1排除：tencentInvalidSet 中在 tencentCheckedOpenids 里的（打勾的排除）
  const tencentExcludedSet = useMemo(() => {
    return new Set([...tencentInvalidSet].filter((oid) => tencentCheckedOpenids.has(oid)));
  }, [tencentInvalidSet, tencentCheckedOpenids]);

  // 框2排除：batchExcludeSet（人工输入的全部排除）
  // 与框1没有重叠冲突概念，框2是独立排除来源

  // 人工排除的 openid 中，不在本次答题记录里的（无效输入）
  const invalidBatchOpenids = useMemo(() => {
    const answerSet = new Set(answerRecords.map((r) => r.openid).filter(Boolean));
    return [...batchExcludeSet].filter((oid) => !answerSet.has(oid));
  }, [batchExcludeSet, answerRecords]);

  // 人工排除中，有效的 openid（在答题记录里）
  const validBatchExcludeSet = useMemo(() => {
    const invalidSet = new Set(invalidBatchOpenids);
    return new Set([...batchExcludeSet].filter((oid) => !invalidSet.has(oid)));
  }, [batchExcludeSet, invalidBatchOpenids]);

  // 总排除集合：框1排除 + 框2有效排除（自动去重；无效输入不计入）
  const allExcludedOpenids = useMemo(() => {
    return new Set([...tencentExcludedSet, ...validBatchExcludeSet]);
  }, [tencentExcludedSet, validBatchExcludeSet]);

  const [hongbaoConfig, setHongbaoConfig] = useState<HongbaoConfig>({
    mode: 'total_to_average',
    exclude_count: 0,
    final_count: answerRecords.length,
    final_average: 0,
    final_total: 0,
  });
  const [inputValue, setInputValue] = useState('');
  const [remark, setRemark] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [showRecipients, setShowRecipients] = useState(false); // 弹窗内是否展开 openid 列表
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: number; failed: number; notified: number } | null>(null);
  const [sendLog, setSendLog] = useState<Array<{ openid: string; success: boolean; notified?: boolean; error?: string; ts: number }>>([]);
  const [progressDone, setProgressDone] = useState(0);
  const [hongbaoPaused, setHongbaoPaused] = useState(false); // 是否暂停
  const pauseRef = useRef(false); // 暂停标志 ref（实时读取，避免闭包问题）

  // 预览：最终真正会去发红包的 openid 列表（应用所有排除条件后）
  const finalRecipients = useMemo(() => {
    return answerRecords.filter((r) => r.openid && !allExcludedOpenids.has(r.openid));
  }, [answerRecords, allExcludedOpenids]);

  // 每次 allExcludedOpenids 变化时，自动重算 hongbaoConfig
  // 注意：依赖用 .size（number）而不是 Set 本身（每次 new Set 引用都不同，会无限循环）
  // 用整数分运算避免 JS 浮点精度问题（如 0.5*count 算出 0.4999→显示0.49）
  useEffect(() => {
    const count = answerRecords.length - allExcludedOpenids.size;
    setHongbaoConfig((prev) => {
      if (prev.mode === 'total_to_average' && prev.total_amount) {
        const totalCents = Math.round(prev.total_amount * 100);
        const avgCents = count > 0 ? Math.round(totalCents / count) : 0;
        return { ...prev, exclude_count: allExcludedOpenids.size, final_count: count, final_average: avgCents / 100 };
      } else if (prev.mode === 'average_to_total' && prev.average_amount) {
        const avgCents = Math.round(prev.average_amount * 100);
        const totalCents = avgCents * count; // 整数乘法，无浮点问题
        return { ...prev, exclude_count: allExcludedOpenids.size, final_count: count, final_total: totalCents / 100 };
      }
      return { ...prev, exclude_count: allExcludedOpenids.size, final_count: count };
    });
  }, [allExcludedOpenids.size, answerRecords.length]);

  // 加载已有的排除列表（从后端 ExcludeUser 表）
  const [excludesLoaded, setExcludesLoaded] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!project.id) return;
    excludeApi.list(project.id).then((res) => {
      if (res.data && res.data.length > 0) {
        const openids = res.data.map((e: any) => e.openid).join('\n');
        setBatchExcludeInput(openids);
      }
      setExcludesLoaded(true);
    }).catch((err) => {
      console.error('加载排除列表失败:', err);
      setExcludesLoaded(true);
    });
  }, [project.id]);

  // 自动保存排除列表到后端（debounce 1秒）
  useEffect(() => {
    if (!excludesLoaded || !project.id) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const openids = batchExcludeInput
        .split(/[\n,，]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      excludeApi.sync(project.id, openids).catch((err) => {
        console.error('保存排除列表失败:', err);
      });
    }, 1000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [batchExcludeInput, excludesLoaded, project.id]);

  // 切换问卷系统无效用户的勾选状态
  const toggleTencentInvalid = (openid: string) => {
    const next = new Set(tencentCheckedOpenids);
    if (next.has(openid)) {
      next.delete(openid);
    } else {
      next.add(openid);
    }
    setTencentCheckedOpenids(next);
  };

  // 全选：全部打勾 → 排除50人（全部不发放）
  const selectAllInvalid = () => {
    setTencentCheckedOpenids(new Set(tencentInvalidSet));
  };

  // 全不选：全部不打勾 → 排除0人（全部可发放）
  const deselectAllInvalid = () => {
    setTencentCheckedOpenids(new Set());
  };

  /**
   * 金额变更处理：用整数分（cent）运算，消除 JS 浮点精度问题
   * 如输入 0.5 元 → 50分，50/count→取整，最终 ÷100 还原显示
   */
  const handleConfigChange = (mode: 'total_to_average' | 'average_to_total', value: number) => {
    // 注意：不要在这里 setInputValue！让 input 自由控制显示（避免光标跳动/小数点被截断）
    const count = answerRecords.length - allExcludedOpenids.size;
    const valueCents = Math.round(value * 100); // 元→分，消除浮点误差
    setHongbaoConfig((prev) => {
      if (mode === 'total_to_average') {
        const avgCents = count > 0 ? Math.round(valueCents / count) : 0;
        return { ...prev, mode, total_amount: value, exclude_count: allExcludedOpenids.size, final_count: count, final_average: avgCents / 100, final_total: value };
      } else {
        const totalCents = valueCents * count; // 整数乘法，无浮点问题
        return { ...prev, mode, average_amount: value, exclude_count: allExcludedOpenids.size, final_count: count, final_average: value, final_total: totalCents / 100 };
      }
    });
  };

  /**
   * 通用：给一批 recipients 发红包（分块调用后端+实时进度+支持暂停）
   * retryMode='all': 全量发送；'failed_only': 只重试之前失败的
   */
  const runSendBatch = async (
    recipients: AnswerRecord[],
    retryMode: 'all' | 'failed_only',
  ) => {
    setSending(true);

    const perAmount = hongbaoConfig.final_average;

    // 决定本次要发的列表
    let targetList: AnswerRecord[];
    if (retryMode === 'all') {
      targetList = recipients;
    } else {
      const failedOpenids = new Set(sendLog.filter((l) => !l.success).map((l) => l.openid));
      targetList = recipients.filter((r) => failedOpenids.has(r.openid));
    }

    if (targetList.length === 0) {
      setSending(false);
      return { total: 0, success: 0, failed: 0 };
    }

    const CHUNK_SIZE = 10; // 每批10人调一次后端
    const DELAY_BETWEEN_CHUNKS = 500; // 批次间隔500ms
    let totalSuccess = 0;
    let totalFailed = 0;
    let totalNotified = 0;

    for (let i = 0; i < targetList.length; i += CHUNK_SIZE) {
      // 暂停检查
      if (pauseRef.current) {
        // 保存剩余未发的 openid 到后端，并更新项目状态为暂停
        const remaining = targetList.slice(i).map(r => r.openid);
        await Promise.allSettled([
          hongbaoApi.savePending(project.id, remaining),
          projectApi.update(project.id, { status: 'paused' }),
        ]);
        setSending(false);
        setHongbaoPaused(true);
        return { total: targetList.length, success: totalSuccess, failed: totalFailed, paused: true };
      }

      const chunk = targetList.slice(i, i + CHUNK_SIZE);
      const chunkRecipients = chunk.map(r => ({ openid: r.openid, amount: perAmount }));

      // 调用后端批量发送（2并发）
      let batchResult: { results: { openid: string; success: boolean; error?: string }[]; success: number; failed: number };
      try {
        batchResult = await hongbaoApi.sendBatch(project.id, chunkRecipients, remark || undefined);
      } catch (err: any) {
        // 单批失败不阻断整体，标记该批全部失败
        batchResult = {
          success: 0,
          failed: chunk.length,
          results: chunk.map(r => ({ openid: r.openid, success: false, error: err?.message || '批次请求失败' })),
        };
      }

      // 实时更新进度条
      batchResult.results.forEach((r) => {
        const entry = { openid: r.openid, success: r.success, notified: (r as any).notified, error: r.error, ts: Date.now() };
        if (retryMode === 'failed_only') {
          setSendLog((prev) => {
            const next = prev.filter((l) => l.openid !== r.openid);
            return [...next, entry];
          });
        } else {
          setSendLog((prev) => [...prev, entry]);
          setProgressDone((prev) => prev + 1);
        }
        if (r.success && (r as any).notified) {
          totalNotified += 1;
        }
      });

      totalSuccess += batchResult.success;
      totalFailed += batchResult.failed;

      // 批次间隔（最后一批不延迟）
      if (i + CHUNK_SIZE < targetList.length) {
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_CHUNKS));
      }
    }

    // 全部发完，清空 pendingOpenids
    await hongbaoApi.savePending(project.id, []).catch(() => {});

    setSending(false);
    return { total: targetList.length, success: totalSuccess, failed: totalFailed, notified: totalNotified };
  };

  /** 暂停发放 */
  const handlePauseHongbao = () => {
    pauseRef.current = true;
    showToast('正在暂停...', 'info');
  };

  /** 继续发放（从断点续发） */
  const handleResumeHongbao = async () => {
    // ⚠️ 双重防护：防止快速双击 / showConfirm 期间重复触发
    if (sending) return;
    // 先确认
    const confirmed = await confirmDialog(
      `确认继续发放红包？\n\n将从断点继续，金额：¥${hongbaoConfig.final_average?.toFixed(2) || '--'}/人`,
    );
    if (!confirmed) return;

    try {
      pauseRef.current = false;
      setHongbaoPaused(false);
      setSending(true);

      // 恢复项目状态为待发红包
      await projectApi.update(project.id, { status: 'pending_hongbao' }).catch(() => {});

      // 从后端读取剩余待发列表
      let response;
      try {
        response = await projectApi.get(project.id);
      } catch {
        setSending(false);
        setHongbaoPaused(true);
        return;
      }
      const pendingData = (response as any)?.pendingOpenids;
      if (!pendingData) {
        setSending(false);
        setHongbaoPaused(true);
        return;
      }
      let pendingIds: string[];
      try {
        pendingIds = JSON.parse(pendingData);
      } catch {
        setSending(false);
        setHongbaoPaused(true);
        return;
      }
      if (!Array.isArray(pendingIds) || pendingIds.length === 0) {
        setSending(false);
        setHongbaoPaused(true);
        return;
      }

      // 构造 recipients 继续发送
      if (!finalRecipients || finalRecipients.length === 0) {
        setSending(false);
        setHongbaoPaused(true);
        return;
      }
      const remainingRecipients = finalRecipients.filter(r => pendingIds.includes(r.openid));
      if (remainingRecipients.length === 0) {
        setSending(false);
        setHongbaoPaused(true);
        return;
      }

      const result = await runSendBatchForResume(remainingRecipients);
      handleBatchComplete(result);
    } catch (err: any) {
      console.error('续发红包崩溃:', err);
      setSending(false);
      setHongbaoPaused(true);
      showToast(`续发出错: ${err?.message || '未知错误'}`, 'error');
    }
  };

  /** 续发专用发送函数 */
  const runSendBatchForResume = async (targetList: AnswerRecord[]) => {
    const perAmount = hongbaoConfig.final_average;
    const CHUNK_SIZE = 10;
    const DELAY_BETWEEN_CHUNKS = 500;
    let totalSuccess = 0;
    let totalFailed = 0;
    let totalNotified = 0;

    for (let i = 0; i < targetList.length; i += CHUNK_SIZE) {
      if (pauseRef.current) {
        const remaining = targetList.slice(i).map(r => r.openid);
        await Promise.allSettled([
          hongbaoApi.savePending(project.id, remaining),
          projectApi.update(project.id, { status: 'paused' }),
        ]);
        setSending(false);
        setHongbaoPaused(true);
        return { total: targetList.length, success: totalSuccess, failed: totalFailed, notified: totalNotified, paused: true };
      }

      const chunk = targetList.slice(i, i + CHUNK_SIZE);
      const chunkRecipients = chunk.map(r => ({ openid: r.openid, amount: perAmount }));

      try {
        const batchResult = await hongbaoApi.sendBatch(project.id, chunkRecipients, remark || undefined);
        batchResult.results.forEach((r) => {
          const entry = { openid: r.openid, success: r.success, notified: (r as any).notified, error: r.error, ts: Date.now() };
          setSendLog((prev) => {
            const next = prev.filter((l) => l.openid !== r.openid);
            return [...next, entry];
          });
          setProgressDone((prev) => prev + 1);
          if (r.success && (r as any).notified) {
            totalNotified += 1;
          }
        });
        totalSuccess += batchResult.success;
        totalFailed += batchResult.failed;
      } catch (err: any) {
        // 单批失败不阻断整体，标记该批全部失败
        chunk.forEach(r => {
          const entry = { openid: r.openid, success: false, error: err?.message || '批次请求失败', ts: Date.now() };
          setSendLog((prev) => {
            const next = prev.filter((l) => l.openid !== r.openid);
            return [...next, entry];
          });
          setProgressDone((prev) => prev + 1);
        });
        totalFailed += chunk.length;
      }

      if (i + CHUNK_SIZE < targetList.length) {
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_CHUNKS));
      }
    }

    await hongbaoApi.savePending(project.id, []).catch(() => {});
    setSending(false);
    return { total: targetList.length, success: totalSuccess, failed: totalFailed, notified: totalNotified };
  };

  /** 通用：处理发送结果 */
  const handleBatchComplete = (result: any) => {
    if (!result || result.paused) return;
    setSendResult({ success: result.success, failed: result.failed, notified: result.notified || 0 });
    // 成功 + 已通知 都算完成，没有失败即可标记项目完成
    if (result.failed === 0 && result.total > 0) {
      projectApi.update(project.id, { status: 'completed' }).catch((err) => {
        console.error('更新项目状态失败:', err.message);
      });
      setTimeout(() => setShowConfirm(false), 1200);
    }
  };

  const handleConfirm = async () => {
    if (sending) return;  // ⚠️ 防双击
    setSending(true);
    setSendResult(null);
    setSendLog([]);
    setProgressDone(0);
    pauseRef.current = false;
    setHongbaoPaused(false);

    const result = await runSendBatch(finalRecipients, 'all');
    handleBatchComplete(result);
  };

  /** 重试失败项（不发成功的） */
  const handleRetryFailed = async () => {
    if (sending) return;  // ⚠️ 防双击
    const failedCount = sendLog.filter((l) => !l.success).length;
    const failedAmount = (failedCount * hongbaoConfig.final_average).toFixed(2);
    const confirmed = await confirmDialog(
      `确认重试 ${failedCount} 笔失败红包？\n\n金额：¥${hongbaoConfig.final_average?.toFixed(2) || '--'}/人\n合计：¥${failedAmount}\n备注：${remark || '无'}`,
    );
    if (!confirmed) return;

    pauseRef.current = false;
    setHongbaoPaused(false);

    const result = await runSendBatch(finalRecipients, 'failed_only');
    handleBatchComplete(result);
  };

  /** 跳过失败直接完成（不重试） */
  const handleSkipFailed = async () => {
    try {
      await projectApi.update(project.id, { status: 'completed' });
      setShowConfirm(false);
      showToast('已跳过失败红包，项目标记为已完成', 'success');
      setTimeout(() => window.location.reload(), 800);
    } catch (err: any) {
      showToast(`操作失败: ${err.message || '网络错误'}`, 'error');
    }
  };

  return (
    <div className="max-w-5xl">
      {/* 跳过红包直接完成 */}
      <div className="bg-gray-100 rounded-lg border border-gray-200 p-4 mb-6 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          <span className="font-medium">不需要发放红包？</span>
          <span className="text-gray-400 ml-1">可直接将项目标记为已完成</span>
        </div>
        <button
          onClick={() => setShowSkipConfirm(true)}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition text-sm font-medium"
        >
          跳过红包直接完成
        </button>
      </div>

      {/* 配置区 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-6">红包发放设置</h2>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              计算方式
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setHongbaoConfig((prev) => ({ ...prev, mode: 'total_to_average' }))}
                className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition ${
                  hongbaoConfig.mode === 'total_to_average'
                    ? 'border-blue-600 bg-blue-50 text-blue-600'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                总金额 → 人均
              </button>
              <button
                onClick={() => setHongbaoConfig((prev) => ({ ...prev, mode: 'average_to_total' }))}
                className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition ${
                  hongbaoConfig.mode === 'average_to_total'
                    ? 'border-blue-600 bg-blue-50 text-blue-600'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                人均 → 总金额
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {hongbaoConfig.mode === 'total_to_average' ? '总金额（元）' : '人均金额（元）'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">¥</span>
              <input
                type="number"
                step="0.01"
                value={inputValue}
                onChange={(e) => {
                  const raw = e.target.value;
                  setInputValue(raw); // 本地 state 完全控制显示，保留原始字符串（含小数点）
                  handleConfigChange(hongbaoConfig.mode, parseFloat(raw) || 0);
                }}
                placeholder={hongbaoConfig.mode === 'total_to_average' ? '输入总金额' : '输入人均金额'}
                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* 备注信息 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            备注（选填）
          </label>
          <input
            type="text"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="例如：感谢参与问卷调查"
            maxLength={50}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">红包记录中会显示此备注，最多50字</p>
        </div>

        {/* 计算结果预览 */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-gray-500 mb-3">
            <Calculator className="w-4 h-4" />
            <span className="text-sm font-medium">计算结果预览</span>
          </div>
          <div className="grid grid-cols-5 gap-4">
            <div>
              <div className="text-sm text-gray-500">已回答人数</div>
              <div className="text-xl font-bold text-gray-900">{answerRecords.length}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">排除人数</div>
              <div className="text-xl font-bold text-orange-600">{allExcludedOpenids.size}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">应发人数</div>
              <div className="text-xl font-bold text-green-600">{answerRecords.length - allExcludedOpenids.size}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">人均金额</div>
              <div className="text-xl font-bold text-gray-900">¥{hongbaoConfig.final_average.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">预计总支出</div>
              <div className="text-xl font-bold text-blue-600">¥{hongbaoConfig.final_total.toFixed(2)}</div>
            </div>
          </div>
          {remark && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="text-sm text-gray-500">红包备注</div>
              <div className="text-sm font-medium text-gray-800 mt-0.5">{remark}</div>
            </div>
          )}
        </div>

        {/* 问卷系统判定无效用户列表 */}
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                问卷系统判定无效用户（需人工复核）
              </div>
              <div className="text-xs text-gray-500 mt-1">
                共 {tencentInvalidRecords.length} 人，默认不发放；取消勾选 = 允许发放红包
              </div>
            </div>
            {tencentInvalidRecords.length > 0 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={selectAllInvalid}
                  className="text-xs text-orange-600 hover:text-orange-800 underline"
                >
                  全选
                </button>
                <button
                  onClick={deselectAllInvalid}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  全不选
                </button>
                <span className="text-sm text-orange-600 font-medium">
                  已排除 {tencentExcludedSet.size} 人
                </span>
              </div>
            )}
          </div>
          {tencentInvalidRecords.length > 0 ? (
            <div className="max-h-40 overflow-auto space-y-1">
              {tencentInvalidRecords.map((record) => {
                const isExcluded = tencentCheckedOpenids.has(record.openid);
                return (
                  <div
                    key={record.id}
                    className={`flex items-center gap-3 p-2 rounded text-sm ${isExcluded ? 'bg-red-100' : 'bg-green-50'}`}
                  >
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={isExcluded}
                      onChange={() => toggleTencentInvalid(record.openid)}
                    />
                    <span className="font-mono text-gray-800 flex-1 truncate">{record.openid}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${isExcluded ? 'bg-red-200 text-red-700' : 'bg-green-200 text-green-700'}`}>
                      {isExcluded ? '不发放' : '可发放'}
                    </span>
                    <span className="text-xs text-gray-400">{formatBJTime(record.answer_time)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-gray-400 py-2">
              暂无腾讯问卷标记为无效的答卷
            </div>
          )}
        </div>

        {/* 批量排除（人工规则） */}
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              人工批量排除（不发放红包）
            </label>
            <span className="text-sm text-orange-600 font-medium">
              已排除 {validBatchExcludeSet.size} 人
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            输入要排除的用户 openid，多个用换行或逗号分隔，支持从 Excel 直接粘贴
          </p>
          <textarea
            value={batchExcludeInput}
            onChange={(e) => setBatchExcludeInput(e.target.value)}
            placeholder={`例如：
oABC123456
oDEF789012
oGHI345678`}
            className="w-full h-20 p-3 border border-gray-200 rounded-lg text-sm font-mono resize-none focus:ring-2 focus:ring-gray-500 outline-none"
          />
          {invalidBatchOpenids.length > 0 && (
            <div className="mt-3 rounded-lg border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 border-l-4 border-l-red-500 overflow-hidden">
              <div className="px-4 py-2.5 flex items-center gap-2 border-b border-red-100">
                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                </div>
                <span className="text-sm font-semibold text-red-700">无效 openid</span>
                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                  {invalidBatchOpenids.length} 个
                </span>
                <span className="text-xs text-red-600 ml-auto">不在本次答题记录中，已被忽略</span>
              </div>
              <div className="px-4 py-2.5 flex flex-wrap gap-1.5">
                {invalidBatchOpenids.map((oid, idx) => (
                  <span
                    key={`${oid}-${idx}`}
                    title={oid}
                    className="inline-flex items-center px-2 py-0.5 rounded bg-white border border-red-200 text-xs font-mono text-red-700 max-w-[180px] truncate"
                  >
                    {oid}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 待发红包 openid 列表（页面底部，可展开） */}
      <div className="mt-6 border border-gray-200 rounded-lg overflow-hidden bg-white">
        <button
          onClick={() => setShowRecipients(!showRecipients)}
          className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition"
        >
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Users className="w-4 h-4" />
            <span className="font-medium">待发红包 openid 列表</span>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
              {finalRecipients.length} 人
            </span>
          </div>
          {showRecipients ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </button>
        {showRecipients && (
          <div className="max-h-96 overflow-y-auto">
            {finalRecipients.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                没有可发送的用户
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {finalRecipients.map((r, idx) => (
                  <li
                    key={`${r.openid}-${idx}`}
                    className="px-4 py-2 text-xs font-mono text-gray-600 hover:bg-gray-50 flex items-center justify-between"
                  >
                    <span className="truncate">{r.openid}</span>
                    <span className="text-gray-400 ml-2 flex-shrink-0">#{idx + 1}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* 发送中进度卡（弹窗外也能看到） */}
      {(sending || hongbaoPaused || sendResult) && (
        <div className={`mt-6 p-4 rounded-lg border ${sendResult && sendResult.failed > 0 ? 'bg-yellow-50 border-yellow-200' : sendResult ? 'bg-green-50 border-green-200' : hongbaoPaused ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className={`text-sm font-medium ${sendResult && sendResult.failed > 0 ? 'text-yellow-700' : sendResult ? 'text-green-700' : hongbaoPaused ? 'text-orange-700' : 'text-blue-700'}`}>
              {hongbaoPaused ? '红包发放已暂停' : sending ? '正在发送红包...' : (sendResult?.failed === 0 ? '全部处理完成' : `完成：成功 ${sendResult?.success}，已通知 ${sendResult?.notified || 0}，失败 ${sendResult?.failed}`)}
            </div>
            <div className="flex items-center gap-3">
              <div className={`text-sm font-semibold ${sendResult && sendResult.failed > 0 ? 'text-yellow-700' : sendResult ? 'text-green-700' : hongbaoPaused ? 'text-orange-700' : 'text-blue-700'}`}>
                {progressDone} / {finalRecipients.length}
                <span className="text-xs ml-1 opacity-75">
                  ({Math.round((progressDone / Math.max(finalRecipients.length, 1)) * 100)}%)
                </span>
              </div>
              {/* 暂停/继续按钮 */}
              {sending && !hongbaoPaused && (
                <button
                  onClick={handlePauseHongbao}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-orange-100 text-orange-600 rounded hover:bg-orange-200 transition"
                >
                  <Pause className="w-3 h-3" /> 暂停
                </button>
              )}
              {hongbaoPaused && (
                <button
                  onClick={handleResumeHongbao}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-600 rounded hover:bg-green-200 transition"
                >
                  <Play className="w-3 h-3" /> 继续
                </button>
              )}
            </div>
          </div>
          <div className={`w-full rounded-full h-2 overflow-hidden ${sendResult && sendResult.failed > 0 ? 'bg-yellow-100' : sendResult ? 'bg-green-100' : hongbaoPaused ? 'bg-orange-100' : 'bg-blue-100'}`}>
            <div
              className={`h-2 rounded-full transition-all duration-300 ${sendResult && sendResult.failed > 0 ? 'bg-yellow-500' : sendResult ? 'bg-green-500' : hongbaoPaused ? 'bg-orange-400' : 'bg-blue-500'}`}
              style={{ width: `${Math.round((progressDone / Math.max(finalRecipients.length, 1)) * 100)}%` }}
            />
          </div>
          {!showConfirm && sendResult && sendResult.failed > 0 && (
            <button
              onClick={() => setShowConfirm(true)}
              className="mt-3 text-xs text-blue-600 hover:underline"
            >
              点击查看详细日志 →
            </button>
          )}
        </div>
      )}

      {/* 确认发放 */}
      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={() => setShowConfirm(true)}
          disabled={answerRecords.length - allExcludedOpenids.size === 0 || hongbaoConfig.final_total === 0 || sending}
          className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          确认发放红包
        </button>
      </div>

      {/* 确认发放弹窗 */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-[28rem] shadow-2xl">
            {/* 标题区 */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Gift className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">确认发放红包</h3>
              <p className="text-sm text-gray-500 mt-1">请核对以下信息，确认无误后点击"确认发放"</p>
            </div>

            {/* 核心信息卡片 */}
            <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-5 mb-6 border border-green-100">
              <div className="text-center mb-4">
                <div className="text-sm text-gray-500 mb-1">预计总支出</div>
                <div className="text-4xl font-bold text-green-600">¥{hongbaoConfig.final_total.toFixed(2)}</div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-green-200/50">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{hongbaoConfig.final_count}</div>
                  <div className="text-xs text-gray-500 mt-0.5">发放人数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">¥{hongbaoConfig.final_average.toFixed(2)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">人均金额</div>
                </div>
              </div>

              {hongbaoConfig.exclude_count > 0 && (
                <div className="mt-4 pt-3 border-t border-orange-200/50 text-center">
                  <span className="text-sm text-orange-600">
                    已排除 <span className="font-bold">{hongbaoConfig.exclude_count}</span> 人（不参与发放）
                  </span>
                </div>
              )}
              {remark && (
                <div className="mt-4 pt-3 border-t border-green-200/50 text-center">
                  <span className="text-sm text-gray-500 mr-1">备注：</span>
                  <span className="text-sm font-medium text-gray-800">{remark}</span>
                </div>
              )}
            </div>

            {/* 发送进度 */}
            {sending && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-blue-700 font-medium">正在发送红包...</div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-semibold text-blue-700">
                      {progressDone} / {finalRecipients.length}
                      <span className="text-xs text-blue-500 ml-1">
                        ({Math.round((progressDone / Math.max(finalRecipients.length, 1)) * 100)}%)
                      </span>
                    </div>
                    <button
                      onClick={handlePauseHongbao}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-orange-100 text-orange-600 rounded hover:bg-orange-200 transition"
                    >
                      <Pause className="w-3 h-3" /> 暂停
                    </button>
                  </div>
                </div>
                <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.round((progressDone / Math.max(finalRecipients.length, 1)) * 100)}%` }}
                  />
                </div>
                <div className="text-xs text-blue-500 mt-2">请勿关闭此页面</div>
              </div>
            )}

            {/* 暂停中提示 */}
            {hongbaoPaused && (
              <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-orange-700 font-medium flex items-center gap-2">
                    <Pause className="w-4 h-4" /> 红包发放已暂停
                  </div>
                  <button
                    onClick={handleResumeHongbao}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition"
                  >
                    <Play className="w-4 h-4" /> 继续发放
                  </button>
                </div>
                <div className="text-xs text-orange-500 mt-1">
                  已发 {progressDone} / {finalRecipients.length}，剩余 {finalRecipients.length - progressDone} 个待发
                </div>
              </div>
            )}

            {/* 发送结果 */}
            {sendResult && (
              <div className={`mb-4 p-3 rounded-lg text-center ${sendResult.failed === 0 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                <div className="text-sm font-bold">
                  {sendResult.failed === 0 ? (
                    <span className="text-green-700">全部处理完成！</span>
                  ) : (
                    <span className="text-yellow-700">
                      成功 {sendResult.success} / 已通知 {sendResult.notified || 0} / 失败 {sendResult.failed}
                    </span>
                  )}
                </div>
                {sendResult.failed === 0 && (
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-2 px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
                  >
                    完成
                  </button>
                )}
              </div>
            )}

            {/* 发送日志（每条 openid 成功/失败明细） */}
            {sendLog.length > 0 && (
              <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">发送日志</span>
                  <span className="text-xs text-gray-500">
                    成功 <span className="text-green-600 font-semibold">{sendLog.filter((l) => l.success && !l.notified).length}</span>
                    {' / '}
                    已通知 <span className="text-blue-600 font-semibold">{sendLog.filter((l) => l.success && l.notified).length}</span>
                    {' / '}
                    失败 <span className="text-red-600 font-semibold">{sendLog.filter((l) => !l.success).length}</span>
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto bg-white">
                  <ul className="divide-y divide-gray-100">
                    {sendLog.map((log, idx) => (
                      <li
                        key={idx}
                        className={`px-3 py-1.5 text-xs flex items-center gap-2 ${
                          log.success ? (log.notified ? 'bg-blue-50/50' : 'bg-green-50/50') : 'bg-red-50/50'
                        }`}
                      >
                        {log.success ? (
                          log.notified ? (
                            <CheckCircle className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                          )
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                        )}
                        <span className="font-mono text-gray-600 truncate" title={log.openid}>
                          {log.openid}
                        </span>
                        {log.success && log.notified && (
                          <span className="text-blue-600 truncate">已通知领取</span>
                        )}
                        {!log.success && log.error && (
                          <span className="text-red-600 truncate" title={log.error}>
                            {log.error}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* 操作按钮 - 发送前/发送中/发送后 3 套 */}
            <div className="flex gap-3">
              {!sendResult && (
                <>
                  <button
                    onClick={() => setShowConfirm(false)}
                    disabled={sending}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={sending}
                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold transition shadow-lg shadow-green-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? '发放中...' : '确认发放'}
                  </button>
                </>
              )}
              {sendResult && sendResult.failed > 0 && (
                <>
                  <button
                    onClick={handleSkipFailed}
                    disabled={sending}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition disabled:opacity-50"
                  >
                    跳过失败，直接完成
                  </button>
                  <button
                    onClick={handleRetryFailed}
                    disabled={sending}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition shadow-lg shadow-blue-600/30 disabled:opacity-50"
                  >
                    {sending ? '重试中...' : '重试失败项'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 跳过红包确认弹窗 */}
      {showSkipConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-gray-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">确认跳过红包发放？</h3>
            </div>
            <p className="text-gray-600 mb-6">
              确定要跳过红包发放，直接将项目标记为已完成吗？此操作不可撤销。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSkipConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  try {
                    await projectApi.update(project.id, { status: 'completed' });
                    setShowSkipConfirm(false);
                    showToast('已跳过红包，项目标记为已完成', 'success');
                    setTimeout(() => window.location.reload(), 800);
                  } catch (err: any) {
                    showToast(`操作失败: ${err.message || '网络错误'}`, 'error');
                  }
                }}
                className="flex-1 px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                确认跳过
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 格式化日期为腾讯CSV格式: "2026/6/18 14:36"（年/月/日 时:分，无秒，无前导零）
 *  纯手动 UTC+8 北京时间计算 */
function formatTencentDate(dateStr: string): string {
  if (!dateStr) return '';

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const bj = new Date(d.getTime() + 8 * 60 * 60 * 1000); // UTC+8
  const yr = bj.getUTCFullYear();
  const mo = bj.getUTCMonth() + 1;  // 1-12，无前导零
  const dy = bj.getUTCDate();       // 1-31，无前导零
  const hh = String(bj.getUTCHours()).padStart(2, '0');
  const mm = String(bj.getUTCMinutes()).padStart(2, '0');
  return `${yr}/${mo}/${dy} ${hh}:${mm}`;
}

/** Unicode NFC 归一化 + trim（解决 NFC/NFD 编码不一致导致文本匹配失败） */
function norm(t: string | null | undefined): string {
  return (t || '').trim().normalize('NFC');
}

/** 根据选项ID在完整选项列表中查找位置 → 返回字母前缀（如 "B. "） */
function getLetterPrefix(optionId: string, fullOptions: any[]): string {
  if (!fullOptions || !optionId) return '';
  const idx = fullOptions.findIndex((o: any) => o.id === optionId);
  if (idx >= 0 && idx < 26) return String.fromCharCode(65 + idx) + '.';
  return '';
}

/** 根据选项文本在完整选项列表中查找位置 → 返回字母前缀（NFC 归一化匹配） */
function getLetterPrefixByText(optionText: string, fullOptions: any[]): string {
  if (!fullOptions || !optionText) return '';
  const nt = norm(optionText);
  const idx = fullOptions.findIndex((o: any) => norm(o.text) === nt);
  if (idx >= 0 && idx < 26) return String.fromCharCode(65 + idx) + '.';
  return '';
}

/** 在 chained_selects 的 groups 树中搜索文本 → 返回所有层级的字母前缀 */
function getChainedLetterPrefixes(textList: string[], groups: any[]): string[] {
  const result: string[] = [];
  if (!groups || !textList) return result;
  
  for (let level = 0; level < textList.length; level++) {
    const targetText = textList[level];
    let found = false;
    
    // 第 0 层搜 groups 本身，后续层搜当前选中项的 children
    const searchIn = level === 0 ? groups : (() => {
      // 找上一层选中的 group
      const prevText = textList[level - 1];
      const searchPool = level === 1 ? groups : [];
      // 递归搜索上一层的 children
      function findChildren(items: any[], searchText: string): any[] | null {
        for (const item of items) {
          if (norm(item.text) === norm(searchText) && item.children) return item.children;
          if (item.children) {
            const found = findChildren(item.children, searchText);
            if (found) return found;
          }
        }
        return null;
      }
      return findChildren(groups, prevText) || [];
    })();
    
    // 在搜索范围内找匹配文本的项的索引
    for (let i = 0; i < searchIn.length; i++) {
      if (searchIn[i].text === targetText) {
        result.push(i < 26 ? String.fromCharCode(65 + i) + '.' : '');
        found = true;
        break;
      }
    }
    if (!found) result.push('');
  }
  return result;
}

/** 将腾讯问卷 webhook 单道题拆为多个列：{ 列头 → 值 } */
/**
 * 构建题目的所有列头（根据完整题目定义，保证所有选项列都出现）
 * 无论 webhook 数据中有没有该选项，列为必须输出（未选则为空字符串）
 */
function buildQuestionColumns(q: any, qNum: number, questionIndex: number, questionDefs?: Map<string, any>, pipingFilter?: Map<string, Set<string>>): Record<string, string> {
  const cols: Record<string, string> = {};
  const baseTitle = q.title || q.id || '';
  const type = q.type || '';
  const def = questionDefs?.get(q.id); // 完整题目定义（含所有选项）

  // 管道过滤：如果本题被管道源题关联，只展示被选中选项对应的行
  const pipedValidRowTexts = pipingFilter?.get(q.id);

  if (!def) {
    // 无完整定义时回退到旧逻辑（仅基于 webhook 数据）
    return buildQuestionColumnsFallback(q, qNum, baseTitle, type);
  }

  switch (type) {
    case 'radio':
    case 'select': {
      const opts = q.options || [];
      const checked = opts.find((o: any) => o.checked === 1 || o.checked === true);
      const text = checked?.text ?? '';
      const optId = checked?.id ?? '';
      const fullOpts = def.options || [];
      const prefix = optId ? getLetterPrefix(optId, fullOpts) : getLetterPrefixByText(text, fullOpts);
      cols[`${qNum}.${baseTitle}`] = prefix ? `${prefix}${text}` : text;
      // 如果选项有填空（blank_setting），输出 [选项填空] 列
      const blankSettings = def.blank_setting || [];
      const blankByOption = new Map<string, string>();
      for (const bs of blankSettings) {
        if (bs.attach_id) blankByOption.set(bs.attach_id, bs.id);
      }
      if (checked && optId && blankByOption.has(optId)) {
        const blankId = blankByOption.get(optId)!;
        const webhookBlanks = q.blanks || [];
        const blank = webhookBlanks.find((b: any) => b.id === blankId);
        cols[`${qNum}.${baseTitle}[选项填空]`] = blank?.value || blank?.text || '';
      } else {
        // 如果完整定义中有填空选项但本次未选中，也要输出空列以对齐列头
        if (blankByOption.size > 0) {
          cols[`${qNum}.${baseTitle}[选项填空]`] = '';
        }
      }
      break;
    }
    case 'checkbox': {
      // 用完整定义的所有选项生成列头，再填入 webhook 数据
      const fullOpts = def.options || [];
      const webhookOpts = q.options || [];
      // blank_setting: [{ attach_id, id }] — 标记哪些选项有填空
      const blankSettings = def.blank_setting || [];
      const blankByOption = new Map<string, string>(); // optionId → blankId
      for (const bs of blankSettings) {
        if (bs.attach_id) blankByOption.set(bs.attach_id, bs.id);
      }
      // 构建 blankId → value 的索引（webhook q.blanks）
      const webhookBlanks = q.blanks || [];
      const blankValues = new Map<string, string>();
      for (const b of webhookBlanks) {
        if (b.id && (b.value || b.text)) blankValues.set(b.id, b.value || b.text);
      }
      // 先构建 webhook 数据的 Map（按 id 索引）
      const webhookMap = new Map<string, any>();
      for (const o of webhookOpts) {
        const oid = o.id || o.text;
        if (oid) webhookMap.set(oid, o);
      }
      // 辅助函数：去除文本中的 {fillblank-xxx} 标记
      const stripFillblank = (t: string) => t.replace(/\{fillblank-[^}]+\}/g, '');
      for (const fo of fullOpts) {
        const oid = fo.id || fo.text;
        const cleanText = stripFillblank(fo.text || '');
        const key = `${qNum}.${baseTitle}:${cleanText || fo.id}`;
        const wo = webhookMap.get(oid);
        if (wo && (wo.checked === 1 || wo.checked === true)) {
          const prefix = getLetterPrefix(oid, fullOpts);
          cols[key] = prefix ? `${prefix}${cleanText}` : cleanText;
          // 该选项有填空 → 额外输出 [选项填空] 列
          if (blankByOption.has(oid)) {
            const blankId = blankByOption.get(oid)!;
            const blankKey = `${qNum}.${baseTitle}:${cleanText || fo.id}[选项填空]`;
            cols[blankKey] = blankValues.get(blankId) || '';
          }
        } else {
          cols[key] = '';
          if (blankByOption.has(oid)) {
            const blankKey = `${qNum}.${baseTitle}:${cleanText || fo.id}[选项填空]`;
            cols[blankKey] = '';
          }
        }
      }
      break;
    }
    case 'chained_selects': {
      const levels = q.text_list || [];
      const defaultLabels = ['第1级', '第2级', '第3级', '第4级', '第5级'];
      const isRegion = /地区|所在[地省市区]|省[份市]|[省市]区/.test(baseTitle);
      const labelSets = levels.length === 3 ? (isRegion ? ['省', '市', '区'] : defaultLabels)
        : levels.length === 2 ? (isRegion ? ['省', '市'] : ['一级分类', '二级分类'])
        : defaultLabels;
      levels.forEach((txt: string, i: number) => {
        cols[`${qNum}.${baseTitle}:${labelSets[i] || defaultLabels[i]}`] = txt;
      });
      break;
    }
    case 'text':
    case 'textarea':
    case 'number':
    case 'phone':
    case 'email':
      cols[`${qNum}.${baseTitle}`] = q.text !== undefined ? String(q.text) : '';
      break;
    case 'date':
    case 'datetime':
      cols[`${qNum}.${baseTitle}`] = q.text !== undefined ? formatTencentDate(String(q.text)) : '';
      break;
    case 'star':
    case 'nps':
      // webhook: q.text = "5"（纯字符串），无 q.score/q.options
      if (q.score !== undefined && q.score !== null) {
        cols[`${qNum}.${baseTitle}`] = String(q.score);
      } else if (q.text !== undefined && q.text !== null && q.text !== '') {
        cols[`${qNum}.${baseTitle}`] = String(q.text);
      } else {
        const opts = q.options || [];
        const checked = opts.find((o: any) => o.checked === 1 || o.checked === true);
        cols[`${qNum}.${baseTitle}`] = checked?.text ?? '';
      }
      break;
    case 'blanks': {
      // webhook blanks: [{ id, value }] 或嵌套数组 [[{ id, value }]]
      const blanks = q.blanks || [];
      let flatBlanks: any[] = [];
      if (blanks.length > 0 && Array.isArray(blanks[0])) {
        flatBlanks = blanks[0]; // 嵌套数组展平
      } else {
        flatBlanks = blanks;
      }
      flatBlanks.forEach((b: any, i: number) => {
        cols[`${qNum}.${baseTitle}_填空${i + 1}`] = b.value ?? b.text ?? '';
      });
      break;
    }
    case 'matrix_radio': {
      // webhook: q.groups = [{ id, options: [{ id, checked, text }] }, ...]
      // 每个 group 对应一个矩阵行（sub_titles / sub_questions）
      // 腾讯导出格式：每个单元格展开为独立列 {行文本}-{列文本}
      const fullSubQuestions = def.sub_titles || def.sub_questions || def.options || [];
      const matrixCols = def.options || [];
      const webhookGroups = q.groups || [];
      const webhookRows = q.rows || q.options || [];
      const stripFillblank = (t: string) => (t || '').replace(/\{fillblank-[^}]+\}/g, '');

      // 构建 groups 索引：rowId → group
      const groupsById = new Map<string, any>();
      const groupsByIndex = new Map<number, any>();
      if (webhookGroups.length > 0) {
        for (let i = 0; i < webhookGroups.length; i++) {
          groupsByIndex.set(i, webhookGroups[i]);
          if (webhookGroups[i].id) groupsById.set(webhookGroups[i].id, webhookGroups[i]);
        }
      }
      // 构建 rows 索引：rowId → row
      const rowsById = new Map<string, any>();
      for (const r of webhookRows) {
        const rid = r.id || r.text;
        if (rid) rowsById.set(rid, r);
      }

      for (let ri = 0; ri < fullSubQuestions.length; ri++) {
        const fsq = fullSubQuestions[ri];
        const rowId = fsq.id || fsq.text;
        const rowText = stripFillblank(fsq.text || fsq.id || '');

        // 找到该行对应的 webhook 数据
        let wg = groupsById.get(rowId) || groupsByIndex.get(ri);
        if (!wg && rowsById.size > 0) {
          // 尝试通过 rowsById 间接找
          wg = rowsById.get(rowId);
        }

        // 获取该行选中的选项
        let selId: string | null = null;
        let selText: string | null = null;
        if (wg?.options && Array.isArray(wg.options)) {
          const sel = wg.options.find((o: any) => o.checked === 1 || o.checked === true);
          if (sel) {
            selId = sel.id || null;
            selText = sel.text || null;
          }
        }
        // rows 格式：rows 可能直接有 checked 字段
        if (!selId && wg && (wg.checked === 1 || wg.checked === true)) {
          selId = wg.id || null;
          selText = wg.text || null;
        }

        // 腾讯格式：每行一列，值为选中的级别文本（如 "C.一般"）
        const key = `${qNum}.${baseTitle}:${rowText}`;
        if (selId && selText) {
          const prefix = getLetterPrefix(selId, matrixCols);
          cols[key] = prefix ? `${prefix}${stripFillblank(selText)}` : stripFillblank(selText);
        } else {
          cols[key] = '';
        }
      }
      break;
    }
    case 'matrix_single': {
      // matrix_single 与 matrix_radio 在 webhook 中结构相同：
      // q.groups = [{ id, options: [{ id, checked, text }] }, ...]
      const fullSubQuestions = def.sub_titles || def.sub_questions || def.options || [];
      const matrixCols = def.options || [];
      const webhookGroups = q.groups || [];
      const webhookRows = q.rows || q.options || [];
      const stripFillblank = (t: string) => (t || '').replace(/\{fillblank-[^}]+\}/g, '');

      const groupsById = new Map<string, any>();
      for (const g of webhookGroups) { if (g.id) groupsById.set(g.id, g); }
      const rowsById = new Map<string, any>();
      for (const r of webhookRows) { const rid = r.id || r.text; if (rid) rowsById.set(rid, r); }

      for (let ri = 0; ri < fullSubQuestions.length; ri++) {
        const fsq = fullSubQuestions[ri];
        const rowId = fsq.id || fsq.text;
        const rowText = stripFillblank(fsq.text || fsq.id || '');
        let wg = groupsById.get(rowId) || rowsById.get(rowId);
        if (!wg) wg = webhookGroups[ri] || webhookRows[ri];
        let selId: string | null = null;
        let selText: string | null = null;
        if (wg?.options && Array.isArray(wg.options)) {
          const sel = wg.options.find((o: any) => o.checked === 1 || o.checked === true);
          if (sel) { selId = sel.id || null; selText = sel.text || null; }
        }
        if (!selId && wg && (wg.checked === 1 || wg.checked === true)) {
          selId = wg.id || null; selText = wg.text || null;
        }
        // 腾讯格式：每行一列，值为选中的级别文本
        const key = `${qNum}.${baseTitle}:${rowText}`;
        if (selId && selText) {
          const prefix = getLetterPrefix(selId, matrixCols);
          cols[key] = prefix ? `${prefix}${stripFillblank(selText)}` : stripFillblank(selText);
        } else {
          cols[key] = '';
        }
      }
      break;
    }
    case 'matrix_star': {
      // webhook: q.groups = [{ id: "g-xxx", text: "4" }, ...]
      // 每个 group.text 就是该行的评分值
      const fullSubQuestions = def.sub_titles || def.sub_questions || def.options || [];
      const webhookGroups = q.groups || [];
      const webhookRows = q.rows || q.options || [];

      // 构建 ID 索引（不用索引匹配，防止顺序不一致导致数据错乱）
      const groupsById = new Map<string, any>();
      for (const g of webhookGroups) {
        if (g.id) groupsById.set(g.id, g);
      }
      const rowsById = new Map<string, any>();
      for (const r of webhookRows) {
        const rid = r.id || r.text;
        if (rid) rowsById.set(rid, r);
      }

      for (const fsq of fullSubQuestions) {
        const rowText = fsq.text || fsq.id || '';
        const key = `${qNum}.${baseTitle}:${rowText}`;

        // 管道过滤：如果本题有管道源题且当前行不在选中范围内，输出空值
        if (pipedValidRowTexts && !pipedValidRowTexts.has(rowText.replace(/\{fillblank-[^}]+\}/g, ''))) {
          cols[key] = '';
          continue;
        }

        const sqId = fsq.id || fsq.text;
        // 优先按 ID 查找，回退到 rows
        let wg = groupsById.get(sqId) || rowsById.get(sqId);
        if (!wg && sqId) {
          // 手动遍历模糊匹配（ID 边界匹配避免 q-10 匹配 q-101/q-100）
          wg = webhookGroups.find((g: any) => g.id && (g.id === sqId || g.id.startsWith(sqId + '-') || g.id.startsWith(sqId + '_')));
          if (!wg) wg = webhookRows.find((r: any) => (r.id || r.text) === sqId);
        }
        if (wg && wg.text !== undefined && wg.text !== '') {
          cols[key] = String(wg.text);
        } else if (wg?.options && Array.isArray(wg.options)) {
          // groups 的 nested options 格式（matrix_radio 风格但评分值在 text）
          const sel = wg.options.find((o: any) => o.checked === 1 || o.checked === true);
          cols[key] = sel?.score ?? sel?.text ?? '';
        } else {
          // groups 索引回退（如果 ID 匹配失败且顺序一致）
          const idx = fullSubQuestions.indexOf(fsq);
          const gi = webhookGroups[idx];
          if (gi && gi.text !== undefined && gi.text !== '') {
            cols[key] = String(gi.text);
          } else if (gi?.options) {
            const sel = gi.options.find((o: any) => o.checked === 1 || o.checked === true);
            cols[key] = sel?.score ?? sel?.text ?? '';
          } else {
            cols[key] = '';
          }
        }
      }
      break;
    }
    case 'matrix_checkbox': {
      // webhook: q.groups = [{ id, options: [{ id, checked, text }] }, ...]
      const fullSubQuestions = def.sub_titles || def.sub_questions || def.options || [];
      const matrixCols = def.options || [];
      const webhookGroups = q.groups || [];
      const webhookRows = q.rows || q.options || [];

      // 构建 ID 索引
      const groupsById = new Map<string, any>();
      for (const g of webhookGroups) {
        if (g.id) groupsById.set(g.id, g);
      }
      const rowsById = new Map<string, any>();
      for (const r of webhookRows) {
        const rid = r.id || r.text;
        if (rid) rowsById.set(rid, r);
      }

      for (const fsq of fullSubQuestions) {
        const sqId = fsq.id || fsq.text;
        // 注意：列头保留 fillblank 标记（对齐腾讯导出格式）
        const rowText = fsq.text || fsq.id || '';

        // 管道过滤：如果本题有管道源题且当前行不在选中范围内，所有 cell 输出空值
        if (pipedValidRowTexts && !pipedValidRowTexts.has(rowText.replace(/\{fillblank-[^}]+\}/g, ''))) {
          for (const col of matrixCols) {
            const colText = col.text || col.id || '';
            const cellKey = `${qNum}.${baseTitle}:${rowText}-${colText}`;
            cols[cellKey] = '';
          }
          continue;
        }
        // 优先按 ID 查找
        let wg = groupsById.get(sqId) || rowsById.get(sqId);
        if (!wg && sqId) {
          wg = webhookGroups.find((g: any) => g.id && (g.id === sqId || g.id.startsWith(sqId + '-') || g.id.startsWith(sqId + '_')));
          if (!wg) wg = webhookRows.find((r: any) => (r.id || r.text) === sqId);
        }
        // groups 索引回退
        if (!wg) {
          const idx = fullSubQuestions.indexOf(fsq);
          wg = webhookGroups[idx] || webhookRows[idx];
        }
        // 改为每个 cell 独立一列（对齐腾讯导出格式：{行}-{列}）
        for (const col of matrixCols) {
          const colId = col.id || col.text;
          const colText = col.text || col.id || '';
          const cellKey = `${qNum}.${baseTitle}:${rowText}-${colText}`;
          const opt = wg?.options?.find((o: any) =>
            (o.checked === 1 || o.checked === true) && (o.id === colId || norm(o.text) === norm(col.text))
          );
          if (opt) {
            const prefix = getLetterPrefix(colId, matrixCols);
            cols[cellKey] = prefix ? `${prefix}${opt.text || ''}` : (opt.text || '');
          } else {
            cols[cellKey] = '';
          }
        }
      }
      break;
    }
    case 'sort': {
      // webhook: q.options = [{ id, text:"", sort_no: N }, ...]
      // sort_no 即排名，text 为空 → 用 def.options 查文本
      const fullOpts = def.options || [];
      const webhookOpts = q.options || [];
      const webhookMap = new Map<string, any>();
      for (const o of webhookOpts) {
        const oid = o.id || o.text;
        if (oid) webhookMap.set(oid, o);
      }
      for (const fo of fullOpts) {
        const oid = fo.id || fo.text;
        const key = `${qNum}.${baseTitle}:${fo.text || fo.id}`;
        const wo = webhookMap.get(oid);
        if (wo) {
          // 优先 sort_no，其次 rank
          const rk = wo.sort_no ?? wo.rank;
          cols[key] = rk !== undefined ? String(rk) : '';
        } else {
          cols[key] = '';
        }
      }
      break;
    }
    case 'max_diff': {
      // webhook: q.max_diff = [[{ id, value: 1/-1/0 }, ...], ...]
      // 数组的数组，每层是一个 trial，value=1 最重要, -1 最不重要
      const fullOpts = def.options || []; // 用于 ID→文本查找
      const trials = q.max_diff || q.tasks || q.answer || [];
      trials.forEach((trial: any, ti: number) => {
        const tn = ti + 1;
        const items = Array.isArray(trial) ? trial : (trial.items || trial.options || [trial]);
        const itemTexts = items.map((it: any) => {
          // 从 fullOpts 查文本
          const fo = fullOpts.find((o: any) => o.id === it.id);
          return fo?.text || it.text || it.id || '';
        }).filter(Boolean).join('，');
        const mostItem = items.find((it: any) => it.value === 1);
        const leastItem = items.find((it: any) => it.value === -1);
        const mostFo = mostItem ? fullOpts.find((o: any) => o.id === mostItem.id) : null;
        const leastFo = leastItem ? fullOpts.find((o: any) => o.id === leastItem.id) : null;
        cols[`${qNum}.${baseTitle}_任务${tn}属性`] = itemTexts;
        cols[`${qNum}.${baseTitle}_任务${tn}最重要`] = mostFo?.text || mostItem?.text || mostItem?.id || '';
        cols[`${qNum}.${baseTitle}_任务${tn}最不重要`] = leastFo?.text || leastItem?.text || leastItem?.id || '';
      });
      break;
    }
    default:
      if (q.text !== undefined) {
        cols[`${qNum}.${baseTitle}`] = String(q.text);
      } else if (q.options) {
        const checked = (q.options || []).find((o: any) => o.checked === 1);
        cols[`${qNum}.${baseTitle}`] = checked?.text ?? '';
      }
  }
  return cols;
}

/** 无完整题目定义时的兜底逻辑（仅基于 webhook 数据生成列） */
function buildQuestionColumnsFallback(q: any, qNum: number, baseTitle: string, type: string): Record<string, string> {
  const cols: Record<string, string> = {};
  switch (type) {
    case 'radio':
    case 'select': {
      const opts = q.options || [];
      const checked = opts.find((o: any) => o.checked === 1 || o.checked === true);
      cols[`${qNum}.${baseTitle}`] = checked?.text ?? '';
      break;
    }
    case 'checkbox': {
      const opts = q.options || [];
      for (const o of opts) {
        const key = `${qNum}.${baseTitle}:${o.text || o.id}`;
        cols[key] = (o.checked === 1 || o.checked === true) ? (o.text || '') : '';
      }
      break;
    }
    case 'matrix_radio':
    case 'matrix_single':
    case 'matrix_star':
    case 'matrix_checkbox': {
      const rows = q.groups || q.rows || q.options || [];
      for (const r of rows) {
        const key = `${qNum}.${baseTitle}:${r.text || r.id}`;
        if (type === 'matrix_star') {
          cols[key] = r.text ?? '';
        } else {
          const sel = (r.options || []).find((o: any) => o.checked === 1 || o.checked === true);
          cols[key] = sel?.text ?? sel?.score ?? '';
        }
      }
      break;
    }
    case 'sort': {
      const items = q.options || [];
      for (const item of items) {
        const key = `${qNum}.${baseTitle}:${item.text || item.id}`;
        const rk = item.sort_no ?? item.rank;
        cols[key] = rk !== undefined ? String(rk) : '';
      }
      break;
    }
    case 'max_diff': {
      const trials = q.max_diff || q.tasks || q.answer || [];
      trials.forEach((trial: any, ti: number) => {
        const tn = ti + 1;
        const items = Array.isArray(trial) ? trial : (trial.items || trial.options || [trial]);
        const itemTexts = items.map((it: any) => it.text || it.id || '').filter(Boolean).join('，');
        const mostItem = items.find((it: any) => it.value === 1);
        const leastItem = items.find((it: any) => it.value === -1);
        cols[`${qNum}.${baseTitle}_任务${tn}属性`] = itemTexts;
        cols[`${qNum}.${baseTitle}_任务${tn}最重要`] = mostItem?.text || mostItem?.id || '';
        cols[`${qNum}.${baseTitle}_任务${tn}最不重要`] = leastItem?.text || leastItem?.id || '';
      });
      break;
    }
    case 'star':
    case 'nps':
      if (q.score !== undefined && q.score !== null) {
        cols[`${qNum}.${baseTitle}`] = String(q.score);
      } else if (q.text !== undefined && q.text !== null) {
        cols[`${qNum}.${baseTitle}`] = String(q.text);
      } else {
        const checked = (q.options || []).find((o: any) => o.checked === 1);
        cols[`${qNum}.${baseTitle}`] = checked?.text ?? '';
      }
      break;
    case 'blanks': {
      const blanks = q.blanks || [];
      let flatBlanks: any[] = [];
      if (blanks.length > 0 && Array.isArray(blanks[0])) {
        flatBlanks = blanks[0];
      } else {
        flatBlanks = blanks;
      }
      flatBlanks.forEach((b: any, i: number) => {
        cols[`${qNum}.${baseTitle}_填空${i + 1}`] = b.value ?? b.text ?? '';
      });
      break;
    }
    default:
      if (q.text !== undefined) cols[`${qNum}.${baseTitle}`] = String(q.text);
  }
  return cols;
}

function ExportTab({ project, answerRecords }: { project: Project; answerRecords: AnswerRecord[] }) {
  const handleExport = async (type: string) => {
      // ---- 0. 获取问卷完整结构（用于计算字母前缀） ----
      let questionDefs: Map<string, any> = new Map();
      try {
        const structure = await projectApi.getSurveyStructure(project.id);
        for (const q of structure.questions) {
          questionDefs.set(q.id, q);
        }
      } catch (e) {
        console.warn('获取问卷结构失败（字母前缀将缺失）:', e);
      }

    if (type?.includes('答题')) {
      // 1. 从每条记录的 raw_data.webhook 解析答案
      const parsedRecords: { headers: string[]; row: Record<string, string>; openid: string }[] = [];

      for (const record of answerRecords) {
        try {
          const raw = JSON.parse(record.raw_data || '{}');
          const payload = raw.payload || {};
          const pages = payload.answer || [];

          // 收集 webhook 题目（跳过 custom_args），按 ID 索引
          const webhookQuestionMap = new Map<string, any>();
          for (const page of pages) {
            if (page.id === 'custom_args') continue;
            if (page.questions && Array.isArray(page.questions)) {
              for (const wq of page.questions) {
                webhookQuestionMap.set(wq.id, wq);
              }
            }
          }

          // 计算管道过滤：checkbox 选中项→过滤下游 matrix 行（对齐腾讯导出）
          // 关键修复：webhook 中 checkbox 只包含已选中选项，全部选项需从 questionDefs 获取
          // 否则 allOptionTexts 只有2个选项，无法满足 ≥50% 重叠阈值（需≥4/7），管道检测失败
          // 后果：下游 matrix 走索引回退，抖音(index 0)错误拿到 B站(index 0)的答案
          const pipingFilter = new Map<string, Set<string>>();
          for (const [cqid, cq] of webhookQuestionMap) {
            if (cq.type === 'checkbox') {
              const cqDef = questionDefs.get(cqid);
              if (!cqDef?.options) continue;
              const structureOpts: any[] = cqDef.options;
              // 从 webhook 获取选中选项的 ID 集合
              const checkedIds = new Set<string>(
                (cq.options || []).filter((o: any) => o.checked === 1 || o.checked === true).map((o: any) => o.id)
              );
              if (checkedIds.size === 0) continue;
              // 从 questionDefs（完整结构）获取全部选项文本 → 保证管道检测有完整选项集
              const allOptionTexts = new Set<string>(
                structureOpts.map((o: any) => (o.text || '').replace(/\{fillblank-[^}]+\}/g, ''))
              );
              if (allOptionTexts.size < 2) continue;
              // 从 questionDefs 获取选中选项文本 → 保证文本与 matrix sub_titles 格式一致
              const checkedTexts = new Set<string>(
                structureOpts.filter((o: any) => checkedIds.has(o.id))
                  .map((o: any) => (o.text || '').replace(/\{fillblank-[^}]+\}/g, ''))
              );
              for (const [mqid, mqDef] of questionDefs) {
                if (mqid === cqid) continue;
                if (mqDef.type === 'matrix_star' || mqDef.type === 'matrix_checkbox') {
                  const subQuestions = mqDef.sub_titles || mqDef.sub_questions || [];
                  const rowTexts = subQuestions.map((sq: any) => (sq.text || '').replace(/\{fillblank-[^}]+\}/g, '')).filter(Boolean);
                  if (rowTexts.length < 2) continue;
                  const overlapCount = rowTexts.filter((t: string) => allOptionTexts.has(t)).length;
                  if (overlapCount > 0 && overlapCount >= rowTexts.length * 0.5) {
                    pipingFilter.set(mqid, checkedTexts);
                  }
                }
              }
            }
          }

          // 按完整问卷结构顺序生成所有题目的列（含 webhook 中缺失的题）
          const questionCols: Record<string, string> = {};
          let qIdx = 0;
          for (const def of questionDefs.values()) {
            qIdx++;
            const wq = webhookQuestionMap.get(def.id);
            if (wq) {
              // webhook 有数据 → 正常构建
              Object.assign(questionCols, buildQuestionColumns(wq, qIdx, qIdx - 1, questionDefs, pipingFilter));
            } else {
              // webhook 缺失该题 → 用题目定义构建空列头
              const dummyQ = { id: def.id, title: def.title || def.id, type: def.type };
              Object.assign(questionCols, buildQuestionColumns(dummyQ, qIdx, qIdx - 1, questionDefs, pipingFilter));
            }
          }

          // ---- 构建完整行（对齐腾讯CSV列顺序） ----
          const row: Record<string, string> = {};

          // 编号
          row['编号'] = String(payload.answer_id || record.id);

          // 开始答题时间 / 结束答题时间 / 答题时长
          row['开始答题时间'] = payload.started_at ? formatTencentDate(payload.started_at) : '';
          row['结束答题时间'] = payload.ended_at ? formatTencentDate(payload.ended_at) : '';
          row['答题时长'] = payload.duration != null ? String(payload.duration) : '';

          // 题目答案列
          Object.assign(row, questionCols);

          // 固定尾列（腾讯标准）
          row['语言'] = '简体中文';
          row['清洗数据结果'] = '未清洗';
          row['智能清洗数据无效概率'] = '';
          row['地理位置国家和地区'] = payload.country || '';
          row['地理位置省'] = payload.province || '';
          row['地理位置市'] = payload.city || '';
          row['自定义字段'] = '';

          // IP 打码：统一使用腾讯 IPv4 风格（第一段 + 35个*，对齐腾讯导出）
          const ipRaw = payload.ip || '';
          if (ipRaw) {
            // 取第一个非数字字符之前的部分（对 IPv4 是第一个点之前，对 IPv6 是第一个冒号之前）
            const firstSep = ipRaw.search(/[.:]/);
            const prefix = firstSep > 0 ? ipRaw.substring(0, firstSep) : ipRaw;
            row['IP'] = prefix + '***********************************';
          } else {
            row['IP'] = '';
          }

          row['UA'] = payload.ua || '';
          row['Referrer'] = payload.referrer || '';

          // userid（从 custom_args 提取）
          let userid = '';
          for (const page of pages) {
            if (page.id === 'custom_args' && Array.isArray(page.questions)) {
              const uidQ = page.questions.find((q: any) => q.title === 'userid' || q.id === 'custom-arg-01');
              if (uidQ?.text) { userid = uidQ.text; break; }
            }
          }
          row['userid'] = userid;

          // 2. 收集列头顺序，保持记录间一致
          const headers = Object.keys(row);
          parsedRecords.push({ headers, row, openid: userid });
        } catch {
          // raw_data parse failed, skip
        }
      }

      // 3. 收集所有列头（跨记录合并，保持首次出现顺序 + 固定尾列顺序）
      const allHeaders: string[] = [];
      const seen = new Set<string>();
      // 固定前置列
      const prefixCols = ['编号', '开始答题时间', '结束答题时间', '答题时长'];
      for (const h of prefixCols) { if (!seen.has(h)) { seen.add(h); allHeaders.push(h); } }

      // 题目列（跨所有记录收集，去重）
      for (const pr of parsedRecords) {
        for (const h of pr.headers) {
          if (!seen.has(h) && !prefixCols.includes(h)) {
            seen.add(h);
            // 缓冲题目列，稍后插入在固定尾列之前
          }
        }
      }

      // 固定尾列
      const suffixCols = ['语言', '清洗数据结果', '智能清洗数据无效概率', '地理位置国家和地区', '地理位置省', '地理位置市', '自定义字段', 'IP', 'UA', 'Referrer', 'userid'];

      // 重组：前置列 → 题目列（顺序来自第一次出现的记录） → 尾列
      const midCols: string[] = [];
      const midSeen = new Set<string>();
      for (const pr of parsedRecords) {
        for (const h of pr.headers) {
          if (!prefixCols.includes(h) && !suffixCols.includes(h) && !midSeen.has(h)) {
            midSeen.add(h);
            midCols.push(h);
          }
        }
      }
      for (const h of midCols) allHeaders.push(h);
      for (const h of suffixCols) allHeaders.push(h);

      // 4. 批量获取用户画像（并发查询所有 distinct openid）
      const uniqueOpenids = [...new Set(parsedRecords.map(pr => pr.openid).filter(Boolean))];
      const profileMap: Record<string, any> = {};
      if (uniqueOpenids.length > 0) {
        const BATCH_SIZE = 5;
        for (let i = 0; i < uniqueOpenids.length; i += BATCH_SIZE) {
          const chunk = uniqueOpenids.slice(i, i + BATCH_SIZE);
          const results = await Promise.allSettled(
            chunk.map(openid =>
              userApi.get(openid).then(u => ({ openid, u })).catch(() => ({ openid, u: null }))
            )
          );
          for (const r of results) {
            if (r.status === 'fulfilled' && r.value.u) {
              profileMap[r.value.openid] = r.value.u;
            }
          }
        }
      }

      // 画像列（附在腾讯标准列之后）
      const profileColumns = ['画像_性别', '画像_年龄', '画像_学历', '画像_省', '画像_市', '画像_区', '画像_城市级别', '画像_行业', '画像_职业', '画像_收入', '画像_注册时间'];
      const tierLabels: Record<string, string> = { tier1: '一线城市', tier2: '二线城市', tier3: '三线城市', tier4: '四线城市', tier5: '五线城市', other: '其他' };

      // 5. 构建行数据（腾讯标准列 + 画像列）
      const rows = parsedRecords.map(pr => {
        const rowData: Record<string, string> = {};
        // 腾讯标准列
        for (const h of allHeaders) {
          rowData[h] = pr.row[h] || '';
        }
        // 画像列
        const profile = profileMap[pr.openid];
        if (profile) {
          rowData['画像_性别'] = profile.gender || '';
          const birthYear = profile.birth_year;
          rowData['画像_年龄'] = birthYear ? String(new Date().getFullYear() - birthYear) : '';
          rowData['画像_学历'] = profile.education || '';
          rowData['画像_省'] = profile.province || '';
          rowData['画像_市'] = profile.city || '';
          rowData['画像_区'] = profile.district || '';
          rowData['画像_城市级别'] = tierLabels[profile.city_tier] || profile.city_tier || '';
          rowData['画像_行业'] = profile.industry || '';
          rowData['画像_职业'] = profile.occupation || '';
          rowData['画像_收入'] = profile.income || '';
          rowData['画像_注册时间'] = profile.registered_at ? formatBJTime(profile.registered_at) : '';
        } else {
          for (const pc of profileColumns) rowData[pc] = '';
        }
        return rowData;
      });

      // 最终列头：腾讯标准列 + 画像列
      const finalHeaders = [...allHeaders, ...profileColumns];

      // 防 CSV 公式注入：以 = + - @ 开头的字符串前加单引号，避免被 Excel 解析为公式
      const sanitizeCell = (v: unknown): unknown =>
        typeof v === 'string' && /^[=+\-@]/.test(v) ? `'${v}` : v;
      const safeRows = rows.map((r) => {
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(r)) out[k] = sanitizeCell(r[k]);
        return out;
      });

      // 6. 生成 Excel
      const ws = XLSX.utils.json_to_sheet(safeRows, { header: finalHeaders });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '答题数据');

      // 列宽
      ws['!cols'] = finalHeaders.map((h) => ({
        wch: h.startsWith('画像_') ? 14 : h.includes('.') ? 24 : h.length > 10 ? 20 : 14,
      }));

      const projectCode = project.project_code || '';
      XLSX.writeFile(wb, `答题数据_${projectCode}.xlsx`);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-2">数据导出</h2>
        <p className="text-sm text-gray-500 mb-6">项目可导出完整数据，包含答题记录与用户画像的匹配合并</p>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
            <div>
              <h3 className="font-medium text-gray-900">答题数据（含画像）</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                导出所有用户的完整答题记录，并附带用户画像数据（Excel 格式）
              </p>
              <p className="text-xs text-blue-600 mt-1">
                前半部分为每题答案，后半部分为画像（性别、年龄、学历、地区、行业、职业、收入等）
              </p>
            </div>
            <button
              onClick={() => handleExport('答题数据（含画像）')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm"
            >
              导出
            </button>
          </div>

          {/* 红包发放记录按钮已删除（功能迁移到"红包记录" tab） */}
        </div>
      </div>
    </div>
  );
}
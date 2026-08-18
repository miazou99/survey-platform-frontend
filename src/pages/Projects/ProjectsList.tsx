import { useState, useMemo, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Search,
  LayoutGrid,
  List,
  Plus,
  Clock,
  Users,
  TrendingUp,
  FileText,
  Inbox,
  Trash2,
  FolderKanban,
  AlertCircle,
} from 'lucide-react';
import { Project, ProjectStatus } from '../../types/types';
import { projectApi } from '../../services/api';
import StatusBadge from '../../components/StatusBadge/StatusBadge';
import ProgressBar from '../../components/ProgressBar/ProgressBar';
import EmptyState from '../../components/EmptyState/EmptyState';

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bgColor: string; hoverBg: string }> = {
  draft: { label: '草稿', color: 'text-gray-600', bgColor: 'bg-gray-100', hoverBg: 'hover:bg-gray-50' },
  pending: { label: '待发红包', color: 'text-orange-600', bgColor: 'bg-orange-100', hoverBg: 'hover:bg-orange-50' },
  pending_hongbao: { label: '待发红包', color: 'text-orange-600', bgColor: 'bg-orange-100', hoverBg: 'hover:bg-orange-50' },
  active: { label: '进行中', color: 'text-green-600', bgColor: 'bg-green-100', hoverBg: 'hover:bg-green-50' },
  in_progress: { label: '进行中', color: 'text-green-600', bgColor: 'bg-green-100', hoverBg: 'hover:bg-green-50' },
  paused: { label: '已暂停', color: 'text-yellow-600', bgColor: 'bg-yellow-100', hoverBg: 'hover:bg-yellow-50' },
  completed: { label: '已完成', color: 'text-blue-600', bgColor: 'bg-blue-100', hoverBg: 'hover:bg-blue-50' },
};

export default function ProjectsList() {
  const location = useLocation();
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载项目列表
  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await projectApi.list();
      console.log('API返回数据:', response);
      // 确保返回的是数组
      let data: any[] = [];
      if (Array.isArray(response)) {
        data = response;
      } else if (response && typeof response === 'object' && 'data' in response) {
        data = Array.isArray((response as any).data) ? (response as any).data : [];
      } else if (response && typeof response === 'object') {
        // 如果是其他对象格式，尝试提取
        data = Object.values(response).filter(Array.isArray).flat();
      }
      setProjects(data);
    } catch (err: any) {
      console.error('加载项目列表失败:', err);
      setError(err.message || '加载失败，请检查后端服务是否启动');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载 + 路由变化时刷新
  useEffect(() => {
    loadProjects();
  }, [location.key]);

  const allProjects = useMemo(() => projects, [projects]);

  const filteredProjects = useMemo(() => {
    return allProjects.filter((project) => {
      let matchesStatus = true;
      if (statusFilter !== 'all') {
        switch (statusFilter) {
          case 'active':
            matchesStatus = project.status === 'active' || project.status === 'in_progress';
            break;
          case 'pending_hongbao':
            matchesStatus = project.status === 'pending' || project.status === 'pending_hongbao';
            break;
          default:
            matchesStatus = project.status === statusFilter;
        }
      }
      const matchesSearch =
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (project.project_code && project.project_code.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesStatus && matchesSearch;
    });
  }, [allProjects, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((p) => p.status === 'active' || p.status === 'in_progress').length;
    const pendingHongbao = projects.filter((p) => p.status === 'pending' || p.status === 'pending_hongbao').length;
    const paused = projects.filter((p) => p.status === 'paused').length;
    const completed = projects.filter((p) => p.status === 'completed').length;
    const draft = projects.filter((p) => p.status === 'draft').length;
    // 平均响应率只计算已完成的项目
    const completedProjects = projects.filter((p) => p.status === 'completed');
    const avgResponseRate = completedProjects.length > 0
      ? completedProjects.reduce((sum, p) => sum + p.response_rate, 0) / completedProjects.length
      : 0;

    return { total, active, pendingHongbao, paused, completed, draft, avgResponseRate };
  }, [projects]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    const bj = new Date(d.getTime() + 8 * 60 * 60 * 1000);
    return `${String(bj.getUTCMonth() + 1).padStart(2, '0')}/${String(bj.getUTCDate()).padStart(2, '0')}`;
  };

  const calculateProgress = (project: Project) => {
    if (project.status === 'draft') return 0;
    return Math.round((project.sent_samples / project.total_samples) * 100);
  };

  const statCards = [
    { key: 'all' as const, label: '项目总数', value: stats.total, color: 'text-gray-900' },
    { key: 'active' as const, label: '进行中', value: stats.active, color: 'text-green-600' },
    { key: 'pending_hongbao' as const, label: '待发红包', value: stats.pendingHongbao, color: 'text-orange-600' },
    { key: 'paused' as const, label: '已暂停', value: stats.paused, color: 'text-yellow-600' },
    { key: 'completed' as const, label: '已完成', value: stats.completed, color: 'text-blue-600' },
    { key: 'draft' as const, label: '草稿箱', value: stats.draft, color: 'text-gray-600' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* 顶部可点击的状态筛选卡片 */}
      <div className="p-6 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-6 gap-4">
          {statCards.map(({ key, label, value, color }) => {
            const isActive = statusFilter === key;
            const statusCfg = key !== 'all' ? STATUS_CONFIG[key] : null;
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`
                  bg-white rounded-lg p-4 border-2 shadow-sm transition text-left
                  ${isActive
                    ? `border-blue-500 ring-2 ring-blue-100 ${statusCfg?.bgColor || 'bg-blue-50'}`
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                  }
                `}
              >
                <div className="flex items-center gap-2 mb-1">
                  {key === 'draft' && <Inbox className="w-4 h-4 text-gray-400" />}
                  {key === 'active' && <Clock className="w-4 h-4 text-green-500" />}
                  {key === 'pending_hongbao' && <Users className="w-4 h-4 text-orange-500" />}
                  {key === 'completed' && <FileText className="w-4 h-4 text-blue-500" />}
                  {key === 'all' && <TrendingUp className="w-4 h-4 text-gray-500" />}
                  <span className="text-sm text-gray-500">{label}</span>
                </div>
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 工具栏 */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索项目名称或编号..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-3 ml-6">
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('card')}
              className={`px-3 py-2 flex items-center gap-1.5 text-sm ${
                viewMode === 'card' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              卡片
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 flex items-center gap-1.5 text-sm ${
                viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <List className="w-4 h-4" />
              列表
            </button>
          </div>

          <Link
            to="/projects/new"
            className="bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            新建项目
          </Link>
        </div>
      </div>

      {/* 项目列表 */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500">加载中...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-red-500 mb-4">{error}</p>
              <button
                onClick={loadProjects}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                重试
              </button>
            </div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <EmptyState icon={FolderKanban} title="暂无匹配的项目" />
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-3 gap-6">
            {filteredProjects.map((project) => {
              const progress = calculateProgress(project);
              const statusConfig = STATUS_CONFIG[project.status];

              return (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg hover:border-blue-300 transition group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 text-lg truncate group-hover:text-blue-600 transition">
                        {project.name}
                      </h3>
                      <p className="text-sm text-gray-400 font-mono mt-0.5">{project.project_code}</p>
                    </div>
                    <div className="relative">
                      <StatusBadge status={project.status} />
                      {/* 模拟项目标识 */}
                      {['1', '2', '3', '4'].includes(project.id) && (
                        <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-xs bg-gray-200 text-gray-600 rounded font-medium">
                          模拟
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeleteConfirm(project.id);
                        }}
                        className="absolute -top-1 -left-1 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition opacity-0 group-hover:opacity-100"
                        title="删除项目"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDate(project.start_time)} - {formatDate(project.end_time)}
                    </span>
                  </div>

                  {project.status !== 'draft' && (
                    <>
                      <ProgressBar value={progress} color="blue" showLabel label="推送率" />
                    </>
                  )}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-bold text-gray-600">项目名称</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-600">项目编号</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-600">状态</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-600">时间范围</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-600">推送率</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProjects.map((project) => {
                  const progress = calculateProgress(project);
                  const statusConfig = STATUS_CONFIG[project.status];

                  return (
                    <tr key={project.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <Link
                          to={`/projects/${project.id}`}
                          className="font-medium text-gray-900 hover:text-blue-600"
                        >
                          {project.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-500">{project.project_code}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={project.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatDate(project.start_time)} - {formatDate(project.end_time)}
                      </td>
                      <td className="px-4 py-3">
                        {project.status !== 'draft' ? (
                          <div className="flex items-center gap-2">
                            <div className="w-20">
                              <ProgressBar value={progress} color="blue" size="sm" />
                            </div>
                            <span className="text-gray-900 font-bold">{progress}%</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            setDeleteConfirm(project.id);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                          title="删除项目"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 删除确认弹窗 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">确认删除项目</h3>
                <p className="text-sm text-gray-500">删除后数据无法恢复</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setDeleteConfirm(null); setDeleteError(null); }}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  setDeleting(true);
                  setDeleteError(null);
                  try {
                    console.log('[Delete] 开始删除项目:', deleteConfirm);
                    const result = await projectApi.delete(deleteConfirm!);
                    console.log('[Delete] 删除成功:', result);
                    setDeleteConfirm(null);
                    setDeleteError(null);
                    await loadProjects();
                  } catch (err: any) {
                    console.error('[Delete] 删除失败:', err);
                    setDeleteError(err.message || '请重试');
                  } finally {
                    setDeleting(false);
                  }
                }}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleting ? '删除中...' : '确认删除'}
              </button>
            </div>

            {deleteError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{deleteError}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
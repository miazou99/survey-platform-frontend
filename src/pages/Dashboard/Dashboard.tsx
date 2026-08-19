import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  FolderKanban,
  CheckCircle,
  TrendingUp,
  Clock,
  Users,
  FileText,
  Inbox,
  LayoutGrid,
  List,
} from 'lucide-react';
import { projectApi } from '../../services/api';
import { Project, ProjectStatus } from '../../types/types';
import StatusBadge from '../../components/StatusBadge/StatusBadge';
import ProgressBar from '../../components/ProgressBar/ProgressBar';
import EmptyState from '../../components/EmptyState/EmptyState';

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  draft: { label: '草稿', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: <Inbox className="w-4 h-4" /> },
  pending: { label: '待发红包', color: 'text-orange-600', bgColor: 'bg-orange-100', icon: <Users className="w-4 h-4" /> },
  pending_hongbao: { label: '待发红包', color: 'text-orange-600', bgColor: 'bg-orange-100', icon: <Users className="w-4 h-4" /> },
  active: { label: '进行中', color: 'text-green-600', bgColor: 'bg-green-100', icon: <Clock className="w-4 h-4" /> },
  in_progress: { label: '进行中', color: 'text-green-600', bgColor: 'bg-green-100', icon: <Clock className="w-4 h-4" /> },
  paused: { label: '已暂停', color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: <Clock className="w-4 h-4" /> },
  completed: { label: '已完成', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: <FileText className="w-4 h-4" /> },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // 加载项目列表
  useEffect(() => {
    const loadProjects = async () => {
      setLoading(true);
      try {
        const response = await projectApi.list();
        let data: any[] = [];
        if (Array.isArray(response)) {
          data = response;
        } else if (response && typeof response === 'object' && 'data' in response) {
          data = Array.isArray((response as any).data) ? (response as any).data : [];
        }
        setProjects(data as Project[]);
      } catch (err) {
        console.error('加载项目列表失败:', err);
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };
    loadProjects();
  }, []);

  const stats = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((p) => p.status === 'active' || p.status === 'in_progress').length;
    const pendingHongbao = projects.filter((p) => p.status === 'pending' || p.status === 'pending_hongbao').length;
    const completed = projects.filter((p) => p.status === 'completed').length;
    const draft = projects.filter((p) => p.status === 'draft').length;
    // 平均响应率只计算已完成的项目
    const completedProjects = projects.filter((p) => p.status === 'completed');
    const avgResponse = completedProjects.length > 0
      ? completedProjects.reduce((sum, p) => sum + p.response_rate, 0) / completedProjects.length
      : 0;
    return { total, active, pendingHongbao, completed, draft, avgResponse };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
      const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [projects, statusFilter, searchTerm]);

  const statCards = [
    { key: 'all' as const, label: '项目总数', value: stats.total, icon: <TrendingUp className="w-5 h-5" />, colorClass: 'text-gray-900' },
    { key: 'active' as const, label: '进行中', value: stats.active, icon: <Clock className="w-5 h-5" />, colorClass: 'text-green-600' },
    { key: 'pending_hongbao' as const, label: '待发红包', value: stats.pendingHongbao, icon: <Users className="w-5 h-5" />, colorClass: 'text-orange-600' },
    { key: 'completed' as const, label: '已完成', value: stats.completed, icon: <FileText className="w-5 h-5" />, colorClass: 'text-blue-600' },
    { key: 'draft' as const, label: '草稿箱', value: stats.draft, icon: <Inbox className="w-5 h-5" />, colorClass: 'text-gray-600' },
  ];

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

  const calculateResponseRate = (project: Project) => {
    if (project.status === 'draft' || project.sent_samples === 0) return 0;
    return Math.round((project.collected_samples / project.sent_samples) * 100);
  };

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* 顶部状态筛选卡片 */}
      <div className="p-4 md:p-6 bg-gray-50 border-b border-gray-200">
        {/* 5个状态卡片 - 响应式：手机2列 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          {statCards.map(({ key, label, value, icon, colorClass }) => {
            const isActive = statusFilter === key;
            const statusCfg = key !== 'all' ? STATUS_CONFIG[key] : null;
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`
                  bg-white rounded-lg p-3 md:p-4 border-2 shadow-sm transition text-left
                  ${isActive
                    ? `border-blue-500 ring-2 ring-blue-100 ${statusCfg?.bgColor || 'bg-blue-50'}`
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                  }
                `}
              >
                <div className="flex items-center gap-2 mb-1 md:mb-2">
                  <span className={isActive ? (statusCfg?.color || 'text-gray-500') : 'text-gray-400'}>
                    {icon}
                  </span>
                  <span className="text-xs md:text-sm text-gray-500">{label}</span>
                </div>
                <div className={`text-xl md:text-2xl font-bold ${colorClass}`}>{value}</div>
              </button>
            );
          })}
        </div>

        {/* 平均响应率 */}
        <div className="mt-3 md:mt-4 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
          <div className="bg-white rounded-lg px-3 md:px-4 py-2 border border-gray-200 shadow-sm flex items-center gap-3">
            <span className="text-sm text-gray-500">平均响应率</span>
            <span className="text-lg font-bold text-green-600">{stats.avgResponse.toFixed(1)}%</span>
          </div>
          <div className="text-xs text-gray-400 md:ml-2">
            基于 {stats.completed} 个已完成项目计算
          </div>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 md:p-6 border-b border-gray-200 bg-white gap-3">
        <div className="relative w-full md:w-auto md:flex-1 md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索项目名称..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-auto pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('card')}
              className={`px-3 py-2 flex items-center gap-1.5 text-sm ${
                viewMode === 'card' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">卡片</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 flex items-center gap-1.5 text-sm ${
                viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">列表</span>
            </button>
          </div>

          <button
            onClick={() => navigate('/projects/new')}
            className="bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 text-sm font-medium shadow-sm"
          >
            <Plus className="w-4 h-4" />
            新建项目
          </button>
        </div>
      </div>

      {/* 项目列表 */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Clock className="w-5 h-5 animate-spin mr-2" />
            加载中...
          </div>
        ) : filteredProjects.length === 0 ? (
          <EmptyState icon={FolderKanban} title="暂无匹配的项目" />
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filteredProjects.map((project) => {
              const progress = calculateProgress(project);
              const responseRate = calculateResponseRate(project);
              const statusConfig = STATUS_CONFIG[project.status];

              return (
                <div
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg hover:border-blue-300 transition cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 text-lg truncate group-hover:text-blue-600 transition">
                        {project.name}
                      </h3>
                      <p className="text-sm text-gray-400 font-mono mt-0.5">{project.project_code}</p>
                    </div>
                    <StatusBadge status={project.status} />
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDate(project.start_time)} - {formatDate(project.end_time)}
                    </span>
                  </div>

                  {project.status !== 'draft' && (
                    <>
                      <div className="mb-3">
                        <ProgressBar value={progress} color="blue" showLabel label="推送率" />
                      </div>
                      <ProgressBar value={responseRate} color="green" showLabel label="响应率" />
                    </>
                  )}

                  {project.status === 'draft' && (
                    <div className="text-center py-8 text-gray-400">
                      <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">草稿状态，尚未开始投放</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-bold text-gray-600">项目名称</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-600">项目编号</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-600">状态</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-600">时间范围</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-600">推送率</th>
                  <th className="text-left px-4 py-3 font-bold text-gray-600">响应率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProjects.map((project) => {
                  const progress = calculateProgress(project);
                  const responseRate = calculateResponseRate(project);
                  const statusConfig = STATUS_CONFIG[project.status];

                  return (
                    <tr
                      key={project.id}
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className="hover:bg-gray-50 transition cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900 hover:text-blue-600">
                          {project.name}
                        </span>
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
                        {project.status !== 'draft' ? (
                          <span className="font-bold text-green-600">{responseRate}%</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
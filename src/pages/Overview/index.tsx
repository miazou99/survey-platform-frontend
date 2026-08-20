import { useState, useMemo, useEffect } from 'react';
import { showToast, showConfirm } from '../../components/Toast';
import {
  Users,
  Send,
  CheckCircle,
  FolderKanban,
  TrendingUp,
  Target,
  Clock,
  Calendar,
  UserPlus,
  Download,
  Gift,
  AlertTriangle,
  Wallet,
  ChevronDown,
  FileText,
  PauseCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import UserStatsCard from '../../components/UserStatsCard/UserStatsCard';
import { getUserStats, getValidUsers, getValidUsersWithProfile, getPendingUserList, getAllFollowedUserList } from '../../services/userService';
import { projectApi } from '../../services/api';

export default function Overview() {
  const [openExportMenu, setOpenExportMenu] = useState<string | null>(null);
  const [userStatsData, setUserStatsData] = useState<{
    total: number;
    validUsers: number;
    pendingUsers: number;
    sentSamples: number;
    completedSamples: number;
  }>({ total: 0, validUsers: 0, pendingUsers: 0, sentSamples: 0, completedSamples: 0 });
  const [projectStats, setProjectStats] = useState<{
    totalSentSamples: number;
    totalCollectedSamples: number;
    projectStats: {
      total: number;
      draft: number;
      pending: number;
      inProgress: number;
      completed: number;
      paused: number;
    };
    avgPushRate: number;
    avgResponseRate: number;
  }>({
    totalSentSamples: 0,
    totalCollectedSamples: 0,
    projectStats: { total: 0, draft: 0, pending: 0, inProgress: 0, completed: 0, paused: 0 },
    avgPushRate: 0,
    avgResponseRate: 0,
  });

  const [hongbaoOverview, setHongbaoOverview] = useState<{
    totalExpense: number;
    successCount: number;
    failedCount: number;
    avgPerPerson: number;
  }>({ totalExpense: 0, successCount: 0, failedCount: 0, avgPerPerson: 0 });


  // 加载用户统计数据
  useEffect(() => {
    getUserStats().then(setUserStatsData).catch(() => {
      setUserStatsData({ total: 0, validUsers: 0, pendingUsers: 0, sentSamples: 0, completedSamples: 0 });
    });
  }, []);

  // 加载项目统计数据
  useEffect(() => {
    projectApi.getStatistics().then(data => {
      setProjectStats(data);
    }).catch(() => {
      setProjectStats({
        totalSentSamples: 0,
        totalCollectedSamples: 0,
        projectStats: { total: 0, draft: 0, pending: 0, inProgress: 0, completed: 0, paused: 0 },
        avgPushRate: 0,
        avgResponseRate: 0,
      });
    });
  }, []);

  // 加载红包概览统计数据
  useEffect(() => {
    projectApi.getHongbaoOverview().then(data => {
      setHongbaoOverview(data);
    }).catch(() => {
      setHongbaoOverview({ totalExpense: 0, successCount: 0, failedCount: 0, avgPerPerson: 0 });
    });
  }, []);


  // 点击外部关闭导出菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // 如果点击的不是按钮或菜单内部，则关闭菜单
      if (!target.closest('[data-export-menu]')) {
        setOpenExportMenu(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const stats = useMemo(() => {
    // 用户统计（基于有效用户体系）
    const userStats = userStatsData;

    // 项目统计（使用真实数据）
    const { projectStats: ps, totalSentSamples, avgPushRate, avgResponseRate } = projectStats;
    const totalProjects = ps.total;
    const activeProjects = ps.inProgress;
    const pendingHongbao = ps.pending;
    const completedProjects = ps.completed;
    const draftProjects = ps.draft;
    const pausedProjects = ps.paused ?? 0;

    // 红包统计（全平台汇总）
    const hongbaoStats = hongbaoOverview;

    // 效率指标
    const realAvgPushRate = avgPushRate || 0;
    const realAvgResponseRate = avgResponseRate || 0;

    return {
      userStats,
      totalProjects,
      activeProjects,
      pendingHongbao,
      completedProjects,
      draftProjects,
      pausedProjects,
      totalSentSamples,
      totalCollectedSamples: projectStats.totalCollectedSamples,
      avgPushRate: realAvgPushRate,
      avgResponseRate: realAvgResponseRate,
      hongbaoStats,
    };
  }, [userStatsData, projectStats, hongbaoOverview]);

  // 用户数据卡片
  const userStatCards = [
    {
      label: '有效用户',
      value: stats.userStats.validUsers,
      icon: Users,
      color: 'blue' as const,
      description: '关注公众号且完成注册，可通过模板消息触达',
    },
    {
      label: '待转化用户',
      value: stats.userStats.pendingUsers,
      icon: UserPlus,
      color: 'orange' as const,
      description: '关注公众号但未完成注册，需要激活',
    },
    {
      label: '成功发放人次',
      value: stats.totalSentSamples || 0,
      icon: Send,
      color: 'green' as const,
      description: '已完成项目的成功发放人数累计',
    },
    {
      label: '已答题人次',
      value: stats.totalCollectedSamples,
      icon: CheckCircle,
      color: 'purple' as const,
      description: '已完成项目的答题人数累计',
    },
  ];

  const projectCards = [
    {
      label: '项目总数',
      value: stats.totalProjects,
      icon: FolderKanban,
      color: 'gray',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-600',
    },
    {
      label: '进行中',
      value: stats.activeProjects,
      icon: Clock,
      color: 'green',
      bgColor: 'bg-green-100',
      textColor: 'text-green-600',
    },
    {
      label: '待发红包',
      value: stats.pendingHongbao,
      icon: Calendar,
      color: 'orange',
      bgColor: 'bg-orange-100',
      textColor: 'text-orange-600',
    },
    {
      label: '已完成',
      value: stats.completedProjects,
      icon: CheckCircle,
      color: 'blue',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-600',
    },
    {
      label: '暂停',
      value: stats.pausedProjects,
      icon: PauseCircle,
      color: 'yellow',
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-600',
    },
    {
      label: '草稿',
      value: stats.draftProjects,
      icon: FileText,
      color: 'gray',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-500',
    },
  ]; 

  const rateCards = [
    {
      label: '平均推送率',
      value: stats.avgPushRate.toFixed(1) + '%',
      icon: TrendingUp,
      color: 'orange',
      bgColor: 'bg-orange-100',
      textColor: 'text-orange-600',
    },
    {
      label: '平均响应率',
      value: stats.avgResponseRate.toFixed(1) + '%',
      icon: Target,
      color: 'indigo',
      bgColor: 'bg-indigo-100',
      textColor: 'text-indigo-600',
    },
  ];

  // 导出有效用户
  const handleExportValidUsers = async (includeProfile: boolean) => {
    try {
      const users = includeProfile ? await getValidUsersWithProfile() : await getValidUsers();

      if (users.length === 0) {
        showToast('暂无有效用户数据', 'warning');
        return;
      }

      if (includeProfile && users.length > 10000) {
        if (!await showConfirm(`导出数据量较大（${users.length}条），完整画像导出可能较慢。\n建议选择"仅openid"导出，或分批导出。\n\n确定继续导出完整画像吗？`)) {
          return;
        }
      }

      const fmtBeijing = (iso: string) => {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      };

      let data: any[];
      let filename: string;

      if (includeProfile) {
        data = users.slice(0, 10000).map((u: any) => ({
          openid: u.openid,
          gender: u.gender || '',
          birth_year: u.birth_year || '',
          age: u.age || '',
          age_group: u.age_group || '',
          province: u.province || '',
          city: u.city || '',
          district: u.district || '',
          city_tier: u.city_tier || '',
          education: u.education || '',
          industry: u.industry || '',
          industry_sub: u.industry_sub || '',
          occupation: u.occupation || '',
          income: u.income || '',
          phone: u.phone || '',
          registered_at: fmtBeijing(u.registered_at),
        }));
        filename = `有效用户_完整画像_${data.length}条_${new Date().toISOString().slice(0,10)}.xlsx`;
      } else {
        data = users.map((u: any) => ({ openid: u.openid }));
        filename = `有效用户_openid_${data.length}条_${new Date().toISOString().slice(0,10)}.xlsx`;
      }

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '有效用户');
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error('导出失败:', err);
      showToast('导出失败，请重试', 'error');
    }
  };

  // 导出待转化用户（仅有 openid，无完整画像数据）
  const handleExportPendingUsers = async () => {
    try {
      const pendingOpenids = await getPendingUserList();

      if (pendingOpenids.length === 0) {
        showToast('暂无待转化用户数据', 'warning');
        return;
      }

      if (pendingOpenids.length > 10000) {
        if (!await showConfirm(`导出数据量较大（${pendingOpenids.length}条），建议分批导出。\n\n确定继续导出吗？`)) {
          return;
        }
      }

      const data = pendingOpenids.slice(0, 10000).map(openid => ({ openid }));
      const filename = `待转化用户_openid_${data.length}条_${new Date().toISOString().slice(0,10)}.xlsx`;

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '待转化用户');
      XLSX.writeFile(wb, filename);
    } catch (error) {
      console.error('导出待转化用户失败:', error);
      showToast('导出失败，请稍后重试', 'error');
    }
  };

  // 导出全部关注用户（公众号当前所有处于关注状态的用户，仅 openid）
  const handleExportAllFollowedUsers = async () => {
    try {
      const followedOpenids = await getAllFollowedUserList();

      if (followedOpenids.length === 0) {
        showToast('暂无关注用户数据', 'warning');
        return;
      }

      if (followedOpenids.length > 10000) {
        if (!await showConfirm(`导出数据量较大（${followedOpenids.length}条），建议分批导出。\n\n确定继续导出吗？`)) {
          return;
        }
      }

      const data = followedOpenids.slice(0, 10000).map(openid => ({ openid }));
      const filename = `全部关注用户_openid_${data.length}条_${new Date().toISOString().slice(0,10)}.xlsx`;

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '全部关注用户');
      XLSX.writeFile(wb, filename);
    } catch (error) {
      console.error('导出全部关注用户失败:', error);
      showToast('导出失败，请稍后重试', 'error');
    }
  };

  return (
    <div className="p-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">数据概览</h1>
        <p className="text-gray-500 mt-1">系统核心数据统计一览</p>
      </div>

      {/* 用户数据 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">用户数据</h2>
          <div className="flex gap-2">
            <div className="relative" data-export-menu>
              <button
                onClick={() => setOpenExportMenu(openExportMenu === 'valid' ? null : 'valid')}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                导出有效用户
                <ChevronDown className={`w-3 h-3 transition ${openExportMenu === 'valid' ? 'rotate-180' : ''}`} />
              </button>
              {openExportMenu === 'valid' && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[140px]">
                  <button
                    onClick={() => { handleExportValidUsers(false); setOpenExportMenu(null); }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 whitespace-nowrap"
                  >
                    仅 openid
                  </button>
                  <button
                    onClick={() => { handleExportValidUsers(true); setOpenExportMenu(null); }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 whitespace-nowrap text-orange-600"
                  >
                    完整画像
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleExportPendingUsers}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              导出待转化用户
            </button>
            <button
              onClick={handleExportAllFollowedUsers}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              导出全部关注用户
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {userStatCards.map((card) => (
            <UserStatsCard
              key={card.label}
              label={card.label}
              value={card.value}
              icon={card.icon}
              color={card.color}
              description={card.description}
            />
          ))}
        </div>
      </div>

      {/* 项目数据 */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-4">项目数据</h2>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          {projectCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 flex items-center gap-4"
              >
                <div className={`h-12 w-12 rounded-full ${card.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${card.textColor}`} />
                </div>
                <div>
                  <div className="text-sm text-gray-500">{card.label}</div>
                  <div className={`text-2xl font-bold ${card.textColor}`}>{card.value}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 红包统计 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">红包统计</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">全平台汇总，含所有项目</span>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">累计红包支出</div>
              <div className="text-2xl font-bold text-blue-600">¥{stats.hongbaoStats.totalExpense.toFixed(2)}</div>
              <div className="text-xs text-gray-400 mt-1">所有项目成功发放的金额总和</div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <Gift className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">成功发放人次</div>
              <div className="text-2xl font-bold text-green-600">{stats.hongbaoStats.successCount}</div>
              <div className="text-xs text-gray-400 mt-1">红包成功发送到账的笔数</div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">失败笔数</div>
              <div className="text-2xl font-bold text-orange-600">{stats.hongbaoStats.failedCount} <span className="text-sm font-normal text-gray-400">笔</span></div>
              <div className="text-xs text-gray-400 mt-1">发送失败，可重新发放的红包数量</div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">人均红包</div>
              <div className="text-2xl font-bold text-purple-600">¥{stats.hongbaoStats.avgPerPerson.toFixed(2)}</div>
              <div className="text-xs text-gray-400 mt-1">累计支出 ÷ 成功发放人次</div>
            </div>
          </div>
        </div>



      </div>

      {/* 效率指标 */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-4">效率指标（已完成项目均值）</h2>
        <div className="grid grid-cols-2 gap-4">
          {rateCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 flex items-center gap-4"
              >
                <div className={`h-12 w-12 rounded-full ${card.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${card.textColor}`} />
                </div>
                <div>
                  <div className="text-sm text-gray-500">{card.label}</div>
                  <div className={`text-2xl font-bold ${card.textColor}`}>{card.value}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>


    </div>
  );
}

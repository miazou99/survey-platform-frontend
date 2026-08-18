import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Users,
  Info,
  Trash2,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Download,
  PieChart,
  RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { UserProfile } from '../../types/types';
import { DIMENSIONS } from '../../data/dimensions';
import { showToast, showConfirm } from '../../components/Toast';
// Mock 数据已移除，全部走真实 API
import { getAge, getAgeGroup, getCityTierLevel } from '../../services/dataUtils';
import { getCityTierLabel } from '../../data/cityTierMap';
import { userApi } from '../../services/api';
import EmptyState from '../../components/EmptyState/EmptyState';

// 年龄分段配置（与 dimensions.ts 保持一致）
const AGE_GROUPS = [
  { label: '18岁以下', min: 0, max: 17, value: 'under18' },
  { label: '18-24岁', min: 18, max: 24, value: '18-24' },
  { label: '25-29岁', min: 25, max: 29, value: '25-29' },
  { label: '30-34岁', min: 30, max: 34, value: '30-34' },
  { label: '35-39岁', min: 35, max: 39, value: '35-39' },
  { label: '40-44岁', min: 40, max: 44, value: '40-44' },
  { label: '45岁及以上', min: 45, max: 999, value: '45+' },
];

// 将数值年龄转换为年龄段
function ageToGroup(age: number): string {
  const group = AGE_GROUPS.find(g => age >= g.min && age <= g.max);
  return group?.label || '未知';
}

export default function UserProfileManage() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [showStats, setShowStats] = useState(true);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [openExportMenu, setOpenExportMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [filter, setFilter] = useState({
    gender: '',
    age_group: '',
    education: '',
    city_tier: '',
    industry: '',
    occupation: '',
    income: '',
  });

  // 从真实API加载用户数据
  const loadRealUsers = async () => {
    setIsLoading(true);
    try {
      // 分页加载所有用户（后端默认pageSize=20，需要循环加载）
      const allUsers: any[] = [];
      let page = 1;
      const pageSize = 100;
      let hasMore = true;

      while (hasMore) {
        const result = await userApi.list({ page, pageSize });
        if (result.data && result.data.length > 0) {
          allUsers.push(...result.data);
          if (result.data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      if (allUsers.length > 0) {
        // 转换后端格式为前端格式
        const convertedProfiles: UserProfile[] = allUsers.map(u => ({
          openid: u.openid,
          gender: (u.gender || '男') as '男' | '女',
          birth_year: u.birth_year || 1990,
          education: u.education || '',
          province: u.province || '',
          city: u.city || '',
          district: u.district || '',
          occupation: u.occupation || '',
          industry: u.industry || '',
          industrySub: u.industry_sub || '',
          income: u.income || '',
          phone: u.phone,
          registered_at: u.registered_at,
          last_synced_at: u.registered_at,
        }));
        setProfiles(convertedProfiles);
        setLastSynced(new Date().toLocaleTimeString());
      }
    } catch (error) {
      console.error('加载用户数据失败，使用mock数据:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 首次加载时尝试获取真实数据
  useEffect(() => {
    loadRealUsers();
  }, []);

  // 点击外部关闭导出菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-export-menu]')) {
        setOpenExportMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // 多字段筛选（使用派生字段计算）
  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      if (filter.gender && p.gender !== filter.gender) return false;
      if (filter.age_group) {
        const userAgeGroup = getAgeGroup(p.birth_year);
        if (userAgeGroup !== filter.age_group) return false;
      }
      if (filter.education && (p as any).education !== filter.education) return false;
      if (filter.city_tier) {
        const userCityTier = getCityTierLevel(p.city);
        if (userCityTier !== filter.city_tier) return false;
      }
      if (filter.industry && p.industry !== filter.industry) return false;
      if (filter.occupation && p.occupation !== filter.occupation) return false;
      if (filter.income && p.income !== filter.income) return false;
      return true;
    });
  }, [profiles, filter]);

  const hasActiveFilter = Object.values(filter).some(v => v !== '');

  // 导出筛选后的用户
  const handleExportFilteredUsers = async (includeProfile: boolean) => {
    if (filteredProfiles.length === 0) {
      showToast('暂无用户数据可导出', 'warning');
      return;
    }

    if (includeProfile && filteredProfiles.length > 10000) {
      if (!await showConfirm(`导出数据量较大（${filteredProfiles.length}条），完整画像导出可能较慢。\n建议选择"仅openid"导出，或分批导出。\n\n确定继续导出完整画像吗？`)) {
        return;
      }
    }

    const fmtBeijing = (iso: string) => {
      if (!iso) return '';
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    let data: any[];
    let filename: string;

    if (includeProfile) {
      // 完整画像导出（字段顺序：openid + 7个画像维度 + 手机号 + 注册时间）
      data = filteredProfiles.slice(0, 10000).map(u => ({
        openid: u.openid,
        gender: u.gender || '',
        birth_year: u.birth_year || '',
        age: getAge(u.birth_year) || '',
        age_group: getAgeGroup(u.birth_year) || '',
        province: u.province || '',
        city: u.city || '',
        district: (u as any).district || '',
        city_tier: getCityTierLevel(u.city) || '',
        education: (u as any).education || '',
        industry: u.industry || '',
        industry_sub: (u as any).industry_sub || '',
        occupation: u.occupation || '',
        income: u.income || '',
        phone: u.phone || '',
        registered_at: fmtBeijing(u.registered_at),
      }));
      filename = `筛选用户_完整画像_${data.length}条_${new Date().toISOString().slice(0,10)}.xlsx`;
    } else {
      // 仅openid导出
      data = filteredProfiles.map(u => ({ openid: u.openid }));
      filename = `筛选用户_openid_${data.length}条_${new Date().toISOString().slice(0,10)}.xlsx`;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '筛选用户');
    XLSX.writeFile(wb, filename);
  };

  const clearFilters = () => {
    setFilter({ gender: '', age_group: '', education: '', city_tier: '', industry: '', occupation: '', income: '' });
  };

  // 详细统计数据（使用派生字段计算）
  const stats = useMemo(() => {
    const total = profiles.length;

    // 性别统计（固定两个选项）
    const genderCount: Record<string, number> = { '男': 0, '女': 0 };
    profiles.forEach(p => {
      if (p.gender === '男') genderCount['男']++;
      else if (p.gender === '女') genderCount['女']++;
    });

    // 年龄段统计（由出生年份计算，固定7个选项全显示）
    const ageCount: Record<string, number> = {};
    AGE_GROUPS.forEach(g => { ageCount[g.label] = 0; });
    profiles.forEach(p => {
      const group = ageToGroup(getAge(p.birth_year));
      ageCount[group] = (ageCount[group] || 0) + 1;
    });

    // 学历统计（固定5个选项全显示）
    const educationCount: Record<string, number> = {};
    DIMENSIONS.find(d => d.key === 'education')?.tags.forEach(t => {
      educationCount[t.name] = 0;
    });
    profiles.forEach(p => {
      if ((p as any).education) {
        educationCount[(p as any).education] = (educationCount[(p as any).education] || 0) + 1;
      }
    });

    // 城市级别统计（由城市查表计算，固定6个选项全显示）
    const cityTierCount: Record<string, number> = {};
    DIMENSIONS.find(d => d.key === 'city_tier')?.tags.forEach(t => {
      cityTierCount[t.name] = 0;
    });
    profiles.forEach(p => {
      const tierLabel = getCityTierLabel(p.city); // 用Label而非value
      cityTierCount[tierLabel] = (cityTierCount[tierLabel] || 0) + 1;
    });

    // 行业统计（固定14个选项全显示）
    const industryCount: Record<string, number> = {};
    const industryTags = DIMENSIONS.find(d => d.key === 'industry')?.tags || [];
    industryTags.forEach(t => {
      industryCount[t.name] = 0;
    });
    
    profiles.forEach(p => {
      if (p.industry && industryCount[p.industry] !== undefined) {
        industryCount[p.industry]++;
      }
    });

    // 职业统计（固定13个选项全显示）
    const occupationCount: Record<string, number> = {};
    const occupationTags = DIMENSIONS.find(d => d.key === 'occupation')?.tags || [];
    occupationTags.forEach(t => {
      occupationCount[t.name] = 0;
    });
    
    profiles.forEach(p => {
      if (p.occupation && occupationCount[p.occupation] !== undefined) {
        occupationCount[p.occupation]++;
      }
    });

    // 收入统计（固定10个选项全显示）
    const incomeCount: Record<string, number> = {};
    DIMENSIONS.find(d => d.key === 'income')?.tags.forEach(t => {
      incomeCount[t.name] = 0;
    });
    profiles.forEach(p => {
      if (p.income) {
        incomeCount[p.income] = (incomeCount[p.income] || 0) + 1;
      }
    });

    return { total, genderCount, ageCount, educationCount, cityTierCount, industryCount, occupationCount, incomeCount };
  }, [profiles]);

  // 获取 Top N 统计
  const getTopItems = (countObj: Record<string, number>, n = 5) => {
    return Object.entries(countObj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n);
  };

  // 清空数据
  const handleClearData = () => {
    if (window.confirm('确定要清空所有用户画像数据吗？此操作不可恢复。')) {
      setProfiles([]);
      showToast('已清空所有数据', 'success');
    }
  };

  // 维度配色方案
  const DIM_COLORS: Record<string, { bar: string; bg: string }> = {
    gender: { bar: 'bg-blue-500', bg: 'bg-blue-50' },
    age_group: { bar: 'bg-purple-500', bg: 'bg-purple-50' },
    education: { bar: 'bg-indigo-500', bg: 'bg-indigo-50' },
    city_tier: { bar: 'bg-emerald-500', bg: 'bg-emerald-50' },
    industry: { bar: 'bg-amber-500', bg: 'bg-amber-50' },
    occupation: { bar: 'bg-cyan-500', bg: 'bg-cyan-50' },
    income: { bar: 'bg-rose-500', bg: 'bg-rose-50' },
  };

  // 性别饼图组件
  const GenderPieChart = ({ data }: { data: [string, number][] }) => {
    const total = data.reduce((sum, [_, count]) => sum + count, 0);
    const colors: Record<string, string> = { '女': '#3b82f6', '男': '#60a5fa', '未知': '#9ca3af' };
    const cx = 50, cy = 50, r = 35;
    let startAngle = 0;

    const slices = data.map(([label, count]) => {
      const angle = total > 0 ? (count / total) * 360 : 0;
      const endAngle = startAngle + angle;
      const largeArc = angle > 180 ? 1 : 0;
      const x1 = cx + r * Math.cos((startAngle * Math.PI) / 180);
      const y1 = cy + r * Math.sin((startAngle * Math.PI) / 180);
      const x2 = cx + r * Math.cos((endAngle * Math.PI) / 180);
      const y2 = cy + r * Math.sin((endAngle * Math.PI) / 180);
      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      startAngle = endAngle;
      return { label, count, angle, d, color: colors[label] || '#9ca3af' };
    });

    return (
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 100 100" className="w-24 h-24 flex-shrink-0">
          {slices.map((slice, i) => (
            <path key={i} d={slice.d} fill={slice.color} stroke="white" strokeWidth="2" />
          ))}
          <circle cx={cx} cy={cy} r={12} fill="white" />
        </svg>
        <div className="flex-1 space-y-1.5">
          {slices.map((slice, i) => {
            const pct = total > 0 ? (slice.count / total) * 100 : 0;
            return (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                  <span className="text-gray-600">{slice.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900">{slice.count}</span>
                  <span className="text-gray-400 text-xs w-10 text-right">{pct.toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 统计卡片组件
  const StatCard = ({ dimensionKey, title, items }: { dimensionKey: string; title: string; items: [string, number][] }) => {
    const colors = DIM_COLORS[dimensionKey] || { bar: 'bg-blue-500', bg: 'bg-blue-50' };
    const maxCount = items.length > 0 ? Math.max(...items.map(([_, c]) => c), 1) : 1;

    // 性别分布用饼图
    if (dimensionKey === 'gender') {
      return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
          <h4 className="font-bold text-gray-800 mb-4 text-sm">{title}</h4>
          <GenderPieChart data={items} />
        </div>
      );
    }

    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
        <h4 className="font-bold text-gray-800 mb-4 text-sm">{title}</h4>
        <div className="space-y-2.5">
          {items.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">暂无数据</p>
          ) : (
            items.map(([label, count]) => {
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              const barWidth = pct;  // 进度条宽度 = 百分比
              const isZero = count === 0;
              return (
                <div key={label} className={`group ${isZero ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600 truncate max-w-[120px]">{label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-900">{count}</span>
                      <span className="text-xs text-gray-400 w-10 text-right">{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className={`h-1.5 ${colors.bg} rounded-full overflow-hidden`}>
                    <div
                      className={`h-full ${colors.bar} rounded-full transition-all duration-500`}
                      style={{ width: `${isZero ? 2 : barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 头部 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">画像管理</h1>
          <p className="text-sm text-gray-500 mt-1">基于有效用户的画像统计数据，用于抽样和数据分析匹配</p>
        </div>
      </div>

      {/* 说明卡片 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">提示：</p>
          <ul className="mt-1 list-disc list-inside space-y-1">
            <li>画像数据由系统自动同步（腾讯问卷注册数据 + 微信公众号关注状态）</li>
            <li>如需导入历史数据，请前往数据概览页面</li>
            <li>支持 .xlsx、.xls、.csv 格式</li>
          </ul>
        </div>
      </div>

      {/* 统计概览 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <button
          onClick={() => setShowStats(!showStats)}
          className="w-full px-6 py-4 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-gray-900">用户画像统计</h2>
            <span className="text-sm text-gray-500">（共 {stats.total} 位用户）</span>
            {lastSynced && (
              <span className="text-xs text-gray-400">• 已同步 {lastSynced}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); loadRealUsers(); }}
              disabled={isLoading}
              className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-50"
              title="刷新数据"
            >
              <RefreshCw className={`w-4 h-4 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            {showStats ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </button>

        {showStats && (
          <div className="px-6 pb-6">
            {/* 概览指标条 */}
            <div className="col-span-full grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 border border-blue-200/50">
                <div className="flex items-center gap-2 mb-1">
                  <PieChart className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-blue-600 font-medium">覆盖维度</span>
                </div>
                <div className="text-2xl font-bold text-blue-700">7</div>
                <div className="text-xs text-blue-500 mt-0.5">性别 / 年龄 / 学历 / 地区 / 行业 / 职业 / 收入</div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-4 border border-purple-200/50">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-purple-500" />
                  <span className="text-xs text-purple-600 font-medium">有效用户</span>
                </div>
                <div className="text-2xl font-bold text-purple-700">{stats.total.toLocaleString()}</div>
                <div className="text-xs text-purple-500 mt-0.5">关注公众号且完成注册问卷</div>
              </div>

            </div>

            {/* 六维度分布图 - 固定显示全字段 */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              dimensionKey="gender"
              title="性别分布"
              items={Object.entries(stats.genderCount).sort((a, b) => b[1] - a[1])}
            />

            <StatCard
              dimensionKey="age_group"
              title="年龄分布"
              items={AGE_GROUPS.map(g => [g.label, stats.ageCount[g.label] || 0] as [string, number])}
            />

            <StatCard
              dimensionKey="education"
              title="学历分布"
              items={DIMENSIONS.find(d => d.key === 'education')?.tags.map(t => [t.name, stats.educationCount[t.name] || 0] as [string, number]) || []}
            />

            <StatCard
              dimensionKey="city_tier"
              title="城市级别分布"
              items={DIMENSIONS.find(d => d.key === 'city_tier')?.tags.map(t => [t.name, stats.cityTierCount[t.name] || 0] as [string, number]) || []}
            />

            <StatCard
              dimensionKey="industry"
              title="行业分布"
              items={DIMENSIONS.find(d => d.key === 'industry')?.tags.map(t => [t.name, stats.industryCount[t.name] || 0] as [string, number]) || []}
            />

            <StatCard
              dimensionKey="occupation"
              title="职业分布"
              items={DIMENSIONS.find(d => d.key === 'occupation')?.tags.map(t => [t.name, stats.occupationCount[t.name] || 0] as [string, number]) || []}
            />

            <StatCard
              dimensionKey="income"
              title="收入分布"
              items={DIMENSIONS.find(d => d.key === 'income')?.tags.map(t => [t.name, stats.incomeCount[t.name] || 0] as [string, number]) || []}
            />
          </div>
          </div>
        )}
      </div>

      {/* 筛选用户区块 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {/* 筛选操作栏 */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-3">
            <h2 className="font-bold text-gray-900">筛选用户</h2>
            <span className="text-sm text-gray-500">
              {hasActiveFilter ? (
                <>
                  共找到 <span className="text-blue-600 font-medium">{filteredProfiles.length}</span> 位符合条件的用户
                </>
              ) : (
                <>
                  共 <span className="font-medium text-gray-900">0</span> 位用户
                </>
              )}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {hasActiveFilter && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                清除筛选
              </button>
            )}
            {/* 导出按钮 - 始终显示 */}
            <div className="relative" data-export-menu>
              <button
                onClick={() => setOpenExportMenu(!openExportMenu)}
                className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                导出用户
                <ChevronDown className={`w-3 h-3 transition ${openExportMenu ? 'rotate-180' : ''}`} />
              </button>
              {openExportMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[160px]">
                  <button
                    onClick={() => { handleExportFilteredUsers(false); setOpenExportMenu(false); }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 whitespace-nowrap flex items-center gap-2"
                  >
                    <Download className="w-3 h-3" />
                    仅导出 openid
                  </button>
                  <button
                    onClick={() => { handleExportFilteredUsers(true); setOpenExportMenu(false); }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 whitespace-nowrap flex items-center gap-2 text-orange-600"
                  >
                    <Download className="w-3 h-3" />
                    导出完整画像
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`px-4 py-2 border rounded-md text-sm flex items-center gap-2 transition ${
                showFilterPanel
                  ? 'border-blue-500 bg-blue-50 text-blue-600'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Search className="w-4 h-4" />
              筛选条件
              {hasActiveFilter && (
                <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {Object.values(filter).filter(Boolean).length}
                </span>
              )}
            </button>
            {profiles.length > 0 && (
              <button
                onClick={handleClearData}
                className="px-4 py-2 text-red-600 border border-red-300 rounded-md text-sm flex items-center gap-2 hover:bg-red-50 transition"
              >
                <Trash2 className="w-4 h-4" />
                清空数据
              </button>
            )}
          </div>
        </div>

        {/* 筛选面板 */}
        {showFilterPanel && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500 mb-3">选择筛选条件（可多选，不同字段之间为「且」的关系）</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 性别 */}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">性别</label>
                <select
                  value={filter.gender}
                  onChange={e => setFilter(f => ({ ...f, gender: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white"
                >
                  <option value="">不限</option>
                  <option value="男">男</option>
                  <option value="女">女</option>
                </select>
              </div>

              {/* 年龄段 */}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">年龄段</label>
                <select
                  value={filter.age_group}
                  onChange={e => setFilter(f => ({ ...f, age_group: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white"
                >
                  <option value="">不限</option>
                  {AGE_GROUPS.map(g => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>

              {/* 学历 */}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">学历</label>
                <select
                  value={filter.education}
                  onChange={e => setFilter(f => ({ ...f, education: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white"
                >
                  <option value="">不限</option>
                  {DIMENSIONS.find(d => d.key === 'education')?.tags.map(t => (
                    <option key={t.value} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* 城市级别 */}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">城市级别</label>
                <select
                  value={filter.city_tier}
                  onChange={e => setFilter(f => ({ ...f, city_tier: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white"
                >
                  <option value="">不限</option>
                  {DIMENSIONS.find(d => d.key === 'city_tier')?.tags.map(t => (
                    <option key={t.value} value={t.value}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* 行业 */}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">行业</label>
                <select
                  value={filter.industry}
                  onChange={e => setFilter(f => ({ ...f, industry: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white"
                >
                  <option value="">不限</option>
                  {DIMENSIONS.find(d => d.key === 'industry')?.tags.map(t => (
                    <option key={t.value} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* 职业 */}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">职业</label>
                <select
                  value={filter.occupation}
                  onChange={e => setFilter(f => ({ ...f, occupation: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white"
                >
                  <option value="">不限</option>
                  {DIMENSIONS.find(d => d.key === 'occupation')?.tags.map(t => (
                    <option key={t.value} value={t.value}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* 收入 */}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">个人月收入</label>
                <select
                  value={filter.income}
                  onChange={e => setFilter(f => ({ ...f, income: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white"
                >
                  <option value="">不限</option>
                  {DIMENSIONS.find(d => d.key === 'income')?.tags.map(t => (
                    <option key={t.value} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 已选条件标签 */}
            {hasActiveFilter && (
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-200">
                {Object.entries(filter).map(([key, value]) => {
                  if (!value) return null;
                  const dim = DIMENSIONS.find(d => d.key === key);
                  const tag = dim?.tags.find(t => t.name === value || t.value === value);
                  return (
                    <span
                      key={key}
                      className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded flex items-center gap-1"
                    >
                      {dim?.label}：{tag?.name || value}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 数据表格 - 仅在有筛选条件时展示 */}
      {hasActiveFilter ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                  OpenID
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                  性别
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                  年龄
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                  地区
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                  行业
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                  职业
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                  收入
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                  注册时间
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12">
                    <EmptyState
                      variant="no-results"
                      title="没有找到符合条件的用户"
                      description="尝试调整筛选条件"
                      action={{
                        label: '清除筛选',
                        onClick: clearFilters,
                      }}
                    />
                  </td>
                </tr>
              ) : (
                filteredProfiles.slice(0, 100).map(profile => (
                  <tr key={profile.openid} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-sm font-mono text-gray-900 max-w-[180px] truncate">
                      {profile.openid}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {profile.gender || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {profile.birth_year ? `${profile.birth_year}年` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {profile.province || '-'}{profile.city ? ` ${profile.city}` : ''}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[150px] truncate">
                      {profile.industry || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[120px] truncate">
                      {profile.occupation || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[120px] truncate">
                      {profile.income || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {profile.registered_at ? profile.registered_at.slice(0, 10) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {filteredProfiles.length > 100 && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500 text-center">
              显示前 100 条，共 {filteredProfiles.length} 条
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium mb-2">用户列表已隐藏</p>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            当前共 {profiles.length.toLocaleString()} 位用户。请使用上方「筛选条件」设置筛选规则后查看匹配用户列表
          </p>
        </div>
      )}
    </div>
  );
}
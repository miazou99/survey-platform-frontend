import React, { useState, useMemo, useEffect, useRef } from 'react';
import { showToast } from '../../components/Toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Settings,
  Calendar,
  BarChart3,
  Users,
  AlertCircle,
  MessageSquare,
  Database,
  RefreshCw,
  Pause,
  Play,
} from 'lucide-react';
import { DIMENSIONS_FOR_QUOTA, WECHAT_TEMPLATES, WECHAT_TEMPLATE_FIELDS, WechatTemplateField } from '../../data/dimensions';
import { QuotaItem } from '../../types/types';
import { wechatApi, userApi, projectApi } from '../../services/api';
import { calculateDerivedFields } from '../../services/dataUtils';
import { dynamicBalanceSampling, QuotaTarget, SamplingResult } from '../../services/samplingService';

const STEPS = [
  { key: 1, label: '基本信息', icon: Settings },
  { key: 2, label: '投放方式', icon: Users },
  { key: 3, label: '配额设置', icon: BarChart3 },
  { key: 4, label: '确认发放', icon: Check },
];

// 自动生成项目编号：PRJ-年月日时分-随机数
function generateProjectCode(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `PRJ-${year}${month}${day}${hour}${minute}-${random}`;
}

// 验证微信openid格式
// 简化验证：只检查是否以o开头
function validateOpenid(openid: string): { valid: boolean; error?: string } {
  if (!openid || !openid.trim()) {
    return { valid: false, error: 'OpenID不能为空' };
  }
  
  const trimmed = openid.trim();
  
  // 只检查是否以o开头
  if (!trimmed.startsWith('o')) {
    return { valid: false, error: 'OpenID必须以o开头' };
  }
  
  return { valid: true };
}

// 验证所有输入的openids
function validateOpenids(text: string): { valid: boolean; validCount: number; invalidLines: { line: number; openid: string; error: string }[] } {
  const lines = text.split('\n').filter(line => line.trim());
  const invalidLines: { line: number; openid: string; error: string }[] = [];
  
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const result = validateOpenid(trimmed);
    if (!result.valid) {
      invalidLines.push({ line: index + 1, openid: trimmed, error: result.error || '格式错误' });
    }
  });
  
  return {
    valid: invalidLines.length === 0,
    validCount: lines.length - invalidLines.length,
    invalidLines
  };
}

interface FormData {
  name: string;
  project_code: string;
  description: string;
  survey_link: string;
  survey_subject: string;
  wechat_template_id: string;
  // 微信模板字段 - 动态键值对
  template_data: Record<string, string>;
  start_time: string;
  end_time: string;
  total_samples: number;
  selected_dimensions: string[];
  quotas: QuotaItem[];
  sampling_mode: 'auto' | 'manual';
  manual_openids: string[];
}

// 库存统计数据类型
interface InventoryStats {
  total: number;
  gender: { value: string; count: number }[];
  age_group: { value: string; count: number }[];
  education: { value: string; count: number }[];
  city_tier: { value: string; count: number }[];
  industry: { value: string; count: number }[];
  occupation: { value: string; count: number }[];
  income: { value: string; count: number }[];
}

const initialFormData: FormData = {
  name: '',
  project_code: '',
  description: '',
  survey_link: '',
  survey_subject: '',
  wechat_template_id: 'PLKkZGOn3Xu-dwpSzXgmXnSo9pMapZGmMkfcth05gfw', // 默认选中工单催办提醒
  template_data: {
    task_title: '答问卷领现金红包',
    project_name: '',
    start_time: '',
    end_time: '',
  },
  start_time: '',
  end_time: '',
  total_samples: 500,
  selected_dimensions: [],
  quotas: [],
  sampling_mode: 'auto',
  manual_openids: [],
};

// OpenID 实时验证结果组件
function OpenidValidationResult({ input }: { input: string }) {
  const lines = input.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return null;
  }

  const result = validateOpenids(input);
  
  if (result.valid && lines.length > 0) {
    return (
      <div className="bg-green-50 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Check className="w-5 h-5 text-green-600" />
          <span className="font-medium text-green-700">
            验证通过：共 {result.validCount} 个有效 OpenID
          </span>
        </div>
      </div>
    );
  }

  if (!result.valid && result.invalidLines.length > 0) {
    return (
      <div className="bg-red-50 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="font-medium text-red-700">
            验证失败：{result.invalidLines.length} 个无效 OpenID
          </span>
        </div>
        <div className="space-y-1">
          {result.invalidLines.slice(0, 3).map((item, index) => (
            <div key={index} className="text-sm text-red-600 flex items-start gap-2">
              <span className="text-red-400">第{item.line}行:</span>
              <span className="font-mono truncate">{item.openid || '(空)'}</span>
              <span>- {item.error}</span>
            </div>
          ))}
          {result.invalidLines.length > 3 && (
            <p className="text-sm text-red-500">
              还有 {result.invalidLines.length - 3} 个错误...
            </p>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export default function NewProject() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [manualOpenidInput, setManualOpenidInput] = useState('');
  const [isDelivering, setIsDelivering] = useState(false);
  const [deliveringProjectId, setDeliveringProjectId] = useState<string | null>(null);
  const [inventoryStats, setInventoryStats] = useState<InventoryStats | null>(null);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [showQuotaDetails, setShowQuotaDetails] = useState(false);
  
  // 抽样结果
  const [sampledUsers, setSampledUsers] = useState<any[]>([]);
  const [samplingResults, setSamplingResults] = useState<SamplingResult | null>(null);
  // 步骤3内部状态：是否已完成抽样（用于配额抽样的"设置→预览"在同一页面展示）
  const [hasSampled, setHasSampled] = useState(false);
  // 抽样中状态
  const [isSampling, setIsSampling] = useState(false);

  // 推送进度（前端分块发送，实时更新）
  const [pushProgress, setPushProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [pushPaused, setPushPaused] = useState(false);
  const [pushPhase, setPushPhase] = useState<'idle' | 'sending' | 'paused' | 'done'>('idle');
  const pushPauseRef = useRef(false);

  // 草稿相关状态
  const [searchParams] = useSearchParams();
  const [draftProjectId, setDraftProjectId] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);

  // 当前年份（用于年龄计算）
  const currentYear = new Date().getFullYear();

  // 组件加载时自动生成项目编号
  useEffect(() => {
    const draftId = searchParams.get('draftId');
    if (draftId) {
      loadDraft(draftId);
    } else {
      setFormData(prev => ({
        ...prev,
        project_code: generateProjectCode()
      }));
    }
  }, []);

  // 加载草稿
  const loadDraft = async (draftId: string) => {
    setDraftLoading(true);
    try {
      const draft = await projectApi.get(draftId);
      if (!draft || draft.status !== 'draft') {
        showToast('该草稿已不存在或已提交', 'warning');
        setFormData(prev => ({ ...prev, project_code: generateProjectCode() }));
        return;
      }

      setDraftProjectId(draft.id);

      // 还原表单数据
      const isoToDatetimeLocal = (iso: string | undefined) => {
        if (!iso) return '';
        try {
          const d = new Date(iso);
          if (isNaN(d.getTime())) return '';
          const pad = (n: number) => String(n).padStart(2, '0');
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        } catch { return ''; }
      };

      setFormData({
        name: draft.name || '',
        project_code: draft.project_code || generateProjectCode(),
        description: draft.description || '',
        survey_link: draft.survey_link || '',
        survey_subject: draft.survey_subject || '',
        wechat_template_id: draft.wechat_template_id || initialFormData.wechat_template_id,
        template_data: {
          task_title: draft.survey_subject || '答问卷领现金红包',
          project_name: draft.template_project_name || '',
          start_time: isoToDatetimeLocal(draft.start_time),
          end_time: isoToDatetimeLocal(draft.end_time),
        },
        start_time: isoToDatetimeLocal(draft.start_time),
        end_time: isoToDatetimeLocal(draft.end_time),
        total_samples: draft.total_samples || 500,
        selected_dimensions: draft.selected_dimensions || [],
        quotas: (draft.quotas || []).map((q: any) => ({
          dimension_key: q.dimension_key,
          dimension_label: q.dimension_label,
          tag_name: q.tag_name,
          quota_percent: q.quota_percent,
        })),
        sampling_mode: draft.sampling_mode || 'auto',
        manual_openids: draft.manual_openids || [],
      });

      // 跳转到草稿保存的步骤
      const draftStep = draft.draft_step || 1;
      setCurrentStep(Math.min(draftStep, 4));

      showToast(`已恢复草稿，继续编辑第 ${draftStep} 步`, 'success');
    } catch (err: any) {
      console.error('加载草稿失败:', err);
      showToast('加载草稿失败，将创建新项目', 'warning');
      setFormData(prev => ({ ...prev, project_code: generateProjectCode() }));
    } finally {
      setDraftLoading(false);
    }
  };

  // 加载用户库存数据
  useEffect(() => {
    if (currentStep === 3 && formData.sampling_mode === 'auto') {
      loadInventoryStats();
    }
  }, [currentStep, formData.sampling_mode]);

  const loadInventoryStats = async () => {
    setLoadingInventory(true);
    try {
      // 直接从用户列表 API 获取所有用户，然后前端计算库存
      const response = await userApi.list({ pageSize: 10000 });
      let users = response.data || [];
      
      // 为每个用户计算派生字段（age, age_group, city_tier）
      // 因为API返回的原始数据不包含这些字段
      users = users.map((user: any) => ({
        ...user,
        ...calculateDerivedFields(user),
      }));
      
      // 计算总库存
      const total = users.length;
      
      // 按各维度分组统计
      const genderCounts: Record<string, number> = {};
      const ageGroupCounts: Record<string, number> = {
        '18岁以下': 0, '18-24岁': 0, '25-29岁': 0, '30-34岁': 0, '35-39岁': 0, '40-44岁': 0, '45岁及以上': 0
      };
      const educationCounts: Record<string, number> = {};
      const cityTierCounts: Record<string, number> = {
        '一线城市': 0, '二线城市': 0, '三线城市': 0, '四线城市': 0, '五线城市': 0, '其他': 0
      };
      const industryCounts: Record<string, number> = {};
      const occupationCounts: Record<string, number> = {};
      const incomeCounts: Record<string, number> = {};

      const currentYear = new Date().getFullYear();

      users.forEach((user: any) => {
        // 性别：user.gender 已经是 '男'/'女'（中文），直接使用
        const gender = user.gender === '男' ? '男' : (user.gender === '女' ? '女' : '未知');
        genderCounts[gender] = (genderCounts[gender] || 0) + 1;

        // 年龄段
        if (user.birth_year) {
          const age = currentYear - user.birth_year;
          if (age < 18) ageGroupCounts['18岁以下']++;
          else if (age <= 24) ageGroupCounts['18-24岁']++;
          else if (age <= 29) ageGroupCounts['25-29岁']++;
          else if (age <= 34) ageGroupCounts['30-34岁']++;
          else if (age <= 39) ageGroupCounts['35-39岁']++;
          else if (age <= 44) ageGroupCounts['40-44岁']++;
          else ageGroupCounts['45岁及以上']++;
        }

        // 学历
        const education = user.education || '未知';
        educationCounts[education] = (educationCounts[education] || 0) + 1;

        // 城市级别：user.city_tier 已经是计算好的派生字段（如 'tier1'）
        const cityTier = user.city_tier || 'other';
        const tierMap: Record<string, string> = {
          'tier1': '一线城市', 'tier2': '二线城市', 'tier3': '三线城市',
          'tier4': '四线城市', 'tier5': '五线城市', 'other': '其他'
        };
        const tierName = tierMap[cityTier] || '其他';
        cityTierCounts[tierName] = (cityTierCounts[tierName] || 0) + 1;

        // 行业
        const industry = user.industry || '未知';
        industryCounts[industry] = (industryCounts[industry] || 0) + 1;

        // 职业
        const occupation = user.occupation || '未知';
        occupationCounts[occupation] = (occupationCounts[occupation] || 0) + 1;

        // 收入
        const income = user.income || '未知';
        incomeCounts[income] = (incomeCounts[income] || 0) + 1;
      });

      setInventoryStats({
        total,
        gender: Object.entries(genderCounts).map(([value, count]) => ({ value, count })),
        age_group: Object.entries(ageGroupCounts).map(([value, count]) => ({ value, count })),
        education: Object.entries(educationCounts).map(([value, count]) => ({ value, count })),
        city_tier: Object.entries(cityTierCounts).map(([value, count]) => ({ value, count })),
        industry: Object.entries(industryCounts).map(([value, count]) => ({ value, count })),
        occupation: Object.entries(occupationCounts).map(([value, count]) => ({ value, count })),
        income: Object.entries(incomeCounts).map(([value, count]) => ({ value, count })),
      });
    } catch (error) {
      console.error('获取库存数据失败:', error);
    } finally {
      setLoadingInventory(false);
    }
  };

  // 获取指定维度的库存映射
  const getInventoryMap = (dimensionKey: string): Record<string, number> => {
    if (!inventoryStats) return {};
    
    const keyMap: Record<string, typeof inventoryStats.gender> = {
      gender: inventoryStats.gender,
      age_group: inventoryStats.age_group,
      education: inventoryStats.education,
      city_tier: inventoryStats.city_tier,
      industry: inventoryStats.industry,
      occupation: inventoryStats.occupation,
      income: inventoryStats.income,
    };
    
    const stats = keyMap[dimensionKey];
    if (!stats) return {};
    
    return stats.reduce((acc, item) => {
      acc[item.value] = item.count;
      return acc;
    }, {} as Record<string, number>);
  };

  // 辅助函数：获取用户在某个维度上的标签值（返回 tag.name，用于与配额比较）
  const getUserTagValue = (user: any, dimKey: string): string => {
    // 调试日志
    if (dimKey === 'gender' || dimKey === 'education') {
      console.log(`[getUserTagValue] dimKey=${dimKey}, user.gender=${user.gender}, user.education=${user.education}`);
    }
    switch (dimKey) {
      case 'gender':
        const gender = (user.gender || '').trim();
        return gender === '男' ? '男' : (gender === '女' ? '女' : '未知');
      case 'age_group':
        if (user.birth_year) {
          const age = currentYear - user.birth_year;
          if (age < 18) return '18岁以下';
          else if (age <= 24) return '18-24岁';
          else if (age <= 29) return '25-29岁';
          else if (age <= 34) return '30-34岁';
          else if (age <= 39) return '35-39岁';
          else if (age <= 44) return '40-44岁';
          else return '45岁及以上';
        }
        return '未知';
      case 'education':
        return (user.education || '').trim() || '未知';
      case 'city_tier':
        // user.city_tier 存储的是 value (如 'tier1')，需要转换为 name (如 '一线城市')
        const cityTierMap: Record<string, string> = {
          'tier1': '一线城市',
          'tier2': '二线城市',
          'tier3': '三线城市',
          'tier4': '四线城市',
          'tier5': '五线城市',
          'other': '其他',
        };
        return cityTierMap[user.city_tier] || '其他';
      case 'industry':
        return user.industry || '未知';
      case 'occupation':
        return user.occupation || '未知';
      case 'income':
        return user.income || '未知';
      default:
        return '未知';
    }
  };

  // 抽样函数：使用分布对齐抽样算法（Raking + 批量交换优化）
  const performSampling = async (): Promise<SamplingResult | null> => {
    setIsSampling(true);
    try {
      // 获取所有用户
      const response = await userApi.list({ pageSize: 10000 });
      let allUsers = response.data || [];
      
      if (allUsers.length === 0) {
        showToast('用户池为空，无法抽样', 'warning');
        return null;
      }

      // 为每个用户计算派生字段（age, age_group, city_tier）
      allUsers = allUsers.map(user => ({
        ...user,
        ...calculateDerivedFields(user),
      }));

      console.log('[分布对齐抽样] 用户总数:', allUsers.length);
      console.log('[分布对齐抽样] 示例用户数据:', JSON.stringify(allUsers[0]));

      const targetCount = formData.total_samples || 0;
      
      // 构建配额目标格式
      const quotaTargets: QuotaTarget[] = [];
      
      formData.selected_dimensions.forEach(dimKey => {
        const dimension = DIMENSIONS_FOR_QUOTA.find(d => d.key === dimKey);
        if (!dimension) return;
        
        const dimQuotas = formData.quotas.filter(q => q.dimension_key === dimKey);
        
        dimQuotas.forEach(q => {
          // 查找该标签的 value（用于与用户数据匹配）
          const tagDef = dimension.tags.find(t => t.name === q.tag_name);
          const tagValue = tagDef?.value || q.tag_name;
          
          // 直接用用户原始设定百分比（Raking 算法内部会自行归一化）
          const tagPercent = q.quota_percent;
          quotaTargets.push({
            dimension: dimKey,
            tag: tagValue,
            targetPercent: tagPercent,
            targetCount: Math.round(targetCount * tagPercent / 100),
          });
        });
      });

      console.log('[分布对齐抽样] 配额目标(targetCount=%d):', targetCount, JSON.stringify(quotaTargets.map(t => ({dim:t.dimension, tag:t.tag, pct:t.targetPercent, cnt:t.targetCount}))));
      
      // 调用分布对齐抽样算法
      const result = dynamicBalanceSampling(
        allUsers,
        quotaTargets,
        targetCount,
        {
          maxIterations: 200,
          deviationThreshold: 0.05,
        }
      );

      console.log('[分布对齐抽样] 抽样结果:', result);
      
      setSampledUsers(result.selectedUsers);
      setSamplingResults(result);
      
      console.log(`[分布对齐抽样] 最终抽样结果: ${result.actualSize}人, 最大偏差: ${result.maxDeviation.toFixed(2)}%, 匹配度: ${(result.matchScore * 100).toFixed(1)}%`);
      
      return result;
      
    } catch (error: any) {
      console.error('抽样失败:', error);
      showToast(`抽样失败: ${error.message || '请重试'}`, 'error');
      return null;
    } finally {
      setIsSampling(false);
    }
  };

  // 当前选择的模板信息
  const currentTemplate = useMemo(() => {
    const template = WECHAT_TEMPLATES.find(t => t.id === formData.wechat_template_id);
    const fields = WECHAT_TEMPLATE_FIELDS[formData.wechat_template_id] || [];
    return { ...template, fields };
  }, [formData.wechat_template_id]);

  // 计算各维度的配额（合并 formData.quotas 中的用户输入值）
  const calculatedQuotas = useMemo(() => {
    if (formData.selected_dimensions.length === 0 || formData.total_samples <= 0) {
      return [];
    }

    const quotas: QuotaItem[] = [];

    formData.selected_dimensions.forEach(dimKey => {
      const dimension = DIMENSIONS_FOR_QUOTA.find(d => d.key === dimKey);
      if (!dimension) return;

      dimension.tags.forEach(tag => {
        // 查找用户已输入的值
        const existingQuota = formData.quotas.find(
          q => q.dimension_key === dimKey && q.tag_name === tag.name
        );
        const quotaPercent = existingQuota?.quota_percent || 0;
        
        quotas.push({
          dimension_key: dimKey,
          dimension_label: dimension.label,
          tag_name: tag.name,
          quota_percent: quotaPercent,
          target_count: Math.floor((formData.total_samples || 0) * quotaPercent / 100),
        });
      });
    });

    return quotas;
  }, [formData.selected_dimensions, formData.total_samples, formData.quotas]);

  const updateQuota = (dimensionKey: string, tagName: string, quotaPercent: number) => {
    // 允许任意值，只显示警告，不阻止保存
    // 处理空值和无效值
    const percent = isNaN(quotaPercent) ? 0 : quotaPercent;

    setFormData(prev => {
      // 查找是否已存在该配额记录
      const existingIndex = prev.quotas.findIndex(
        q => q.dimension_key === dimensionKey && q.tag_name === tagName
      );
      
      let newQuotas = [...prev.quotas];
      
      if (existingIndex >= 0) {
        // 已存在，更新
        newQuotas[existingIndex] = {
          ...newQuotas[existingIndex],
          quota_percent: percent,
          target_count: Math.floor((prev.total_samples || 0) * percent / 100),
        };
      } else {
        // 不存在，新增
        const dimension = DIMENSIONS_FOR_QUOTA.find(d => d.key === dimensionKey);
        newQuotas.push({
          dimension_key: dimensionKey,
          dimension_label: dimension?.label || '',
          tag_name: tagName,
          quota_percent: percent,
          target_count: Math.floor((prev.total_samples || 0) * percent / 100),
        });
      }
      
      return {
        ...prev,
        quotas: newQuotas,
      };
    });
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.name.trim()) newErrors.name = '请输入项目名称';
      if (!formData.project_code.trim()) newErrors.project_code = '请输入项目编号';
      if (!formData.survey_link.trim()) newErrors.survey_link = '请输入问卷链接';
      
      // 动态验证微信模板字段
      if (currentTemplate && currentTemplate.fields) {
        for (const field of currentTemplate.fields) {
          const value = formData.template_data[field.key] || '';
          if (!value.trim()) {
            newErrors[`template_${field.key}`] = `请输入${field.label}`;
          }
        }
        // 验证开始时间要早于截止时间
        const startTime = formData.template_data['start_time'];
        const endTime = formData.template_data['end_time'];
        if (startTime && endTime && startTime >= endTime) {
          newErrors['template_end_time'] = '截止时间必须晚于开始时间';
        }
      }
    }

    if (step === 2) {
      // 投放方式选择不需要验证，只要选择了就行
      // sampling_mode 默认为 'auto'
    }

    if (step === 3) {
      if (formData.sampling_mode === 'auto') {
        // 配额抽样投放需要验证
        if (formData.total_samples <= 0) {
          newErrors.total_samples = '样本数量必须大于0';
        }
        if (formData.selected_dimensions.length === 0) {
          newErrors.dimensions = '请至少选择一个维度';
        }
        // 验证每个维度的配额比例总和必须等于100%
        for (const dimKey of formData.selected_dimensions) {
          const dimQuotas = formData.quotas.filter(q => q.dimension_key === dimKey);
          const totalPercent = dimQuotas.reduce((sum, q) => sum + q.quota_percent, 0);
          if (totalPercent !== 100) {
            const dimension = DIMENSIONS_FOR_QUOTA.find(d => d.key === dimKey);
            newErrors[`quota_${dimKey}`] = `${dimension?.label || dimKey}的配额比例总和必须等于100%（当前为${totalPercent}%）`;
          }
        }
      } else {
        // 指定用户ID投放需要验证 - 检查输入框中的内容
        const openids = manualOpenidInput.split('\n').filter(line => line.trim());
        if (openids.length === 0) {
          newErrors.manual_openids = '请至少添加一个用户 OpenID';
        }
      }
    }

    if (step === 4) {
      // 步骤4只需要验证投放设置
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 构建项目提交数据（供 create/update 复用）
  const buildProjectPayload = () => ({
    name: formData.name,
    description: formData.description || '',
    surveyLink: formData.survey_link,
    surveySubject: formData.template_data.task_title || '答问卷领现金红包',
    templateProjectName: formData.template_data.project_name || formData.name,
    wechatTemplateId: formData.wechat_template_id,
    startTime: formData.start_time ? new Date(formData.start_time).toISOString() : null,
    endTime: formData.end_time ? new Date(formData.end_time).toISOString() : null,
    totalSamples: formData.sampling_mode === 'manual'
      ? new Set(formData.manual_openids).size
      : formData.total_samples,
    samplingMode: formData.sampling_mode,
    selectedDimensions: formData.selected_dimensions,
    quotas: formData.quotas.map(q => ({
      dimensionKey: q.dimension_key,
      dimensionLabel: q.dimension_label,
      tag: q.tag_name,
      quotaPercent: q.quota_percent,
    })),
    manualOpenids: formData.manual_openids,
  });

  // 保存草稿（创建或更新）
  const saveDraft = async (step: number) => {
    const payload = buildProjectPayload();
    try {
      if (draftProjectId) {
        await projectApi.update(draftProjectId, { ...payload, draftStep: step });
      } else {
        const result = await projectApi.create({ ...payload, draftStep: step });
        setDraftProjectId(result.id);
      }
    } catch (err: any) {
      // 静默失败，不阻止用户继续操作
      console.warn('自动保存草稿失败:', err.message);
    }
  };

  const handleNext = async () => {
    if (!validateStep(currentStep)) return;

    // 步骤1完成时，同步开始和截止时间到表单
      if (currentStep === 1) {
        setFormData(prev => {
          // 如果开始时间为空，自动设置为当前时间（北京时间）
          const pad = (n: number) => String(n).padStart(2, '0');
          const d = new Date();
          const now = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          return {
            ...prev,
            start_time: prev.template_data.start_time || now,
            end_time: prev.template_data.end_time || '',
          };
        });
        // 步骤1→2：自动保存草稿（记录目标步骤2，即用户正在看的步骤）
        await saveDraft(2);
        setCurrentStep(2);
        return;
      }

    // 步骤2完成时，根据投放方式进入下一步
    if (currentStep === 2) {
      // 步骤2→3：自动保存草稿
      await saveDraft(3);
      if (formData.sampling_mode === 'auto') {
        setCurrentStep(3);
      } else {
        setCurrentStep(3);
      }
      return;
    }

    // 步骤3完成时
    if (currentStep === 3) {
      // 步骤3→4：自动保存草稿
      await saveDraft(4);
      if (formData.sampling_mode === 'auto') {
        // 配额抽样投放：已抽样则直接进入步骤4，否则先抽样
        if (!hasSampled) {
          const result = await performSampling();
          if (result) {
            setHasSampled(true);
          } else {
            return; // 抽样失败，不跳转
          }
        }
        setCurrentStep(4);
      } else {
        // 指定用户ID投放：保存openids，进入步骤4确认发放
        const openids = [...new Set(manualOpenidInput.split('\n').filter(line => line.trim()))];
        setFormData(prev => ({ ...prev, manual_openids: openids }));
        setCurrentStep(4);
      }
      return;
    }

    // 步骤4，直接投放
    if (currentStep === 4) {
      handleDeliver();
    }
  };

  const handlePrev = () => {
    if (currentStep === 1) return;
    
    if (currentStep === 2) {
      setCurrentStep(1);
    } else if (currentStep === 3) {
      setCurrentStep(2);
    } else if (currentStep === 4) {
      // 返回步骤3时，如果是配额抽样，清除抽样结果和状态
      if (formData.sampling_mode === 'auto') {
        setSampledUsers([]);
        setSamplingResults(null);
        setHasSampled(false);
      }
      setCurrentStep(3);
    }
    // 退回时静默更新草案步骤
    if (draftProjectId) {
      const targetStep = currentStep - 1;
      projectApi.update(draftProjectId, { draftStep: targetStep }).catch(() => {});
    }
  };

  const handleSubmit = async () => {
    try {
      const projectData = buildProjectPayload();
      console.log('发送的项目数据:', projectData);

      let result;
      if (draftProjectId) {
        // 已有草稿，直接更新状态为 in_progress
        result = await projectApi.update(draftProjectId, { ...projectData, status: 'in_progress', draftStep: 4 });
        result.id = draftProjectId;
      } else {
        result = await projectApi.create(projectData);
      }
      console.log('创建项目成功:', result);
      showToast('项目创建成功！', 'success');
      navigate('/projects');
    } catch (error: any) {
      console.error('创建项目失败:', error);
      showToast(`创建项目失败: ${error.message || '请重试'}`, 'error');
    }
  };

  // 直接投放（前端分块发送，实时显示进度）
  const handleDeliver = async () => {
    // 获取要投放的 openids
    let openids: string[];
    
    if (formData.sampling_mode === 'auto') {
      openids = sampledUsers.map(u => u.openid).filter(Boolean);
    } else {
      openids = manualOpenidInput.split('\n').filter(line => line.trim());
    }
    
    // openid 去重
    const totalBeforeDedup = openids.length;
    openids = [...new Set(openids)];
    if (totalBeforeDedup !== openids.length) {
      console.log(`[投放] openid去重：${totalBeforeDedup} → ${openids.length}（去除${totalBeforeDedup - openids.length}个重复）`);
    }
    
    if (openids.length === 0) {
      showToast('没有可投放的用户', 'warning');
      return;
    }
    
    // 检查时间是否已设置
    if (!formData.start_time || !formData.end_time) {
      showToast('请设置投放开始时间和截止时间', 'warning');
      return;
    }
    
    // 先创建项目（如有草稿则复用），获取项目ID
    const projectData = buildProjectPayload();
    let projectId: string;
    try {
      if (draftProjectId) {
        await projectApi.update(draftProjectId, { ...projectData, status: 'in_progress', draftStep: 4 });
        projectId = draftProjectId;
      } else {
        const createResult = await projectApi.create(projectData);
        projectId = createResult.id;
      }
    } catch (err: any) {
      showToast(`创建项目失败: ${err.message}`, 'error');
      return;
    }
    
    // 更新项目状态为进行中
    await projectApi.update(projectId, { status: 'in_progress' });
    setDeliveringProjectId(projectId);
    
    // 开始分块发送
    const CHUNK_SIZE = 20;
    let totalSuccess = 0;
    let totalFailed = 0;
    pushPauseRef.current = false;
    setPushPaused(false);
    setPushPhase('sending');
    setPushProgress({ done: 0, total: openids.length });
    const failedList: string[] = [];
    
    for (let i = 0; i < openids.length; i += CHUNK_SIZE) {
      // 检查暂停
      if (pushPauseRef.current) {
        // 保存剩余 openids 到后端
        const remaining = openids.slice(i);
        try {
          await projectApi.update(projectId, { status: 'paused', pendingOpenids: JSON.stringify(remaining) });
          setPushPhase('paused');
          // 显示暂停提示
          showToast(`⏸️ 已暂停\n已发: ${totalSuccess}，剩余: ${remaining.length}\n可在项目详情页继续发送`, 'success');
        } catch {}
        return;
      }
      
      const chunk = openids.slice(i, Math.min(i + CHUNK_SIZE, openids.length));
      
      try {
        const result: any = await projectApi.sendTemplate(projectId, chunk);
        totalSuccess += result.success || 0;
        totalFailed += result.failed || 0;
        
        // 记录失败的 openid
        if (result.results) {
          result.results.forEach((r: any) => {
            if (!r.success) failedList.push(r.openid);
          });
        }
        
        setPushProgress({ done: Math.min(i + CHUNK_SIZE, openids.length), total: openids.length });
        
        // 保存剩余 openids 到后端（用于页面刷新后恢复）
        const remaining = openids.slice(i + CHUNK_SIZE);
        try {
          await projectApi.update(projectId, { pendingOpenids: JSON.stringify(remaining) });
        } catch {}
        
      } catch (sendError: any) {
        console.error(`分块发送失败 (chunk ${i / CHUNK_SIZE + 1}):`, sendError);
        totalFailed += chunk.length;
      }
    }
    
    // 全部完成
    setPushPhase('done');
    setPushProgress({ done: openids.length, total: openids.length });
    
    // 清理 pendingOpenids
    try {
      await projectApi.update(projectId, { status: 'in_progress', pendingOpenids: JSON.stringify([]) });
    } catch {}
    
    // 构建结果提示
    if (totalFailed === 0) {
      showToast(`✅ 全部发送成功！共 ${totalSuccess} 人`, 'success');
    } else {
      showToast(`⚠️ 发送完成\n成功: ${totalSuccess}，失败: ${totalFailed}`, 'warning');
    }
    
    // 跳转到项目详情页（而不是列表页）
    setTimeout(() => {
      navigate(`/projects/${projectId}`);
    }, 1500);
  };

  // 继续发送（从暂停处恢复，共享续发逻辑）
  const handleResumeDeliver = async () => {
    if (!deliveringProjectId) return;
    
    // 获取完整 openid 列表
    let openids: string[];
    if (formData.sampling_mode === 'auto') {
      openids = sampledUsers.map(u => u.openid).filter(Boolean);
    } else {
      openids = manualOpenidInput.split('\n').filter(line => line.trim());
    }
    openids = [...new Set(openids)];
    
    const CHUNK_SIZE = 20;
    let totalSuccess = pushProgress.done;
    let totalFailed = 0;
    pushPauseRef.current = false;
    setPushPaused(false);
    setPushPhase('sending');
    
    const remaining = openids.slice(pushProgress.done);
    
    for (let i = 0; i < remaining.length; i += CHUNK_SIZE) {
      if (pushPauseRef.current) {
        const left = remaining.slice(i);
        try {
          await projectApi.update(deliveringProjectId, { status: 'paused', pendingOpenids: JSON.stringify(left) });
          setPushPhase('paused');
          showToast(`⏸️ 已暂停\n已发: ${totalSuccess}，剩余: ${left.length}`, 'success');
        } catch {}
        return;
      }
      
      const chunk = remaining.slice(i, Math.min(i + CHUNK_SIZE, remaining.length));
      try {
        const result: any = await projectApi.sendTemplate(deliveringProjectId, chunk);
        totalSuccess += result.success || 0;
        totalFailed += result.failed || 0;
        setPushProgress({ done: totalSuccess, total: openids.length });
        
        const left = remaining.slice(i + CHUNK_SIZE);
        try {
          await projectApi.update(deliveringProjectId, { pendingOpenids: JSON.stringify(left) });
        } catch {}
      } catch (e: any) {
        totalFailed += chunk.length;
      }
    }
    
    setPushPhase('done');
    setPushProgress({ done: openids.length, total: openids.length });
    try {
      await projectApi.update(deliveringProjectId, { status: 'in_progress', pendingOpenids: JSON.stringify([]) });
    } catch {}
    
    showToast(totalFailed === 0 
      ? `✅ 全部发送完成！共 ${openids.length} 人` 
      : `⚠️ 发送完成\n成功: ${openids.length - totalFailed}，失败: ${totalFailed}`,
      totalFailed === 0 ? 'success' : 'warning'
    );
    
    setTimeout(() => {
      if (deliveringProjectId) navigate(`/projects/${deliveringProjectId}`);
    }, 1500);
  };

  // 暂停发送（设置 ref 标志，前端分块循环检测到后停止）
  const handlePauseSend = async () => {
    pushPauseRef.current = true;
    if (deliveringProjectId) {
      try {
        await projectApi.update(deliveringProjectId, { status: 'paused' });
      } catch (e) {}
    }
    setPushPaused(true);
    showToast('已发送暂停请求，当前批次发送完成后将自动停止', 'success');
  };

  const addManualOpenid = () => {
    const openid = manualOpenidInput.trim();
    if (openid && !formData.manual_openids.includes(openid)) {
      setFormData(prev => ({
        ...prev,
        manual_openids: [...prev.manual_openids, openid],
      }));
      setManualOpenidInput('');
    }
  };

  const removeManualOpenid = (openid: string) => {
    setFormData(prev => ({
      ...prev,
      manual_openids: prev.manual_openids.filter(id => id !== openid),
    }));
  };

  const toggleDimension = (dimKey: string) => {
    setFormData(prev => ({
      ...prev,
      selected_dimensions: prev.selected_dimensions.includes(dimKey)
        ? prev.selected_dimensions.filter(k => k !== dimKey)
        : [...prev.selected_dimensions, dimKey],
    }));
  };

  const updateTemplateField = (field: keyof FormData['template_data'], value: string) => {
    setFormData(prev => ({
      ...prev,
      template_data: {
        ...prev.template_data,
        [field]: value,
      }
    }));
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 草稿加载中 */}
      {draftLoading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-50">
          <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-xl shadow-lg">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-700 font-medium">正在加载草稿...</span>
          </div>
        </div>
      )}

      {/* 顶部导航 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/projects')}
              className="p-2 rounded-lg hover:bg-gray-100 transition"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">新建项目</h1>
          </div>
        </div>
      </div>

      {/* 步骤指示器 */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="flex items-center justify-center gap-8">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.key;
            const isCompleted = currentStep > step.key;

            return (
              <div key={step.key} className="flex items-center">
                <div className="flex items-center gap-3">
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center
                      ${isCompleted ? 'bg-green-500 text-white' : ''}
                      ${isActive ? 'bg-blue-600 text-white' : ''}
                      ${!isActive && !isCompleted ? 'bg-gray-200 text-gray-500' : ''}
                    `}
                  >
                    {isCompleted ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <span
                    className={`
                      font-medium
                      ${isActive ? 'text-blue-600' : ''}
                      ${isCompleted ? 'text-green-600' : ''}
                      ${!isActive && !isCompleted ? 'text-gray-400' : ''}
                    `}
                  >
                    {step.label}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`
                      w-16 h-1 mx-4 rounded
                      ${currentStep > step.key ? 'bg-green-500' : 'bg-gray-200'}
                    `}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 表单内容 */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto">
          {/* 步骤 1: 基本信息 */}
          {currentStep === 1 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6">基本信息</h2>

              <div className="space-y-6">
                {/* 项目编号 - 自动生成 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    项目编号
                  </label>
                  <input
                    type="text"
                    value={formData.project_code}
                    readOnly
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 font-mono"
                  />
                </div>

                {/* 内部项目名称（前端展示用，不展示给用户） */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    内部项目名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="请输入项目名称"
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${
                      errors.name ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> {errors.name}
                    </p>
                  )}
                </div>

                {/* 微信模板消息配置 */}
                <div className="border border-blue-200 rounded-xl p-5 bg-blue-50">
                  <div className="flex items-center gap-2 mb-4">
                    <MessageSquare className="w-5 h-5 text-blue-600" />
                    <h3 className="font-medium text-blue-900">微信模板消息配置</h3>
                  </div>

                  {/* 微信模板选择 */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      微信模板
                    </label>
                    <select
                      value={formData.wechat_template_id}
                      onChange={e => setFormData(prev => ({ ...prev, wechat_template_id: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    >
                      {WECHAT_TEMPLATES.map(template => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 模板字段配置 */}
                  {currentTemplate && currentTemplate.fields && (
                    <div className="space-y-4">
                      {/* 动态渲染模板字段 */}
                      {currentTemplate.fields.map(field => {
                        const isDateField = field.key === 'start_time' || field.key === 'end_time';
                        const isSystemField = field.key === 'start_time';
                        const placeholder = field.key === 'task_title' ? '答问卷领现金红包' : '请输入';

                        return (
                          <div key={field.key}>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              {field.label} <span className="text-red-500">*</span>
                            </label>
                            {isDateField ? (
                              <input
                                type="datetime-local"
                                value={formData.template_data[field.key] || ''}
                                onChange={e => updateTemplateField(field.key, e.target.value)}
                                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${
                                  isSystemField ? 'bg-gray-100 border-gray-300' : 'bg-white border-gray-300'
                                }`}
                              />
                            ) : (
                              <input
                                type="text"
                                value={formData.template_data[field.key] || ''}
                                onChange={e => updateTemplateField(field.key, e.target.value)}
                                placeholder={placeholder}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            )}
                            {isSystemField && (
                              <p className="mt-1 text-xs text-gray-400">系统记录，不显示在用户收到的消息模板中</p>
                            )}
                            {!isSystemField && field.key === 'end_time' && (
                              <p className="mt-1 text-xs text-gray-400">将显示在发送给用户的微信模板消息中</p>
                            )}
                          </div>
                        );
                      })}

                      {/* 问卷链接 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          问卷链接 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="url"
                          value={formData.survey_link}
                          onChange={e => setFormData(prev => ({ ...prev, survey_link: e.target.value }))}
                          placeholder="请输入腾讯问卷链接"
                          className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${
                            errors.survey_link ? 'border-red-500' : 'border-gray-300'
                          }`}
                        />
                        {errors.survey_link && (
                          <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" /> {errors.survey_link}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 步骤 2: 投放方式选择 */}
          {currentStep === 2 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6">选择投放方式</h2>

              <div className="space-y-4">
                <p className="text-gray-500 mb-4">请选择本次问卷的投放方式</p>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, sampling_mode: 'auto' }))}
                    className={`
                      p-5 rounded-xl border-2 text-left transition
                      ${formData.sampling_mode === 'auto'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`
                        w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0
                        ${formData.sampling_mode === 'auto' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}
                      `}>
                        <BarChart3 className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 mb-1">配额抽样投放</h4>
                        <p className="text-sm text-gray-500">根据设置的维度配额自动抽取符合条件的用户进行投放</p>
                      </div>
                    </div>
                    {formData.sampling_mode === 'auto' && (
                      <div className="mt-3 flex items-center gap-1 text-blue-600">
                        <Check className="w-4 h-4" />
                        <span className="text-sm font-medium">已选择</span>
                      </div>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setFormData(prev => ({ ...prev, sampling_mode: 'manual' }));
                    }}
                    className={`
                      p-5 rounded-xl border-2 text-left transition
                      ${formData.sampling_mode === 'manual'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`
                        w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0
                        ${formData.sampling_mode === 'manual' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}
                      `}>
                        <Users className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 mb-1">指定用户ID投放</h4>
                        <p className="text-sm text-gray-500">手动输入指定用户的 OpenID 进行精准投放</p>
                      </div>
                    </div>
                    {formData.sampling_mode === 'manual' && (
                      <div className="mt-3 flex items-center gap-1 text-blue-600">
                        <Check className="w-4 h-4" />
                        <span className="text-sm font-medium">已选择</span>
                      </div>
                    )}
                  </button>
                </div>

                {errors.sampling_mode && (
                  <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> {errors.sampling_mode}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 步骤 3: 配额设置 + 抽样预览 */}
          {currentStep === 3 && formData.sampling_mode === 'auto' && !hasSampled && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6">配额设置</h2>

              <div className="space-y-6">
                {/* 总库存和计划投放 */}
                <div className="grid grid-cols-2 gap-4">
                  {/* 总库存 */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Database className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-blue-600 font-medium">用户总库存</p>
                        <p className="text-2xl font-bold text-blue-700">
                          {loadingInventory ? '加载中...' : (inventoryStats?.total || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-blue-500">可投放的有效用户数量</p>
                  </div>

                  {/* 计划投放 */}
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-100">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-green-600 font-medium">计划投放</p>
                        <p className="text-2xl font-bold text-green-700">
                          {formData.total_samples.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-green-500">本次投放需要的样本量</p>
                  </div>
                </div>

                {/* 样本量输入 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    调整计划投放数量 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.total_samples}
                    onChange={e => setFormData(prev => ({
                      ...prev,
                      total_samples: e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1)
                    }))}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${
                      errors.total_samples ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.total_samples && (
                    <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> {errors.total_samples}
                    </p>
                  )}
                </div>

                {/* 选择配额维度 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    选择配额维度 <span className="text-red-500">*</span>
                  </label>
                  {errors.dimensions && (
                    <p className="mb-2 text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> {errors.dimensions}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {DIMENSIONS_FOR_QUOTA.map(dim => {
                      const isSelected = formData.selected_dimensions.includes(dim.key);
                      const invMap = getInventoryMap(dim.key);
                      const totalInv = dim.tags.reduce((sum, t) => sum + (invMap[t.name] || 0), 0);
                      return (
                        <button
                          key={dim.key}
                          onClick={() => toggleDimension(dim.key)}
                          className={`
                            p-3 rounded-lg border-2 text-left transition
                            ${isSelected
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                            }
                          `}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900">{dim.label}</span>
                            {isSelected && (
                              <Check className="w-5 h-5 text-blue-600" />
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-sm text-gray-500">
                              {dim.type === 'derived' ? '派生字段' : '原始字段'}
                            </p>
                            <p className="text-sm font-medium text-blue-600">
                              库存: {totalInv.toLocaleString()}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 配额分配 */}
                {formData.selected_dimensions.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      配额分配
                    </label>
                    {/* 配额错误提示 */}
                    {formData.selected_dimensions.map(dimKey => {
                      const errorKey = `quota_${dimKey}`;
                      if (errors[errorKey]) {
                        const dimension = DIMENSIONS_FOR_QUOTA.find(d => d.key === dimKey);
                        return (
                          <div key={errorKey} className="mb-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-600 flex items-center gap-1">
                              <AlertCircle className="w-4 h-4" />
                              {errors[errorKey]}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    })}
                    <div className="space-y-4">
                      {formData.selected_dimensions.map(dimKey => {
                        const dimension = DIMENSIONS_FOR_QUOTA.find(d => d.key === dimKey);
                        if (!dimension) return null;

                        const dimensionQuotas = calculatedQuotas.filter(
                          q => q.dimension_key === dimKey
                        );
                        const totalPercent = dimensionQuotas.reduce(
                          (sum, q) => sum + q.quota_percent, 0
                        );
                        const invMap = getInventoryMap(dimKey);

                        return (
                          <div key={dimKey} className="border border-gray-200 rounded-lg overflow-hidden">
                            {/* 表头 */}
                            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200">
                              <h4 className="font-medium text-gray-900">{dimension.label}</h4>
                              <div className="flex items-center gap-4 text-sm">
                                <span className="text-gray-500">总计:</span>
                                <span className={`font-medium ${
                                  totalPercent > 100 ? 'text-red-500' : totalPercent === 100 ? 'text-green-600' : 'text-orange-500'
                                }`}>
                                  {totalPercent}%
                                </span>
                              </div>
                            </div>

                            {/* 列表 */}
                            <div className="divide-y divide-gray-100">
                              {dimension.tags.map(tag => {
                                const quotaData = calculatedQuotas.find(
                                  q => q.dimension_key === dimKey && q.tag_name === tag.name
                                );
                                const percent = quotaData?.quota_percent || 0;
                                const targetCount = quotaData?.target_count || 0;
                                const stockCount = invMap[tag.name] || 0;
                                const isInsufficient = targetCount > stockCount && stockCount > 0;

                                return (
                                  <div key={tag.name} className="px-4 py-2.5 flex items-center gap-4">
                                    {/* 标签名 */}
                                    <div className="flex-1">
                                      <span className="text-sm text-gray-700">{tag.name}</span>
                                    </div>

                                    {/* 比例输入 */}
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        defaultValue={percent}
                                        onBlur={e => {
                                          const val = parseInt(e.target.value) || 0;
                                          updateQuota(dimKey, tag.name, val);
                                        }}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') {
                                            e.currentTarget.blur();
                                          }
                                        }}
                                        className={`w-14 px-2 py-1 border rounded text-sm text-center ${
                                          isInsufficient ? 'border-red-500 bg-red-50' : 'border-gray-300'
                                        }`}
                                      />
                                      <span className="text-sm text-gray-500">%</span>
                                    </div>

                                    {/* 需要用户数 */}
                                    <div className="w-24 text-right">
                                      <span className={`text-sm ${isInsufficient ? 'text-red-500 font-medium' : 'text-gray-600'}`}>
                                        需 {targetCount} 人
                                      </span>
                                    </div>

                                    {/* 库存 */}
                                    <div className="w-20 text-right">
                                      <span className="text-xs text-gray-400">库存 {stockCount}</span>
                                      {isInsufficient && (
                                        <div className="text-xs text-red-500">库存不足</div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 开始抽样按钮 */}
                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <button
                    onClick={async () => {
                      if (!validateStep(3)) return;
                      const result = await performSampling();
                      if (result) {
                        setHasSampled(true);
                      }
                    }}
                    disabled={isSampling}
                    className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSampling ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        抽样中...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="w-4 h-4" />
                        开始抽样
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 步骤 3: 抽样预览（配额抽样完成后显示） */}
          {currentStep === 3 && formData.sampling_mode === 'auto' && hasSampled && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">抽样预览</h2>
                <button
                  onClick={() => setHasSampled(false)}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  返回修改配额
                </button>
              </div>

              <div className="space-y-6">
                {/* 抽样汇总卡片 */}
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-5 h-5 text-green-600" />
                    <h4 className="font-medium text-green-900">抽样完成</h4>
                  </div>
                  <p className="text-green-700 text-2xl font-bold">
                    已抽出 {samplingResults?.actualSize || 0} 个用户
                  </p>
                  <p className="text-sm text-green-600 mt-1">
                    目标：{formData.total_samples} 人 | 配额维度：{formData.selected_dimensions.length} 个
                  </p>
                </div>

                {/* 抽样质量指标 */}
                {samplingResults && (
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-xl p-4 text-center">
                      <div className="text-sm text-blue-600">实际抽样</div>
                      <div className="text-2xl font-bold text-blue-700">{samplingResults.actualSize}人</div>
                    </div>
                    <div className="bg-green-50 rounded-xl p-4 text-center">
                      <div className="text-sm text-green-600">迭代次数</div>
                      <div className="text-2xl font-bold text-green-700">{samplingResults.iterations}次</div>
                    </div>
                    <div className={`${samplingResults.maxDeviation > 10 ? 'bg-red-50' : 'bg-orange-50'} rounded-xl p-4 text-center`}>
                      <div className={`text-sm ${samplingResults.maxDeviation > 10 ? 'text-red-600' : 'text-orange-600'}`}>最大偏差</div>
                      <div className={`text-2xl font-bold ${samplingResults.maxDeviation > 10 ? 'text-red-700' : samplingResults.maxDeviation < 5 ? 'text-green-700' : 'text-orange-700'}`}>
                        {samplingResults.maxDeviation.toFixed(2)}%
                      </div>
                    </div>
                    <div className={`${samplingResults.matchScore >= 0.85 ? 'bg-green-50' : 'bg-orange-50'} rounded-xl p-4 text-center`}>
                      <div className={`text-sm ${samplingResults.matchScore >= 0.85 ? 'text-green-600' : 'text-orange-600'}`}>匹配度</div>
                      <div className={`text-2xl font-bold ${samplingResults.matchScore >= 0.85 ? 'text-green-700' : 'text-orange-700'}`}>
                        {(samplingResults.matchScore * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                )}

                {/* 各维度抽样结果对比 */}
                {samplingResults && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">各维度统计详情</h4>
                    {samplingResults.statistics.map(stat => {
                      const dimension = DIMENSIONS_FOR_QUOTA.find(d => d.key === stat.dimension);
                      return (
                        <div key={stat.dimension} className="border border-gray-200 rounded-lg overflow-hidden">
                          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                            <h5 className="font-medium text-gray-900">{dimension?.label || stat.dimension}</h5>
                          </div>
                          <div className="divide-y divide-gray-100">
                            {stat.tags.map(tag => (
                              <div key={tag.tag} className="px-4 py-2 flex items-center justify-between text-sm">
                                <span className="text-gray-700">{tag.tagLabel}</span>
                                <div className="flex items-center gap-3">
                                  <span className="text-gray-400">{tag.targetPercent.toFixed(1)}%</span>
                                  <span className="text-gray-300">→</span>
                                  <span className="font-medium">{tag.actualPercent.toFixed(1)}%</span>
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                    tag.deviation < 2 ? 'bg-green-100 text-green-700' :
                                    tag.deviation < 5 ? 'bg-orange-100 text-orange-700' :
                                    'bg-red-100 text-red-700'
                                  }`}>
                                    {tag.deviation.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 抽样用户详情 */}
                {sampledUsers.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">
                      抽样用户详情 
                      <span className="text-sm text-gray-500 ml-2">（共 {sampledUsers.length} 人，可左右滑动查看全部字段）</span>
                    </h4>
                    <div className="border border-gray-200 rounded-lg overflow-x-auto max-h-96">
                      <table className="w-full text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-2.5 text-left text-gray-600 font-medium">OpenID</th>
                            <th className="px-4 py-2.5 text-left text-gray-600 font-medium">性别</th>
                            <th className="px-4 py-2.5 text-left text-gray-600 font-medium">出生年</th>
                            <th className="px-4 py-2.5 text-left text-gray-600 font-medium">年龄</th>
                            <th className="px-4 py-2.5 text-left text-gray-600 font-medium">年龄段</th>
                            <th className="px-4 py-2.5 text-left text-gray-600 font-medium">学历</th>
                            <th className="px-4 py-2.5 text-left text-gray-600 font-medium">城市</th>
                            <th className="px-4 py-2.5 text-left text-gray-600 font-medium">城市级别</th>
                            <th className="px-4 py-2.5 text-left text-gray-600 font-medium">职业</th>
                            <th className="px-4 py-2.5 text-left text-gray-600 font-medium">行业</th>
                            <th className="px-4 py-2.5 text-left text-gray-600 font-medium">收入</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {sampledUsers.slice(0, 100).map((user, index) => {
                            const currentYear = new Date().getFullYear();
                            const age = user.birth_year ? currentYear - user.birth_year : '-';
                            const ageGroup = user.age_group || '-';
                            
                            return (
                              <tr key={`${user.openid}-${index}`} className="hover:bg-gray-50">
                                <td className="px-4 py-2.5 font-mono text-xs text-gray-600">
                                  {user.openid || '-'}
                                </td>
                                <td className="px-4 py-2.5 text-gray-700">{user.gender || '-'}</td>
                                <td className="px-4 py-2.5 text-gray-700">{user.birth_year || '-'}</td>
                                <td className="px-4 py-2.5 text-gray-700">{age}</td>
                                <td className="px-4 py-2.5 text-gray-700">{ageGroup}</td>
                                <td className="px-4 py-2.5 text-gray-700">{user.education || '-'}</td>
                                <td className="px-4 py-2.5 text-gray-700">{user.city || '-'}</td>
                                <td className="px-4 py-2.5 text-gray-700">{user.city_tier || '-'}</td>
                                <td className="px-4 py-2.5 text-gray-700">{user.occupation || '-'}</td>
                                <td className="px-4 py-2.5 text-gray-700">{user.industry || '-'}</td>
                                <td className="px-4 py-2.5 text-gray-700">{user.income || '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {sampledUsers.length > 100 && (
                        <div className="px-4 py-2 bg-gray-50 text-center text-sm text-gray-500">
                          仅显示前100条，共 {sampledUsers.length} 条
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 步骤 3: 指定用户ID投放 */}
          {currentStep === 3 && formData.sampling_mode === 'manual' && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6">指定用户ID投放</h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    输入用户 OpenID <span className="text-red-500">*</span>
                  </label>
                  <p className="text-sm text-gray-500 mb-3">
                    请输入要投放的用户 OpenID，每行一个
                  </p>
                  <textarea
                    value={manualOpenidInput}
                    onChange={e => {
                      setManualOpenidInput(e.target.value);
                      if (errors.manual_openids) {
                        setErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors.manual_openids;
                          return newErrors;
                        });
                      }
                    }}
                    placeholder="请输入 OpenID，每行一个，例如：oAbCdEfGhIjKlMnOpQrStUvWx"
                    rows={6}
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none font-mono text-sm ${
                      errors.manual_openids ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.manual_openids && (
                    <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> {errors.manual_openids}
                    </p>
                  )}
                </div>

                {/* 实时验证结果 */}
                <OpenidValidationResult input={manualOpenidInput} />

                {/* OpenID 格式说明 */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">OpenID 格式说明</h4>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• 必须以字母 "o" 开头</li>
                    <li>• 后面跟随字母和数字组合</li>
                    <li>• 长度通常在 20-40 位之间</li>
                    <li>• 示例：oAbCdEfGhIjKlMnOpQrStUvWx</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* 步骤 4: 确认发放 */}
          {currentStep === 4 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6">确认发放</h2>

              <div className="space-y-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-5 h-5 text-blue-600" />
                    <h4 className="font-medium text-blue-900">投放信息</h4>
                  </div>
                  <p className="text-blue-700">
                    {formData.sampling_mode === 'auto' ? '配额抽样投放' : '指定用户ID投放'}
                  </p>
                  {formData.sampling_mode === 'auto' && (
                    <p className="text-sm text-blue-600 mt-1">
                      投放用户数：{new Set(sampledUsers.map(u => u.openid)).size} 人
                    </p>
                  )}
                  {formData.sampling_mode === 'manual' && (
                    <p className="text-sm text-blue-600 mt-1">
                      指定用户数：{new Set(formData.manual_openids).size} 人
                    </p>
                  )}
                </div>

                {/* 推送进度卡（发送中时显示） */}
                {pushPhase !== 'idle' && (
                  <div className={`p-5 rounded-lg border ${pushPhase === 'done' ? 'bg-green-50 border-green-200' : pushPhase === 'paused' ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className={`text-sm font-medium ${pushPhase === 'done' ? 'text-green-700' : pushPhase === 'paused' ? 'text-orange-700' : 'text-blue-700'}`}>
                        {pushPhase === 'done' ? '✅ 全部发送完成' : pushPhase === 'paused' ? '⏸️ 发送已暂停' : '正在发送模板消息...'}
                      </div>
                      <div className={`text-lg font-bold ${pushPhase === 'done' ? 'text-green-700' : pushPhase === 'paused' ? 'text-orange-700' : 'text-blue-700'}`}>
                        {pushProgress.done} / {pushProgress.total}
                        <span className="text-sm ml-1 opacity-75">
                          ({pushProgress.total > 0 ? Math.round((pushProgress.done / pushProgress.total) * 100) : 0}%)
                        </span>
                      </div>
                    </div>
                    <div className={`w-full rounded-full h-3 overflow-hidden ${pushPhase === 'done' ? 'bg-green-100' : pushPhase === 'paused' ? 'bg-orange-100' : 'bg-blue-100'}`}>
                      <div
                        className={`h-3 rounded-full transition-all duration-300 ${pushPhase === 'done' ? 'bg-green-500' : pushPhase === 'paused' ? 'bg-orange-400' : 'bg-blue-500'}`}
                        style={{ width: `${pushProgress.total > 0 ? Math.round((pushProgress.done / pushProgress.total) * 100) : 0}%` }}
                      />
                    </div>
                    {/* 暂停/继续按钮 */}
                    {pushPhase === 'sending' && (
                      <div className="flex justify-end mt-3">
                        <button
                          onClick={handlePauseSend}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 transition"
                        >
                          <Pause className="w-4 h-4" /> 暂停发送
                        </button>
                      </div>
                    )}
                    {pushPhase === 'paused' && (
                      <div className="mt-3 p-3 bg-white rounded-lg border border-orange-200">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-orange-700">
                            ⏸️ 已暂停 · 剩余 {pushProgress.total - pushProgress.done} 人未发送
                          </p>
                          <button
                            onClick={handleResumeDeliver}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                          >
                            <Play className="w-4 h-4" /> 继续发送
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="border-t border-gray-200 pt-4">
                  <h4 className="font-medium text-gray-900 mb-3">项目信息</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">项目名称</span>
                      <span className="font-medium text-gray-900">{formData.name || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">项目编号</span>
                      <span className="font-mono text-gray-900">{formData.project_code || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">问卷链接</span>
                      <span className="text-blue-600 truncate max-w-xs">{formData.survey_link || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={currentStep === 1}
            className={`
              px-6 py-2.5 rounded-lg flex items-center gap-2 font-medium transition
              ${currentStep === 1
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-100'
              }
            `}
          >
            <ArrowLeft className="w-4 h-4" />
            上一步
          </button>

          <div className="flex items-center gap-2">
            {STEPS.map(step => (
              <div
                key={step.key}
                className={`
                  w-2 h-2 rounded-full transition
                  ${currentStep >= step.key ? 'bg-blue-600' : 'bg-gray-300'}
                `}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            {pushPhase === 'sending' && !pushPaused && (
              <button
                onClick={handlePauseSend}
                className="px-6 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition flex items-center gap-2 font-medium"
              >
                <Pause className="w-4 h-4" />
                暂停发送
              </button>
            )}
            {pushPhase === 'paused' && (
              <button
                onClick={handleResumeDeliver}
                className="px-6 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition flex items-center gap-2 font-medium"
              >
                <Play className="w-4 h-4" />
                继续发送
              </button>
            )}
            <button
              onClick={currentStep === 4 && pushPhase === 'idle' ? handleDeliver : handleNext}
              disabled={pushPhase === 'sending' || pushPhase === 'done'}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 font-medium disabled:opacity-50"
            >
              {pushPhase === 'sending' ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  投放中...
                </>
              ) : pushPhase === 'done' ? (
                <>
                  <Check className="w-4 h-4" />
                  发送完成
                </>
              ) : currentStep === 4 ? (
                <>
                  <Check className="w-4 h-4" />
                  确认发放
                </>
              ) : (
                <>
                  下一步
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

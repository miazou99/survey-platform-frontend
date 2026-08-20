/**
 * API 服务 - 统一处理所有后端请求
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

/**
 * 获取认证 Token
 */
function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * 统一请求方法
 */
export async function api<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth, ...init } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  // 自动添加 Authorization header
  if (!skipAuth) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    // Token 过期或无效，跳转登录
    localStorage.removeItem('auth_token');
    localStorage.removeItem('admin_info');
    window.location.href = '/login';
    throw new Error('登录已过期，请重新登录');
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message || `请求失败: ${response.status}`);
  }

  return response.json();
}

// 认证相关 API
export const authApi = {
  login: (email: string, password: string) =>
    api<{ access_token: string; admin: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    }),

  verifyToken: (token: string) =>
    api('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
      skipAuth: true,
    }),

  getProfile: () =>
    api<any>('/auth/profile'),
};

// 微信相关 API
export const wechatApi = {
  // 发送模板消息
  sendTemplate: (data: {
    openid: string;
    template_id: string;
    page?: string;
    url?: string;
    data: Record<string, { value: string; color?: string }>;
  }) =>
    api<{ errcode: number; errmsg: string }>('/wechat/send-template', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 获取用户列表
  getUsers: (params?: { page?: number; limit?: number }) =>
    api<{ users: any[]; total: number }>('/users', {
      method: 'GET',
    }),

  // 根据 openid 获取用户
  getUserByOpenid: (openid: string) =>
    api<any>(`/users/openid/${openid}`),

  // 发送红包（V3 商家转账）
  sendHongbao: (data: {
    openid: string;
    amount: number;
    wishing?: string;
    act_name?: string;
    remark?: string;
    projectId?: string;
    retryCount?: number;
    out_bill_no?: string;
  }) =>
    api<{ batch_id?: string; status: string; errcode?: number; errmsg?: string }>('/wechat/send-hongbao', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 获取用户是否已授权免确认收款
  getUserAuthorization: (openid: string) =>
    api<{ authorizationId?: string; authorizedAt?: string }>(`/wechat/user-authorization?openid=${openid}`),
};

// 红包记录相关 API
export const hongbaoApi = {
  // 分页查询红包记录
  list: (projectId: string, params?: {
    page?: number;
    pageSize?: number;
    status?: 'success' | 'failed' | 'notified' | 'pending';
    keyword?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.pageSize) sp.set('pageSize', String(params.pageSize));
    if (params?.status) sp.set('status', params.status);
    if (params?.keyword) sp.set('keyword', params.keyword);
    const q = sp.toString();
    return api<{
      data: any[];
      total: number;
      page: number;
      pageSize: number;
    }>(`/projects/${projectId}/hongbao-records${q ? `?${q}` : ''}`);
  },

  // 统计
  statistics: (projectId: string) =>
    api<{
      totalAmount: number;
      totalCount: number;
      successAmount: number;
      successCount: number;
      notifiedAmount: number;
      notifiedCount: number;
      failedAmount: number;
      failedCount: number;
    }>(`/projects/${projectId}/hongbao-statistics`),

  // 导出 CSV（返回完整 URL，浏览器直接打开）
  exportUrl: (projectId: string, params?: { status?: string; keyword?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set('status', params.status);
    if (params?.keyword) sp.set('keyword', params.keyword);
    const q = sp.toString();
    return `${API_BASE_URL}/projects/${projectId}/hongbao-records/export${q ? `?${q}` : ''}`;
  },

  // 批量发送
  sendBatch: (projectId: string, recipients: { openid: string; amount: number }[], remark?: string) =>
    api<{
      total: number;
      success: number;
      failed: number;
      notified: number;
      results: { openid: string; success: boolean; notified?: boolean; error?: string }[];
    }>(`/projects/${projectId}/send-hongbao`, {
      method: 'POST',
      body: JSON.stringify({ recipients, remark }),
    }),

  // 继续发送（暂停后恢复）
  resumeSend: (projectId: string) =>
    api<{
      total: number;
      success: number;
      failed: number;
      results: { openid: string; success: boolean; error?: string }[];
    }>(`/projects/${projectId}/resume-hongbao-send`, {
      method: 'POST',
    }),

  // 保存待发送列表（暂停时）
  savePending: (projectId: string, pendingIds: string[]) =>
    api<{ saved: number }>(`/projects/${projectId}/save-hongbao-pending`, {
      method: 'POST',
      body: JSON.stringify({ pendingIds }),
    }),

  // 单条重试
  retry: (projectId: string, recordId: string) =>
    api<{ recordId: string; success: boolean; errmsg?: string; state?: string }>(
      `/projects/${projectId}/hongbao-records/${recordId}/retry`,
      { method: 'POST' },
    ),
};

// 红包发放中心（全局红包记录 + 独立发放渠道）
export const hongbaoCenterApi = {
  // 全局红包记录查询（projectId 可选）
  list: (params?: {
    projectId?: string;
    page?: number;
    pageSize?: number;
    status?: string;
    keyword?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.projectId) sp.set('projectId', params.projectId);
    if (params?.page) sp.set('page', String(params.page));
    if (params?.pageSize) sp.set('pageSize', String(params.pageSize));
    if (params?.status) sp.set('status', params.status);
    if (params?.keyword) sp.set('keyword', params.keyword);
    const q = sp.toString();
    return api<{ data: any[]; total: number; page: number; pageSize: number }>(
      `/hongbao/records${q ? `?${q}` : ''}`,
    );
  },

  // 导出全局红包记录
  exportUrl: (params?: { projectId?: string; status?: string; keyword?: string }) => {
    const sp = new URLSearchParams();
    if (params?.projectId) sp.set('projectId', params.projectId);
    if (params?.status) sp.set('status', params.status);
    if (params?.keyword) sp.set('keyword', params.keyword);
    const q = sp.toString();
    return `${API_BASE_URL}/hongbao/records/export${q ? `?${q}` : ''}`;
  },

  // 发放红包
  send: (data: { openid: string; amount: number; projectId?: string; remark?: string }) =>
    api<{ errcode: number; errmsg: string; state?: string; outBillNo?: string; notified?: boolean }>(
      '/hongbao/send',
      { method: 'POST', body: JSON.stringify(data) },
    ),

  // 批量发放红包
  sendBatch: (data: { openids: string[]; amount: number; projectId?: string; remark?: string }) =>
    api<{
      total: number;
      success: number;
      failed: number;
      notified: number;
      results: { openid: string; errcode: number; errmsg: string; state?: string; outBillNo?: string; notified?: boolean }[];
    }>(
      '/hongbao/send-batch',
      { method: 'POST', body: JSON.stringify(data) },
    ),
};

// 用户相关 API
export const userApi = {
  // 获取用户列表
  list: (params?: {
    page?: number;
    pageSize?: number;
    gender?: string;
    ageGroup?: string;
    cityTier?: string;
    industry?: string;
    occupation?: string;
    income?: string;
    education?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
    if (params?.gender) searchParams.set('gender', params.gender);
    if (params?.ageGroup) searchParams.set('ageGroup', params.ageGroup);
    if (params?.cityTier) searchParams.set('cityTier', params.cityTier);
    if (params?.industry) searchParams.set('industry', params.industry);
    if (params?.occupation) searchParams.set('occupation', params.occupation);
    if (params?.income) searchParams.set('income', params.income);
    if (params?.education) searchParams.set('education', params.education);
    
    const query = searchParams.toString();
    return api<{ data: any[]; total: number; page: number; pageSize: number }>(
      `/users${query ? `?${query}` : ''}`,
      { method: 'GET' }
    );
  },

  // 获取单个用户
  get: (openid: string) =>
    api<any>(`/users/${openid}`),

  // 获取用户总数
  count: () =>
    api<{ count: number }>('/users/count'),

  // 获取各维度用户库存统计
  getInventory: () =>
    api<{
      total: number;
      gender: { value: string; count: number }[];
      age_group: { value: string; count: number }[];
      education: { value: string; count: number }[];
      city_tier: { value: string; count: number }[];
      industry: { value: string; count: number }[];
      occupation: { value: string; count: number }[];
      income: { value: string; count: number }[];
    }>('/users/inventory'),

  // 获取待转化用户数（关注但未注册）
  getPendingCount: () =>
    api<{ pending: number }>('/users/pending/count'),

  // 获取待转化用户 openid 列表（关注但未注册）
  getPendingList: () =>
    api<{ data: string[]; total: number }>('/users/pending/list'),

  // 获取全部关注用户 openid 列表（公众号当前所有处于关注状态的用户）
  getFollowedList: () =>
    api<{ data: string[]; total: number }>('/users/followed/list'),

  // 导入CSV文件
  importCsv: async (file: File): Promise<{ created: number; updated: number; errors: number; message: string }> => {
    const formData = new FormData();
    formData.append('file', file);

    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/users/import-csv`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.message || `导入失败: ${response.status}`);
    }

    return response.json();
  },
};

// 项目相关 API
export const projectApi = {
  // 创建项目
  create: (data: any) =>
    api<{ id: string; projectCode: string }>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 获取项目列表
  list: () =>
    api<any[]>('/projects?pageSize=1000', {
      method: 'GET',
    }),

  // 获取项目答题记录（支持分页）
  getAnswerRecords: (id: string, page = 1, pageSize = 50) =>
    api<{ data: any[]; total: number; page: number; pageSize: number }>(
      `/projects/${id}/answer-records?page=${page}&pageSize=${pageSize}`,
      { method: 'GET' },
    ),

  // 获取问卷完整题目结构（含所有选项，用于导出计算字母前缀）
  getSurveyStructure: (id: string) =>
    api<{ surveyId: string; hash: string; questions: any[] }>(`/projects/${id}/survey-structure`, {
      method: 'GET',
    }),

  // 获取项目统计数据（成功发放人次、已答题人次、各状态项目数量、平均推送率）
  getStatistics: async () => {
    // 先尝试主路由 /projects/statistics
    try {
      const res = await api<{
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
      }>('/projects/statistics');
      return res;
    } catch {
      // 若 :id 路由拦截 (404)，走备用路由 /project-statistics
      return api<{
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
      }>('/project-statistics');
    }
  },

  // 获取红包概览统计（全平台汇总）
  getHongbaoOverview: () =>
    api<{
      totalExpense: number;
      successCount: number;
      failedCount: number;
      avgPerPerson: number;
    }>('/projects/hongbao-overview'),

  // 获取系统配置状态（安全配置页面）
  getConfigStatus: () =>
    api<{
      deployment: { platform: string; label: string; advice: string };
      wechat: { configured: boolean; appId: string; advice: string };
      wechatPay: { configured: boolean; merchantId: string; advice: string };
      tencentSurvey: { configured: boolean; advice: string; note: string };
      database: { type: string; location: string; advice: string };
      system: { jwtConfigured: boolean; adminConfigured: boolean; advice: string };
      webhook: { url: string; advice: string };
    }>('/projects/config-status'),

  // 获取项目详情
  get: (id: string) =>
    api<any>(`/projects/${id}`),

  // 更新项目
  update: (id: string, data: any) =>
    api<any>(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // 删除项目
  delete: (id: string) =>
    api<{ success: boolean }>(`/projects/${id}`, {
      method: 'DELETE',
    }),

  // 发送模板消息（后端批量发送）
  sendTemplate: (id: string, openids: string[]) =>
    api<{ total: number; success: number; failed: number; remaining: number; paused: boolean; results: any[] }>(
      `/projects/${id}/send-template`,
      { method: 'POST', body: JSON.stringify({ openids }) }
    ),

  // 继续发送（从暂停断点续发）
  resumeSend: (id: string) =>
    api<{ total: number; success: number; failed: number; remaining: number; paused: boolean; results: any[] }>(
      `/projects/${id}/resume-send`,
      { method: 'POST' }
    ),
};

export const excludeApi = {
  // 获取排除列表
  list: (projectId: string, page = 1, pageSize = 1000) =>
    api<{ data: any[]; total: number }>(`/excludes?projectId=${projectId}&page=${page}&pageSize=${pageSize}`, {
      method: 'GET',
    }),

  // 全量同步排除列表（替换该项目所有排除记录）
  sync: (projectId: string, openids: string[]) =>
    api<{ projectId: string; count: number }>('/excludes/sync', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, openids }),
    }),
};

export default api;

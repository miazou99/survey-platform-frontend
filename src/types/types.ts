export interface Project {
  id: string;
  project_code: string;
  name: string;
  description: string;
  survey_link: string;
  wechat_template_id: string;
  survey_subject: string;
  start_time: string;
  end_time: string;
  total_samples: number;
  sent_samples: number; // 成功发放人数（成功推送到微信公众号的用户数）
  collected_samples: number;
  response_rate: number;
  status: 'draft' | 'pending' | 'pending_hongbao' | 'active' | 'in_progress' | 'paused' | 'completed';
  // 草稿箱：记录停在哪一步（1-4）
  draft_step?: number;
  created_at: string;
  updated_at: string;
  // 项目配额情况
  selected_dimensions: string[]; // 选择的维度列表，如 ['gender', 'age', 'region']
  quotas: QuotaItem[]; // 各维度的配额详情
  // 投放方式
  sampling_mode: 'auto' | 'manual';  // auto=自动抽样投放, manual=指定样本投放
  manual_openids?: string[];  // 指定投放时的openid列表
  // 推送进度（JSON字符串化的剩余openid列表）
  pendingOpenids?: string;
}

// 配额条目
export interface QuotaItem {
  dimension_key: string; // 维度 key，如 'gender'
  dimension_label: string; // 维度中文名，如 '性别'
  tag_name: string; // 标签名，如 '男'
  quota_percent: number; // 配额百分比，如 50
  target_count: number; // 目标数量，如 500
}

// 用户画像 - 从腾讯问卷注册问卷同步
// 注意：age, age_group, city_tier 是派生字段，通过 dataUtils 计算得到
export interface UserProfile {
  openid: string;
  // 原始字段（来自腾讯问卷）
  gender: '男' | '女';
  birth_year: number;      // 出生年份
  education: string;      // 最高学历
  province: string;        // 省份
  city: string;            // 城市
  district: string;        // 区
  occupation: string;      // 职业
  industry: string;        // 从事行业（一级分类）
  industrySub: string;     // 从事行业（二级分类）
  income: string;         // 个人月收入
  phone?: string;          // 手机号
  // 元数据
  registered_at: string;
  last_synced_at: string;
}

// 派生字段（不存储，通过计算得到）
export interface DerivedUserFields {
  age: number;            // 年龄
  age_group: string;      // 年龄段：under18, 18-24, 25-29, 30-34, 35-39, 40-44, 45+
  city_tier: string;       // 城市级别：tier1, tier2, tier3, tier4, tier5, other
}

// 答题记录
export interface AnswerRecord {
  id: string;
  project_id: string;
  openid: string;
  answer_time: string;
  is_valid: boolean;
  exclude_hongbao: boolean;
  exclude_reason?: string;
  // 导出用：腾讯问卷原始 JSON（含 payload.answer 数组）和关联的用户画像
  raw_data?: string;
  profile?: UserProfile | null;
  duration?: number;
  ended_at?: string | null;
}

export interface HongbaoRecord {
  id: string;
  project_id: string;
  openid: string;
  amount: number;
  status: 'pending' | 'sent' | 'failed' | 'refunded';
  sent_at: string | null;
  error_message?: string;
  refund_reason?: string;  // 退回原因（如"用户已取关"）
}

export interface HongbaoConfig {
  mode: 'total_to_average' | 'average_to_total';
  total_amount?: number;
  average_amount?: number;
  exclude_count: number;
  final_count: number;
  final_average: number;
  final_total: number;
  remark?: string;
}

export interface SamplingRule {
  id: string;
  project_id: string;
  dimension_key: string;
  selected_tags: string[];
  created_at: string;
}

export interface QuotaSetting {
  id: string;
  project_id: string;
  dimension_key: string;
  tag_name: string;
  quota_percent: number;
  target_count: number;
  stock_count: number;
  created_at: string;
}

export interface Respondent {
  id: string;
  openid: string;
  gender: 'male' | 'female' | '';
  age: string;
  region: string;
  education: string;
  industry: string;
  income: string;
  city_level: string;
  occupation: string;
  status: 'pending' | 'sent' | 'completed';
  registered_at: string;
  updated_at: string;
}

export interface SurveyRecord {
  id: string;
  project_id: string;
  respondent_id: string;
  openid: string;
  sent_at: string;
  completed_at: string | null;
  status: 'pending' | 'sent' | 'completed';
}

export interface WechatConfig {
  id: string;
  app_id: string;
  app_secret: string;
  access_token: string;
  token_expires_at: string;
}

export interface DimensionTag {
  dimension_key: string;
  tag_name: string;
  tag_value: string;
}

export interface Dimension {
  key: string;
  label: string;
  type?: 'single' | 'derived';  // optional: single=原始字段, derived=派生字段
  tags: { name: string; value: string }[];
}

export type ProjectStatus = 'draft' | 'pending' | 'pending_hongbao' | 'active' | 'in_progress' | 'paused' | 'completed';
export type RespondentStatus = 'pending' | 'sent' | 'completed';

// 用户状态（基于微信公众号关注状态和注册状态）
export type UserStatus = 'valid' | 'pending' | 'lost';

// 有效用户：关注公众号 ∩ 完成注册问卷 ∩ 未取关
// 待转化用户：关注公众号 ∩ 未完成注册问卷
// 已流失用户：之前注册过但已取关（保持关注∩注册∩取关）
export interface UserWithStatus {
  openid: string;
  status: UserStatus;
  subscribed_at?: string;  // 关注时间
  unsubscribed_at?: string;  // 取关时间
  registered_at?: string;  // 注册问卷完成时间
  last_synced_at: string;  // 最后同步时间
}

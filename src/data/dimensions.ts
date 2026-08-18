import { Dimension } from '../types/types';

/**
 * 维度定义 - 基于腾讯问卷注册问卷字段
 *
 * 原始字段：性别、出生年份、学历、省份、城市、职业、行业、收入
 * 派生字段：年龄段（由出生年份计算）、城市级别（由城市查表计算）
 */

// 性别
const GENDER_DIMENSION: Dimension = {
  key: 'gender',
  label: '性别',
  type: 'single',
  tags: [
    { name: '男', value: '男' },
    { name: '女', value: '女' },
  ],
};

// 年龄段（由出生年份计算得到）
const AGE_GROUP_DIMENSION: Dimension = {
  key: 'age_group',
  label: '年龄段',
  type: 'derived',
  tags: [
    { name: '18岁以下', value: 'under18' },
    { name: '18-24岁', value: '18-24' },
    { name: '25-29岁', value: '25-29' },
    { name: '30-34岁', value: '30-34' },
    { name: '35-39岁', value: '35-39' },
    { name: '40-44岁', value: '40-44' },
    { name: '45岁及以上', value: '45+' },
  ],
};

// 学历
const EDUCATION_DIMENSION: Dimension = {
  key: 'education',
  label: '最高学历',
  type: 'single',
  tags: [
    { name: '初中及以下', value: '初中及以下' },
    { name: '高中/中专/技校', value: '高中/中专/技校' },
    { name: '大学专科', value: '大学专科' },
    { name: '大学本科', value: '大学本科' },
    { name: '硕士及以上', value: '硕士及以上' },
  ],
};

// 城市级别（由城市名查表计算得到）
const CITY_TIER_DIMENSION: Dimension = {
  key: 'city_tier',
  label: '城市级别',
  type: 'derived',
  tags: [
    { name: '一线城市', value: 'tier1' },
    { name: '二线城市', value: 'tier2' },
    { name: '三线城市', value: 'tier3' },
    { name: '四线城市', value: 'tier4' },
    { name: '五线城市', value: 'tier5' },
    { name: '其他', value: 'other' },
  ],
};

// 职业（按注册问卷选项，共13个）
const OCCUPATION_DIMENSION: Dimension = {
  key: 'occupation',
  label: '职业',
  type: 'single',
  tags: [
    { name: '在校学生', value: '在校学生' },
    { name: '政府/机关干部/公务员', value: '政府/机关干部/公务员' },
    { name: '企业管理者（包括基层及中高层管理者）', value: '企业管理者（包括基层及中高层管理者）' },
    { name: '普通职员（办公室/写字楼工作人员）', value: '普通职员（办公室/写字楼工作人员）' },
    { name: '专业人员（如医生/律师/文体/记者/老师等）', value: '专业人员（如医生/律师/文体/记者/老师等）' },
    { name: '普通工人（如工厂工人/体力劳动者等）', value: '普通工人（如工厂工人/体力劳动者等）' },
    { name: '商业服务业职工（如销售人员/商店职员/服务员等）', value: '商业服务业职工（如销售人员/商店职员/服务员等）' },
    { name: '个体经营者/承包商', value: '个体经营者/承包商' },
    { name: '自由职业者', value: '自由职业者' },
    { name: '农林牧渔劳动者', value: '农林牧渔劳动者' },
    { name: '退休', value: '退休' },
    { name: '暂无职业', value: '暂无职业' },
    { name: '其他', value: '其他' },
  ],
};

// 行业（按注册问卷一级分类，共14个）
const INDUSTRY_DIMENSION: Dimension = {
  key: 'industry',
  label: '从事行业',
  type: 'single',
  tags: [
    { name: 'IT/通信/电子/互联网', value: 'IT/通信/电子/互联网' },
    { name: '金融业', value: '金融业' },
    { name: '房地产/建筑业', value: '房地产/建筑业' },
    { name: '商业服务', value: '商业服务' },
    { name: '贸易/批发/零售/租赁业', value: '贸易/批发/零售/租赁业' },
    { name: '文体教育/工艺美术', value: '文体教育/工艺美术' },
    { name: '生产/加工/制造', value: '生产/加工/制造' },
    { name: '交通/运输/物流/仓储', value: '交通/运输/物流/仓储' },
    { name: '服务业', value: '服务业' },
    { name: '文化/传媒/娱乐/体育', value: '文化/传媒/娱乐/体育' },
    { name: '能源/矿产/环保', value: '能源/矿产/环保' },
    { name: '政府/非盈利机构', value: '政府/非盈利机构' },
    { name: '农/林/牧/渔', value: '农/林/牧/渔' },
    { name: '无/其他', value: '无/其他' },
  ],
};

// 个人月收入（按问卷选项）
const INCOME_DIMENSION: Dimension = {
  key: 'income',
  label: '个人月收入',
  type: 'single',
  tags: [
    { name: '500元以下', value: '500元以下' },
    { name: '500-1000元', value: '500-1000元' },
    { name: '1001-1500元', value: '1001-1500元' },
    { name: '1501-2000元', value: '1501-2000元' },
    { name: '2001-3000元', value: '2001-3000元' },
    { name: '3001-5000元', value: '3001-5000元' },
    { name: '5001-8000元', value: '5001-8000元' },
    { name: '8001-10000元', value: '8001-10000元' },
    { name: '10001-20000元', value: '10001-20000元' },
    { name: '20000元以上', value: '20000元以上' },
  ],
};

// 用于配额设置的维度（排除省份、城市这类详情字段）
export const DIMENSIONS_FOR_QUOTA: Dimension[] = [
  GENDER_DIMENSION,
  AGE_GROUP_DIMENSION,
  EDUCATION_DIMENSION,
  CITY_TIER_DIMENSION,
  OCCUPATION_DIMENSION,
  INDUSTRY_DIMENSION,
  INCOME_DIMENSION,
];

// 导出所有维度（兼容旧代码）
export const DIMENSIONS: Dimension[] = DIMENSIONS_FOR_QUOTA;

// 出生年份选项（用于问卷下拉题）
export const BIRTH_YEAR_OPTIONS = [
  { name: '2012年', value: 2012 },
  { name: '2011年', value: 2011 },
  { name: '2010年', value: 2010 },
  { name: '2009年', value: 2009 },
  { name: '2008年', value: 2008 },
  { name: '2007年', value: 2007 },
  { name: '2006年', value: 2006 },
  { name: '2005年', value: 2005 },
  { name: '2004年', value: 2004 },
  { name: '2003年', value: 2003 },
  { name: '2002年', value: 2002 },
  { name: '2001年', value: 2001 },
  { name: '2000年', value: 2000 },
  { name: '1999年', value: 1999 },
  { name: '1998年', value: 1998 },
  { name: '1997年', value: 1997 },
  { name: '1996年', value: 1996 },
  { name: '1995年', value: 1995 },
  { name: '1994年', value: 1994 },
  { name: '1993年', value: 1993 },
  { name: '1992年', value: 1992 },
  { name: '1991年', value: 1991 },
  { name: '1990年', value: 1990 },
  { name: '1989年', value: 1989 },
  { name: '1988年', value: 1988 },
  { name: '1987年', value: 1987 },
  { name: '1986年', value: 1986 },
  { name: '1985年', value: 1985 },
  { name: '1984年', value: 1984 },
  { name: '1983年', value: 1983 },
  { name: '1982年', value: 1982 },
  { name: '1981年', value: 1981 },
  { name: '1980年', value: 1980 },
  { name: '1979年', value: 1979 },
  { name: '1978年', value: 1978 },
  { name: '1977年', value: 1977 },
  { name: '1976年', value: 1976 },
  { name: '1975年', value: 1975 },
  { name: '1974年', value: 1974 },
  { name: '1973年', value: 1973 },
  { name: '1972年', value: 1972 },
  { name: '1971年', value: 1971 },
  { name: '1970年', value: 1970 },
  { name: '1960年前', value: 1959 },  // 1960年前统一用1959
];

// 微信模板消息字段配置
// key: 前端表单字段标识
// wechat_key: 微信模板中的关键词变量名（必须与微信公众号后台设置的关键词一致）
// label: 前端显示的中文标签
export interface WechatTemplateField {
  key: string;
  wechat_key: string;
  label: string;
}

export const WECHAT_TEMPLATE_FIELDS: Record<string, WechatTemplateField[]> = {
  'PLKkZGOn3Xu-dwpSzXgmXnSo9pMapZGmMkfcth05gfw': [
    { key: 'task_title', wechat_key: 'thing5', label: '工单标题' },
    { key: 'project_name', wechat_key: 'thing11', label: '项目名称' },
    { key: 'end_time', wechat_key: 'time21', label: '截止时间' },
  ],
};

export const WECHAT_TEMPLATES = [
  { id: 'PLKkZGOn3Xu-dwpSzXgmXnSo9pMapZGmMkfcth05gfw', name: '工单催办提醒' },
];

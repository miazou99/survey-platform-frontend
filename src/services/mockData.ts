import { Project, Respondent, AnswerRecord, HongbaoRecord, UserProfile } from '../types/types';
import { REGIONS } from '../data/regionData';

export const MOCK_PROJECTS: Project[] = [
  {
    id: '1',
    project_code: 'PRJ-2026-001',
    name: '2026全球饮料消费趋势研究',
    description: '针对全国消费者的饮料消费习惯调研',
    survey_link: 'https://wj.qq.com/s2/abc123/',
    wechat_template_id: 'template_001',
    survey_subject: '2026全球饮料消费趋势调研',
    start_time: '2026-03-01 09:00:00',
    end_time: '2026-03-15 18:00:00',
    total_samples: 1000,
    sent_samples: 850,
    collected_samples: 650,
    response_rate: 0.65,
    status: 'active',
    created_at: '2026-03-01 08:00:00',
    updated_at: '2026-03-15 10:30:00',
    selected_dimensions: ['gender', 'age', 'region'],
    quotas: [
      { dimension_key: 'gender', dimension_label: '性别', tag_name: '男', quota_percent: 50, target_count: 500 },
      { dimension_key: 'gender', dimension_label: '性别', tag_name: '女', quota_percent: 50, target_count: 500 },
      { dimension_key: 'age', dimension_label: '年龄', tag_name: '18-24岁', quota_percent: 20, target_count: 200 },
      { dimension_key: 'age', dimension_label: '年龄', tag_name: '25-29岁', quota_percent: 25, target_count: 250 },
      { dimension_key: 'age', dimension_label: '年龄', tag_name: '30-34岁', quota_percent: 25, target_count: 250 },
      { dimension_key: 'age', dimension_label: '年龄', tag_name: '35岁及以上', quota_percent: 30, target_count: 300 },
      { dimension_key: 'region', dimension_label: '地区', tag_name: '一线城市', quota_percent: 40, target_count: 400 },
      { dimension_key: 'region', dimension_label: '地区', tag_name: '二线城市', quota_percent: 35, target_count: 350 },
      { dimension_key: 'region', dimension_label: '地区', tag_name: '三线城市', quota_percent: 25, target_count: 250 },
    ],
    sampling_mode: 'auto',
  },
  {
    id: '2',
    project_code: 'PRJ-2026-002',
    name: '新能源汽车购买意向调查',
    description: '了解消费者对新能源汽车的购买意愿和考虑因素',
    survey_link: 'https://wj.qq.com/s2/def456/',
    wechat_template_id: 'template_001',
    survey_subject: '新能源汽车购买意向调研',
    start_time: '2026-02-15 09:00:00',
    end_time: '2026-03-01 18:00:00',
    total_samples: 800,
    sent_samples: 800,
    collected_samples: 800,
    response_rate: 0.89,
    status: 'pending_hongbao',
    created_at: '2026-02-15 08:00:00',
    updated_at: '2026-03-01 18:30:00',
    selected_dimensions: ['gender', 'age', 'income'],
    quotas: [
      { dimension_key: 'gender', dimension_label: '性别', tag_name: '男', quota_percent: 60, target_count: 480 },
      { dimension_key: 'gender', dimension_label: '性别', tag_name: '女', quota_percent: 40, target_count: 320 },
      { dimension_key: 'age', dimension_label: '年龄', tag_name: '25-29岁', quota_percent: 30, target_count: 240 },
      { dimension_key: 'age', dimension_label: '年龄', tag_name: '30-34岁', quota_percent: 35, target_count: 280 },
      { dimension_key: 'age', dimension_label: '年龄', tag_name: '35-39岁', quota_percent: 35, target_count: 280 },
      { dimension_key: 'income', dimension_label: '收入', tag_name: '8000元以下', quota_percent: 30, target_count: 240 },
      { dimension_key: 'income', dimension_label: '收入', tag_name: '8001-15000元', quota_percent: 40, target_count: 320 },
      { dimension_key: 'income', dimension_label: '收入', tag_name: '15001元及以上', quota_percent: 30, target_count: 240 },
    ],
    sampling_mode: 'auto',
  },
  {
    id: '3',
    project_code: 'PRJ-2026-003',
    name: '在线教育平台使用体验调研',
    description: '评估用户对在线教育平台的满意度和建议',
    survey_link: 'https://wj.qq.com/s2/ghi789/',
    wechat_template_id: 'template_001',
    survey_subject: '在线教育平台使用体验调研',
    start_time: '2026-01-10 09:00:00',
    end_time: '2026-01-25 18:00:00',
    total_samples: 500,
    sent_samples: 480,
    collected_samples: 500,
    response_rate: 0.92,
    status: 'completed',
    created_at: '2026-01-10 08:00:00',
    updated_at: '2026-01-28 16:00:00',
    selected_dimensions: ['gender', 'industry'],
    quotas: [
      { dimension_key: 'gender', dimension_label: '性别', tag_name: '男', quota_percent: 45, target_count: 225 },
      { dimension_key: 'gender', dimension_label: '性别', tag_name: '女', quota_percent: 55, target_count: 275 },
      { dimension_key: 'industry', dimension_label: '行业', tag_name: 'IT/通信/电子/互联网', quota_percent: 40, target_count: 200 },
      { dimension_key: 'industry', dimension_label: '行业', tag_name: '金融业', quota_percent: 20, target_count: 100 },
      { dimension_key: 'industry', dimension_label: '行业', tag_name: '制造业', quota_percent: 15, target_count: 75 },
      { dimension_key: 'industry', dimension_label: '行业', tag_name: '服务业', quota_percent: 25, target_count: 125 },
    ],
    sampling_mode: 'auto',
  },
  {
    id: '4',
    project_code: 'PRJ-2026-005',
    name: '智能家居产品使用调查',
    description: '了解消费者对智能家居产品的接受度',
    survey_link: 'https://wj.qq.com/s2/mno345/',
    wechat_template_id: 'template_001',
    survey_subject: '智能家居产品使用调查',
    start_time: '2026-03-25 09:00:00',
    end_time: '2026-04-10 18:00:00',
    total_samples: 300,
    sent_samples: 0,
    collected_samples: 0,
    response_rate: 0,
    status: 'draft',
    draft_step: 2, // 停在了第二步"抽样框"
    created_at: '2026-03-25 14:00:00',
    updated_at: '2026-03-25 15:30:00',
    selected_dimensions: [],
    quotas: [],
    sampling_mode: 'auto',
  },
];

export const MOCK_ANSWER_RECORDS: AnswerRecord[] = generateAnswerRecords();
export const MOCK_HONGBAO_RECORDS: HongbaoRecord[] = generateHongbaoRecords();

function generateAnswerRecords(): AnswerRecord[] {
  const records: AnswerRecord[] = [];

  // 项目2（待发红包）答题记录 - 前50条为腾讯问卷判定无效
  for (let i = 0; i < 800; i++) {
    records.push({
      id: `ans_${i + 1}`,
      project_id: '2',
      openid: `o${Math.random().toString(36).substring(2, 15)}`,
      answer_time: `2026-02-${String(15 + Math.floor(i / 50)).padStart(2, '0')} ${String(9 + Math.floor(Math.random() * 10)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00`,
      is_valid: i >= 50, // 前50条为无效，后750条为有效
      exclude_hongbao: false,
    });
  }

  // 项目1（进行中）答题记录
  for (let i = 0; i < 650; i++) {
    records.push({
      id: `ans_${800 + i + 1}`,
      project_id: '1',
      openid: `o${Math.random().toString(36).substring(2, 15)}`,
      answer_time: `2026-03-${String(1 + Math.floor(i / 50)).padStart(2, '0')} ${String(9 + Math.floor(Math.random() * 10)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00`,
      is_valid: true,
      exclude_hongbao: false,
    });
  }

  // 项目3（已完成）答题记录
  for (let i = 0; i < 500; i++) {
    const isValid = Math.random() > 0.1; // 90% 有效
    records.push({
      id: `ans_${1450 + i + 1}`,
      project_id: '3',
      openid: `o${Math.random().toString(36).substring(2, 15)}`,
      answer_time: `2026-01-${String(10 + Math.floor(i / 30)).padStart(2, '0')} ${String(9 + Math.floor(Math.random() * 10)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00`,
      is_valid: isValid,
      exclude_hongbao: false,
    });
  }

  return records;
}

function generateHongbaoRecords(): HongbaoRecord[] {
  const records: HongbaoRecord[] = [];

  // 已发送成功的红包（420条）
  for (let i = 0; i < 420; i++) {
    records.push({
      id: `hb_${i + 1}`,
      project_id: '3',
      openid: `o${Math.random().toString(36).substring(2, 15)}`,
      amount: 5.00,
      status: 'sent',
      sent_at: `2026-01-${String(26 + Math.floor(i / 100)).padStart(2, '0')} ${String(10 + Math.floor(Math.random() * 8)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00`,
    });
  }

  // 发送失败的红包（30条 - 如用户已取关、账户异常等）
  for (let i = 0; i < 30; i++) {
    const reasons = ['用户已取关', '账户异常', '超过发放限额', '微信支付异常'];
    records.push({
      id: `hb_fail_${i + 1}`,
      project_id: '3',
      openid: `o_fail_${Math.random().toString(36).substring(2, 15)}`,
      amount: 5.00,
      status: 'failed',
      sent_at: null,
      error_message: reasons[Math.floor(Math.random() * reasons.length)],
    });
  }

  // 已发放但退回的红包（50条 - 发送成功后用户取关，红包退回商户号）
  for (let i = 0; i < 50; i++) {
    records.push({
      id: `hb_refund_${i + 1}`,
      project_id: '3',
      openid: `o_refund_${Math.random().toString(36).substring(2, 15)}`,
      amount: 5.00,
      status: 'refunded',
      sent_at: `2026-01-28 ${String(10 + Math.floor(Math.random() * 8)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00`,
      refund_reason: '用户已取关，红包退回商户号',
    });
  }

  return records;
}

const regions = ['北京', '上海', '广东', '浙江', '江苏', '四川', '山东', '河南', '湖北', '湖南'];
const genders = ['male', 'female'];
const ages = ['18-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50岁及以上'];
const educations = ['初中及以下', '高中/中专/技校', '大学专科', '大学本科', '硕士及以上'];
const industries = ['IT/通信/电子/互联网', '金融业', '制造业', '服务业', '商业服务', '政府/非盈利机构'];
const incomes = ['3001-8000', '8001-15000', '15000元以上'];
const cityLevels = ['一线城市', '二线城市', '三线城市'];
const occupations = ['普通职员', '企业管理者', '在校学生', '个体经营者/承包商', '政府/机关干部/公务员'];

function generateRespondents(count: number): Respondent[] {
  const respondents: Respondent[] = [];
  for (let i = 0; i < count; i++) {
    respondents.push({
      id: String(i + 1),
      openid: `o${Math.random().toString(36).substring(2, 15)}`,
      gender: genders[Math.floor(Math.random() * genders.length)] as 'male' | 'female',
      age: ages[Math.floor(Math.random() * ages.length)],
      region: regions[Math.floor(Math.random() * regions.length)],
      education: educations[Math.floor(Math.random() * educations.length)],
      industry: industries[Math.floor(Math.random() * industries.length)],
      income: incomes[Math.floor(Math.random() * incomes.length)],
      city_level: cityLevels[Math.floor(Math.random() * cityLevels.length)],
      occupation: occupations[Math.floor(Math.random() * occupations.length)],
      status: 'pending',
      registered_at: `2026-03-${String(Math.floor(Math.random() * 30) + 1).padStart(2, '0')} 10:00:00`,
      updated_at: `2026-03-${String(Math.floor(Math.random() * 30) + 1).padStart(2, '0')} 10:00:00`,
    });
  }
  return respondents;
}

export const MOCK_RESPONDENTS: Respondent[] = generateRespondents(5000);

/**
 * 基于固定种子的伪随机数生成器
 * 保证每次生成的数据完全相同
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number = 20260301) {
    this.seed = seed;
  }

  // 获取0-1之间的随机数
  random(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  // 获取指定范围的随机整数 [min, max]
  randInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  // 加权随机选择
  weightedRandom<T>(items: T[], weights: number[]): T {
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let r = this.random() * totalWeight;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }
}

/**
 * 生成用户画像数据 - 按真实分布模拟（固定种子，确保数据稳定）
 * 共7个维度：性别、出生年份/年龄段、学历、省份、城市、职业、行业、收入
 */
function generateUserProfiles(count: number): UserProfile[] {
  // 使用固定种子 20260301，确保每次生成的数据完全相同
  const rng = new SeededRandom(20260301);
  const profiles: UserProfile[] = [];

  // 1. 性别分布（接近真实：男51%，女49%）
  const genderWeights = [51, 49];

  // 2. 出生年份分布（基于问卷用户群体，偏向80/90/00后）
  const birthYearWeights = [
    0.5,   // 2012年
    0.5,   // 2011年
    0.5,   // 2010年
    0.5,   // 2009年
    0.8,   // 2008年
    0.8,   // 2007年
    1.0,   // 2006年
    1.2,   // 2005年
    1.5,   // 2004年
    2.0,   // 2003年
    3.0,   // 2002年
    5.0,   // 2001年
    8.0,   // 2000年
    10.0,  // 1999年
    12.0,  // 1998年
    14.0,  // 1997年
    16.0,  // 1996年
    18.0,  // 1995年
    20.0,  // 1994年
    22.0,  // 1993年
    24.0,  // 1992年
    26.0,  // 1991年
    28.0,  // 1990年
    30.0,  // 1989年
    28.0,  // 1988年
    26.0,  // 1987年
    24.0,  // 1986年
    22.0,  // 1985年
    20.0,  // 1984年
    18.0,  // 1983年
    16.0,  // 1982年
    14.0,  // 1981年
    12.0,  // 1980年
    10.0,  // 1979年
    8.0,   // 1978年
    6.0,   // 1977年
    4.0,   // 1976年
    3.0,   // 1975年
    2.0,   // 1974年
    1.5,   // 1973年
    1.0,   // 1972年
    0.8,   // 1971年
    0.5,   // 1970年
    0.3,   // 1960年前
  ];
  const birthYears = [2012, 2011, 2010, 2009, 2008, 2007, 2006, 2005, 2004, 2003, 2002, 2001, 2000, 1999, 1998, 1997, 1996, 1995, 1994, 1993, 1992, 1991, 1990, 1989, 1988, 1987, 1986, 1985, 1984, 1983, 1982, 1981, 1980, 1979, 1978, 1977, 1976, 1975, 1974, 1973, 1972, 1971, 1970, 1959];

  // 3. 学历分布（本科+专科为主）
  const educationOptions = ['初中及以下', '高中/中专/技校', '大学专科', '大学本科', '硕士及以上'];
  const educationWeights = [5, 15, 30, 40, 10];

  // 4. 职业分布
  const occupationOptions = [
    '在校学生', '政府/机关干部/公务员', '企业管理者', '普通职员', '专业人员',
    '普通工人', '商业服务业职工', '个体经营者/承包商', '自由职业者', '农林牧渔劳动者', '退休', '暂无职业', '其他'
  ];
  const occupationWeights = [15, 5, 8, 25, 10, 8, 10, 6, 5, 2, 3, 1, 2];

  // 5. 行业分布
  const industryOptions = [
    'IT/通信/电子/互联网', '金融业', '房地产/建筑业', '商业服务', '贸易/批发/零售/租赁业',
    '文体教育/工艺美术', '生产/加工/制造', '交通/运输/物流/仓储', '服务业', '文化/传媒/娱乐/体育',
    '能源/矿产/环保', '政府/非盈利机构', '农/林/牧/渔/其他', '其他'
  ];
  const industryWeights = [18, 10, 8, 10, 8, 6, 10, 6, 8, 5, 3, 3, 2, 3];

  // 6. 收入分布（3001-8000元为主）
  const incomeOptions = ['500元以下', '500-1000元', '1001-1500元', '1501-2000元', '2001-3000元', '3001-5000元', '5001-8000元', '8001-10000元', '10001-20000元', '20000元以上'];
  const incomeWeights = [5, 5, 8, 12, 20, 22, 15, 7, 4, 2];

  // 7. 省份分布（按人口和经济水平加权）
  const provinceWeights = [
    90,   // 广东省
    80,   // 山东省
    75,   // 河南省
    70,   // 江苏省
    65,   // 四川省
    55,   // 浙江省
    50,   // 河北省
    48,   // 湖南省
    45,   // 安徽省
    42,   // 湖北省
    38,   // 云南省
    35,   // 陕西省
    32,   // 江西省
    30,   // 山西省
    28,   // 福建省
    25,   // 辽宁省
    22,   // 广西壮族自治区
    20,   // 黑龙江省
    18,   // 吉林省
    15,   // 贵州省
    12,   // 甘肃省
    10,   // 海南省
    8,    // 内蒙古自治区
    8,    // 宁夏回族自治区
    6,    // 青海省
    6,    // 西藏自治区
    120,  // 北京市
    115,  // 上海市
    45,   // 重庆市
    40,   // 天津
    0,    // 香港特别行政区
    0,    // 澳门特别行政区
    0,    // 台湾省
    0,    // 钓鱼岛
    0,    // 海外
  ];

  for (let i = 0; i < count; i++) {
    // 1. 选择省份
    const province = rng.weightedRandom(REGIONS.map(r => r.name), provinceWeights);

    // 2. 选择该省份下的城市
    const region = REGIONS.find(r => r.name === province);
    const cities = region?.cities || ['未知'];
    const city = cities[rng.randInt(0, cities.length - 1)];

    // 3. 选择性别
    const gender = rng.weightedRandom(['男', '女'], genderWeights);

    // 4. 选择出生年份
    const birthYear = rng.weightedRandom(birthYears, birthYearWeights);

    // 5. 选择学历
    const education = rng.weightedRandom(educationOptions, educationWeights);

    // 6. 选择职业
    const occupation = rng.weightedRandom(occupationOptions, occupationWeights);

    // 7. 选择行业
    const industry = rng.weightedRandom(industryOptions, industryWeights);

    // 8. 选择收入
    const income = rng.weightedRandom(incomeOptions, incomeWeights);

    // 生成openid（使用固定字符串前缀 + 序号，避免随机变化）
    const openid = `o_fixed_${String(i + 1).padStart(10, '0')}`;

    // 注册时间（2026年1月-3月，按序号分配，确保固定）
    const regMonth = ((i % 3) + 1).toString().padStart(2, '0');
    const regDay = ((i % 28) + 1).toString().padStart(2, '0');
    const regHour = rng.randInt(0, 23).toString().padStart(2, '0');
    const regMinute = rng.randInt(0, 59).toString().padStart(2, '0');

    profiles.push({
      openid,
      gender: gender as '男' | '女',
      birth_year: birthYear,
      education,
      province,
      city,
      district: '',  // 模拟数据暂无区级信息
      occupation,
      industry,
      industrySub: '',  // 模拟数据暂无行业二级分类
      income,
      registered_at: `2026-${regMonth}-${regDay} ${regHour}:${regMinute}:00`,
      last_synced_at: '2026-03-30 00:00:00',
    });
  }

  return profiles;
}

export const MOCK_USER_PROFILES: UserProfile[] = generateUserProfiles(2000);

// 根据 openid 获取用户画像
export function getUserProfileByOpenid(openid: string): UserProfile | undefined {
  return MOCK_USER_PROFILES.find(p => p.openid === openid);
}

// 批量获取用户画像
export function getUserProfilesByOpenids(openids: string[]): Map<string, UserProfile> {
  const map = new Map<string, UserProfile>();
  openids.forEach(openid => {
    const profile = getUserProfileByOpenid(openid);
    if (profile) {
      map.set(openid, profile);
    }
  });
  return map;
}

export function getRespondentsByDimension(
  respondents: Respondent[],
  dimension: string,
  tag: string
): Respondent[] {
  return respondents.filter(r => {
    switch (dimension) {
      case 'gender':
        return r.gender === tag;
      case 'age':
        return r.age === tag;
      case 'region':
        return r.region === tag;
      case 'education':
        return r.education === tag;
      case 'industry':
        return r.industry === tag;
      case 'income':
        return r.income === tag;
      case 'city_level':
        return r.city_level === tag;
      case 'occupation':
        return r.occupation === tag;
      default:
        return true;
    }
  });
}

export function calculateQuotaCounts(
  totalSamples: number,
  quotaPercents: { dimension: string; tag: string; percent: number }[],
  respondents: Respondent[]
): { dimension: string; tag: string; percent: number; targetCount: number; stockCount: number }[] {
  return quotaPercents.map(qp => {
    const stockCount = getRespondentsByDimension(respondents, qp.dimension, qp.tag).length;
    const targetCount = Math.round(totalSamples * (qp.percent / 100));
    return {
      ...qp,
      targetCount,
      stockCount,
    };
  });
}

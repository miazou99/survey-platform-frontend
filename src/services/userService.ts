/**
 * 用户数据服务
 * 处理从腾讯问卷导入用户数据
 */

import { UserProfile } from '../types/types';
import { parseGender, parseBirthYear, parseOptionValue, calculateDerivedFields } from './dataUtils';
import { userApi, projectApi } from './api';
// MOCK兜底已移除：API失败时直接抛出错误，不切假数据

export interface TencentSurveyRow {
  // 系统字段
  openid: string;        // userid列：OpenID
  start_time?: string;   // 开始答题时间
  end_time?: string;     // 结束答题时间
  duration?: string;     // 答题时长

  // 问卷答案字段
  gender: string;         // 1.您的性别是？
  birth_year: string;     // 2.您的出生年份是？
  education: string;      // 3.您的最高学历(包括在读)是？
  industry: string;       // 4.您从事的行业是？:一级分类
  industrySub: string;    // 4.您从事的行业是？:二级分类
  occupation: string;     // 5.您目前的职业是？
  province: string;       // 6.您所在的地区是？:省
  city: string;           // 6.您所在的地区是？:市
  district: string;        // 6.您所在的地区是？:区
  income: string;          // 7.您的个人月收入（...）为？
  phone: string;           // 8.您的手机号是？
}

/**
 * 解析腾讯问卷Excel行为用户数据（中文列名版本）
 * 适配注册问卷字段结构 正式.csv
 */
export function parseTencentSurveyRow(row: Record<string, string>): Partial<TencentSurveyRow> {
  // 腾讯问卷导出格式（中文列名）：
  // 编号, 开始答题时间, 结束答题时间, 答题时长
  // 1.您的性别是？, 2.您的出生年份是？, 3.您的最高学历(包括在读)是？
  // 4.您从事的行业是？:一级分类, 4.您从事的行业是？:二级分类
  // 5.您目前的职业是？, 6.您所在的地区是？:省, 6.您所在的地区是？:市, 6.您所在的地区是？:区
  // 7.您的个人月收入（...）为？, 8.您的手机号是？
  // userid

  return {
    openid: row['userid'] || '',
    start_time: row['开始答题时间'],
    end_time: row['结束答题时间'],
    duration: row['答题时长'],
    gender: row['1.您的性别是？'] || '',
    birth_year: row['2.您的出生年份是？'] || '',
    education: row['3.到目前为止，您的最高学历(包括在读)是？'] || '',
    industry: row['4.您从事的行业是？:一级分类'] || '',
    industrySub: row['4.您从事的行业是？:二级分类'] || '',
    occupation: row['5.您目前的职业是？'] || '',
    province: row['6.您所在的地区是？:省'] || '',
    city: row['6.您所在的地区是？:市'] || '',
    district: row['6.您所在的地区是？:区'] || '',
    income: row['7.您的个人月收入（从各种途径得到的全部收入总和，包括零花钱）为？'] || '',
    phone: row['8.您的手机号是？'] || '',
  };
}

/**
 * 转换腾讯问卷行为UserProfile
 */
export function convertToUserProfile(
  row: Partial<TencentSurveyRow>,
  registeredAt?: string
): UserProfile | null {
  // 解析各字段
  const gender = parseGender(row.gender || '');
  const birthYear = parseBirthYear(row.birth_year || '');

  if (!gender || !birthYear) {
    console.log('[导入跳过] 缺少必需字段:', { gender, birthYear, openid: row.openid });
    return null; // 必需字段缺失
  }

  const profile: UserProfile = {
    openid: row.openid || `o${Math.random().toString(36).substring(2, 15)}`,
    gender,
    birth_year: birthYear,
    education: parseOptionValue(row.education || ''),
    province: row.province || '',
    city: row.city || '',
    district: row.district || '',
    occupation: parseOptionValue(row.occupation || ''),
    industry: parseOptionValue(row.industry || ''),
    industrySub: row.industrySub || '',
    income: parseOptionValue(row.income || ''),
    phone: row.phone || '',
    registered_at: row.start_time || registeredAt || new Date().toISOString(),
    last_synced_at: new Date().toISOString(),
  };

  return profile;
}

/**
 * 批量导入用户数据
 */
export function importUsersFromTencentSurvey(
  rows: Record<string, string>[]
): { success: UserProfile[]; failed: number } {
  const success: UserProfile[] = [];
  let failed = 0;

  for (const row of rows) {
    try {
      const parsed = parseTencentSurveyRow(row);
      const profile = convertToUserProfile(parsed);

      if (profile) {
        success.push(profile);
      } else {
        failed++;
      }
    } catch (error) {
      failed++;
    }
  }

  return { success, failed };
}

/**
 * 根据openids获取用户详情（包含派生字段）
 */
export function getUserDetailsWithDerived(
  openids: string[],
  userMap: Map<string, UserProfile>
): Array<UserProfile & { age: number; age_group: string; city_tier: string }> {
  const result = [];

  for (const openid of openids) {
    const profile = userMap.get(openid);
    if (profile) {
      const derived = calculateDerivedFields(profile);
      result.push({
        ...profile,
        ...derived,
      });
    }
  }

  return result;
}

/**
 * 获取有效用户（从后端API获取 - 关注公众号且完成注册的用户）
 */
export async function getValidUsers(): Promise<UserProfile[]> {
  const response = await userApi.list({ pageSize: 10000 });
  return response.data as UserProfile[];
}

/**
 * 获取待转化用户数（关注公众号但未完成注册的用户）
 */
export async function getPendingUsers(): Promise<number> {
  try {
    const response = await userApi.getPendingCount();
    return response.pending;
  } catch (error) {
    console.error('获取待转化用户数失败:', error);
    return 0;
  }
}

/**
 * 获取待转化用户 openid 列表（关注公众号但未完成注册）
 * 用于导出功能
 */
export async function getPendingUserList(): Promise<string[]> {
  try {
    const response = await userApi.getPendingList();
    return response.data || [];
  } catch (error) {
    console.error('获取待转化用户列表失败:', error);
    return [];
  }
}

/**
 * 获取用户统计数据
 */
export async function getUserStats(): Promise<{
  total: number;
  validUsers: number;
  pendingUsers: number;
  sentSamples: number;
  completedSamples: number;
}> {
  // 统一使用 /users/count 获取有效用户总数，避免 list 分页 10000 条限制
  const validUsersRes = await userApi.count();
  const validUsers = validUsersRes.count;
  const pendingUsers = await getPendingUsers();

  // 从后端获取成功发放人次
  let sentSamples = 0;
  try {
    const stats = await projectApi.getStatistics();
    sentSamples = stats.totalSentSamples || 0;
  } catch (error) {
    console.error('获取项目统计失败:', error);
  }

  return {
    total: validUsers + pendingUsers,
    validUsers: validUsers,
    pendingUsers: pendingUsers,
    sentSamples: sentSamples,
    completedSamples: 0,  // 已答题人数统计不了，设为0
  };
}

/**
 * 获取有效用户（带派生字段）
 */
export async function getValidUsersWithProfile(): Promise<Array<UserProfile & { age: number; age_group: string; city_tier: string }>> {
  const validUsers = await getValidUsers();
  return validUsers.map(user => ({
    ...user,
    ...calculateDerivedFields(user),
  }));
}

/**
 * 添加注册用户（mock实现 - 仅日志记录）
 */
export function addRegisteredUser(openid: string, registeredAt?: string): void {
  // mock环境下不需要实际存储，getValidUsers()从MOCK_USER_PROFILES获取
  console.log('[Mock] Registered user:', openid, 'at', registeredAt);
}
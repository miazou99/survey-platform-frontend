/**
 * 数据工具函数
 * 用于派生字段计算和数据清洗
 */

import { getCityTier } from '../data/cityTierMap';

/**
 * 计算年龄
 * @param birthYear 出生年份
 * @returns 年龄
 */
export function getAge(birthYear: number): number {
  const currentYear = new Date().getFullYear();
  return currentYear - birthYear;
}

/**
 * 根据出生年份计算年龄段
 * @param birthYear 出生年份
 * @returns 年龄段标签
 */
export function getAgeGroup(birthYear: number): string {
  const age = getAge(birthYear);

  if (age < 18) return 'under18';
  if (age <= 24) return '18-24';
  if (age <= 29) return '25-29';
  if (age <= 34) return '30-34';
  if (age <= 39) return '35-39';
  if (age <= 44) return '40-44';
  return '45+';
}

/**
 * 根据城市名获取城市级别
 * @param city 城市名
 * @returns 城市级别标签
 */
export function getCityTierLevel(city: string): string {
  return getCityTier(city);
}

/**
 * 解析腾讯问卷选项值
 * - 单选题/多选题：去除 "A. " "B. " 等前缀
 * - 下拉题/联动题：保持原样
 *
 * @param value 原始值
 * @returns 解析后的值
 */
export function parseOptionValue(value: string): string {
  if (!value) return '';

  // 匹配 A. B. C. ... Z. 格式的前缀
  if (/^[A-Z]\.\s?/.test(value)) {
    return value.replace(/^[A-Z]\.\s?/, '').trim();
  }

  return value.trim();
}

/**
 * 解析性别字段
 * @param value 原始值（如 "A.男" 或 "男"）
 * @returns '男' | '女'
 */
export function parseGender(value: string): '男' | '女' | null {
  const parsed = parseOptionValue(value);
  if (parsed === '男') return '男';
  if (parsed === '女') return '女';
  return null;
}

/**
 * 解析出生年份字段
 * @param value 原始值（如 "1995年" 或 "A.1995年"）
 * @returns 出生年份数字，如 1995
 */
export function parseBirthYear(value: string): number | null {
  const parsed = parseOptionValue(value);
  // 提取数字
  const match = parsed.match(/(\d{4})/);
  if (match) {
    return parseInt(match[1], 10);
  }
  // 处理 "1960年前" 这种格式
  if (parsed.includes('1960年前')) {
    return 1959;
  }
  return null;
}

/**
 * 判断是否为有效选项值（带选项前缀的格式）
 * @param value 原始值
 * @returns 是否为选项格式
 */
export function isOptionFormat(value: string): boolean {
  return /^[A-Z]\.\s?/.test(value || '');
}

/**
 * 用户画像数据类型
 */
export interface UserProfileData {
  gender: '男' | '女';
  birth_year: number;
  education: string;
  province: string;
  city: string;
  occupation: string;
  industry: string;
  income: string;
}

/**
 * 派生字段数据类型
 */
export interface DerivedFields {
  age: number;
  age_group: string;
  city_tier: string;
}

/**
 * 计算用户的派生字段
 * @param profile 用户原始数据（只需要 birth_year 和 city）
 * @returns 派生字段
 */
export function calculateDerivedFields(profile: { birth_year: number; city: string }): DerivedFields {
  const age = getAge(profile.birth_year);
  const age_group = getAgeGroup(profile.birth_year);
  const city_tier = getCityTierLevel(profile.city);

  return {
    age,
    age_group,
    city_tier,
  };
}

/**
 * 完整用户数据类型（包含原始字段和派生字段）
 */
export interface FullUserProfile extends UserProfileData {
  // 派生字段
  age: number;
  age_group: string;
  city_tier: string;
  // 元数据
  openid: string;
  registered_at: string;
  last_synced_at: string;
}

/**
 * 转换用户数据，添加派生字段
 * @param profile 用户原始数据
 * @returns 完整用户数据
 */
export function enrichUserProfile(
  profile: UserProfileData & { openid: string; registered_at: string; last_synced_at: string }
): FullUserProfile {
  const derived = calculateDerivedFields(profile);
  return {
    ...profile,
    ...derived,
  };
}
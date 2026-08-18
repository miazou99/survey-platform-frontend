/**
 * 分布对齐抽样算法（基于 Synthetic Panel 参考实现）
 *
 * 核心：Raking (IPF) + 批量交换优化
 * - Fisher-Yates 洗牌替代有偏 sort-random
 * - Raking 迭代比例拟合 → 加权无放回抽样
 * - 批量交换自适应粒度优化
 * - 1% 随机逃脱局部最优
 */

import { UserProfile } from '../types/types';
import { DIMENSIONS } from '../data/dimensions';
import { getAgeGroup, getCityTierLevel } from './dataUtils';

// ========== 类型 ==========

export interface QuotaTarget {
  dimension: string;
  tag: string;
  targetPercent: number;
  targetCount: number;
}

export interface SamplingResult {
  selectedUsers: UserProfile[];
  statistics: DimensionStatistic[];
  matchScore: number;
  iterations: number;
  replacedCount: number;
  actualSize: number;
  maxDeviation: number;
}

export interface DimensionStatistic {
  dimension: string;
  label: string;
  tags: TagStatistic[];
}

export interface TagStatistic {
  tag: string;
  tagLabel: string;
  targetCount: number;
  actualCount: number;
  targetPercent: number;
  actualPercent: number;
  deviation: number;
}

// ========== Fisher-Yates 洗牌 ==========

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function fisherYatesShuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ========== 标签工具 ==========

function getUserDimensionTags(user: UserProfile): Record<string, string> {
  const genderValue = user.gender === 'male' ? '男' : (user.gender === 'female' ? '女' : user.gender);
  return {
    gender: genderValue,
    age_group: getAgeGroup(user.birth_year),
    education: user.education,
    city_tier: getCityTierLevel(user.city),
    occupation: user.occupation,
    industry: user.industry,
    income: user.income,
  };
}

function getDimensionLabel(key: string): string {
  const dim = DIMENSIONS.find(d => d.key === key);
  return dim?.label || key;
}

function getTagLabel(dimKey: string, tagValue: string): string {
  const dim = DIMENSIONS.find(d => d.key === dimKey);
  if (!dim) return tagValue;
  if (dimKey === 'gender') {
    const n = tagValue === 'male' ? '男' : (tagValue === 'female' ? '女' : tagValue);
    return dim.tags.find(t => t.value === n)?.name || tagValue;
  }
  return dim.tags.find(t => t.value === tagValue)?.name || tagValue;
}

// ========== Raking (IPF) ==========

/**
 * 迭代比例拟合 — 给定样本和目标边际比例，计算每个样本的采样权重
 */
function rakingWeights(
  samples: Array<Record<string, string>>,
  dims: string[],
  targetProps: Record<string, Record<string, number>>,
  maxIter = 50,
  tol = 1e-6,
): number[] {
  const n = samples.length;
  const weights = new Array(n).fill(1.0);

  for (let iter = 0; iter < maxIter; iter++) {
    let maxDelta = 0;
    for (const dim of dims) {
      const totals: Record<string, number> = {};
      let totalW = 0;
      for (let i = 0; i < n; i++) {
        const key = samples[i][dim];
        const w = weights[i];
        totalW += w;
        totals[key] = (totals[key] || 0) + w;
      }
      if (totalW <= 0) continue;
      for (let i = 0; i < n; i++) {
        const key = samples[i][dim];
        const current = (totals[key] || 0) / totalW;
        const target = targetProps[dim]?.[key] || 0;
        if (current <= 0 || target <= 0) continue;
        const factor = target / current;
        weights[i] *= factor;
        maxDelta = Math.max(maxDelta, Math.abs(1 - factor));
      }
    }
    if (maxDelta < tol) break;
  }
  return weights;
}

// ========== 加权无放回抽样 ==========

function weightedSampleIndices(weights: number[], k: number): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || k <= 0) return [];

  const indices = Array.from({ length: weights.length }, (_, i) => i);
  const picked: number[] = [];
  let remainingTotal = total;

  for (let round = 0; round < Math.min(k, indices.length); round++) {
    if (remainingTotal <= 0) break;
    const r = Math.min(Math.random(), 0.999999);
    let cum = 0;
    for (let idx = 0; idx < indices.length; idx++) {
      const origIdx = indices[idx];
      if (origIdx < 0) continue;
      cum += weights[origIdx] / remainingTotal;
      if (r <= cum) {
        picked.push(origIdx);
        remainingTotal -= weights[origIdx];
        indices[idx] = -1;
        break;
      }
    }
    if (remainingTotal <= 0) break;
  }
  return picked;
}

// ========== 主算法 ==========

export function dynamicBalanceSampling(
  pool: UserProfile[],
  targets: QuotaTarget[],
  sampleSize: number,
  options: {
    maxIterations?: number;
    deviationThreshold?: number;
    minPerTag?: number;
  } = {},
): SamplingResult {
  if (pool.length === 0) throw new Error('样本库为空');
  if (!Number.isFinite(sampleSize) || sampleSize <= 0) throw new Error('抽样人数必须为正整数');

  // === 自适应参数（针对小池子 + 高抽样比调优） ===
  // 抽样比 = sampleSize / eligiblePool。真人项目通常 20-33%（抽 1000 出 3000-5000），
  // 与合成项目（1%）差异巨大，参数需要适配。
  const samplingRatio = sampleSize / pool.length; // 预估，精确值 filtered 后调整

  // buffer 倍数：高抽样比时用小倍数（留候选池），低抽样比时用大倍数（Raking 需要足够样本）
  const BUFFER_FACTOR = Math.max(1.5, Math.min(4.0, 150 / sampleSize));

  // 每轮交换人数：合成项目用 6%，真人用小粒度（2-3%）减少震荡
  const swapPct = samplingRatio > 0.15 ? 0.025 : (samplingRatio > 0.05 ? 0.04 : 0.06);
  const SWAP_N = Math.max(1, Math.min(8, Math.round(sampleSize * swapPct)));

  const MAX_ITER = options.maxIterations || 300;
  const MIN_ITER = 20;

  // 收敛目标：小池子高抽样比时大幅放宽（池子天然约束强，苛求 3-6% 无意义）
  // sampleSize=1000: 1-4/31.6=0.87 → floor 0.90=10%偏差
  // sampleSize=3000: 1-4/54.8=0.93 → 用 0.93=7%偏差（大样本可收紧）
  const MATCH_TARGET = Math.max(0.90, 1 - 4 / Math.sqrt(sampleSize));

  // 候选池评估样本数：合成项目硬编码 10000，真人用全部候选池
  const SWAP_SAMPLE = 999999; // 实际 = min(候选池长度, 此值)，在循环中取 min
  const SHUFFLE_PROB = 0.01;
  const minPerTag = options.minPerTag ?? 0;

  const dimensions = [...new Set(targets.map(t => t.dimension))];

  // 构建目标映射
  const targetCounts: Record<string, Record<string, number>> = {};
  const targetPercents: Record<string, Record<string, number>> = {};  // 原始百分比（避免小样本整数舍入误差）
  const targetProps: Record<string, Record<string, number>> = {};
  const targetMap = new Map<string, Map<string, QuotaTarget>>();

  for (const t of targets) {
    if (!targetCounts[t.dimension]) targetCounts[t.dimension] = {};
    targetCounts[t.dimension][t.tag] = t.targetCount;

    if (!targetPercents[t.dimension]) targetPercents[t.dimension] = {};
    targetPercents[t.dimension][t.tag] = t.targetPercent;

    if (!targetMap.has(t.dimension)) targetMap.set(t.dimension, new Map());
    targetMap.get(t.dimension)!.set(t.tag, t);
  }

  for (const dim of dimensions) {
    targetProps[dim] = {};
    const total = Object.values(targetCounts[dim]).reduce((a, b) => a + b, 0);
    for (const [tag, count] of Object.entries(targetCounts[dim])) {
      targetProps[dim][tag] = total > 0 ? count / total : 0;
    }
  }

  console.log(`[分布对齐抽样] 开始: 池=${pool.length}, 目标=${sampleSize}, 维度=${dimensions.join(',')}`);
  console.log(`[分布对齐抽样] targetCounts初始:`, JSON.stringify(targetCounts));
  console.log(`[分布对齐抽样] sampleSize初始:`, sampleSize);

  // Step 1: 预过滤 — 只保留在所有目标维度上符合配额的用户
  const eligibleUsers: Array<{ user: UserProfile; tags: Record<string, string> }> = [];
  for (const user of pool) {
    const tags = getUserDimensionTags(user);
    const eligible = dimensions.every(dim => {
      const t = targetCounts[dim];
      return t && (t[tags[dim]] ?? 0) > 0;
    });
    if (eligible) eligibleUsers.push({ user, tags });
  }

  console.log(`[分布对齐抽样] 预过滤: ${pool.length} → ${eligibleUsers.length}`);

  if (eligibleUsers.length < sampleSize) {
    throw new Error(`符合配额条件的用户不足：需要${sampleSize}人，仅${eligibleUsers.length}人`);
  }

  // Step 2: 随机抽取 buffer 池（自适应倍数）
  const bufferN = Math.max(sampleSize, Math.ceil(sampleSize * BUFFER_FACTOR));
  const buffer = fisherYatesShuffle(eligibleUsers).slice(0, Math.min(bufferN, eligibleUsers.length));

  // Step 3: Raking 权重 → 加权抽样
  const weights = rakingWeights(buffer.map(s => s.tags), dimensions, targetProps);
  const selectedIndices = weightedSampleIndices(weights, sampleSize);

  let selectedEntries = selectedIndices.map(i => buffer[i]);
  let selectedUserIds = new Set(selectedEntries.map(e => e.user.openid));

  // 候选池 = 全部符合条件的人 - 已选中的
  const candidatePool = eligibleUsers.filter(e => !selectedUserIds.has(e.user.openid));

  let totalReplaced = 0;
  let bestMaxDev = Infinity;
  let bestSelection: typeof selectedEntries = [...selectedEntries];
  let convergedIter = MAX_ITER;

  // Step 4-6: 批量交换优化
  for (let iter = 0; iter < MAX_ITER; iter++) {
    // 计算当前各标签计数
    const currentCounts: Record<string, Record<string, number>> = {};
    for (const dim of dimensions) {
      currentCounts[dim] = {};
      for (const tag of Object.keys(targetCounts[dim])) {
        currentCounts[dim][tag] = 0;
      }
    }
    for (const entry of selectedEntries) {
      for (const dim of dimensions) {
        const tag = entry.tags[dim];
        if (tag in currentCounts[dim]) currentCounts[dim][tag]++;
      }
    }

    // 偏差
    let currentMaxDev = 0;
    for (const dim of dimensions) {
      for (const [tag, target] of Object.entries(targetCounts[dim])) {
        if (target <= 0) continue;
        const actual = currentCounts[dim][tag] || 0;
        currentMaxDev = Math.max(currentMaxDev, Math.abs(actual / sampleSize - target / sampleSize));
      }
    }

    const matchScore = 1 - currentMaxDev;

    // 追踪最优解
    if (currentMaxDev < bestMaxDev) {
      bestMaxDev = currentMaxDev;
      bestSelection = [...selectedEntries];
    }

    // 早停
    if (matchScore >= MATCH_TARGET && iter >= MIN_ITER) {
      convergedIter = iter + 1;
      console.log(`[分布对齐抽样] 收敛 @ iter=${convergedIter}, match=${(matchScore * 100).toFixed(1)}%`);
      break;
    }

    // 计算标签得分（正=不足、负=超出）
    const dimWeights: Record<string, Record<string, number>> = {};
    for (const dim of dimensions) {
      dimWeights[dim] = {};
      for (const [tag, target] of Object.entries(targetCounts[dim])) {
        const current = currentCounts[dim][tag] || 0;
        dimWeights[dim][tag] = target <= 0 ? 0 : 1.0 - (current / target);
      }
    }

    // 选中样本按得分排序（低分优先淘汰）
    const scored = selectedEntries
      .map((entry, idx) => {
        let score = 0;
        for (const dim of dimensions) score += dimWeights[dim]?.[entry.tags[dim]] || 0;
        return { idx, entry, score };
      })
      .sort((a, b) => a.score - b.score);

    // 从候选池随机抽 SWAP_SAMPLE 人评估（高分优先选入）
    const candIndices = Array.from({ length: candidatePool.length }, (_, i) => i);
    fisherYatesShuffleInPlace(candIndices);
    const candSample = candIndices.slice(0, Math.min(SWAP_SAMPLE, candidatePool.length));

    const candScored = candSample
      .map(i => {
        let score = 0;
        for (const dim of dimensions) score += dimWeights[dim]?.[candidatePool[i].tags[dim]] || 0;
        return { poolIdx: i, score };
      })
      .sort((a, b) => b.score - a.score);

    // 批量交换
    const swapsThisRound = Math.min(SWAP_N, scored.length, candScored.length);
    totalReplaced += swapsThisRound;
    for (let j = 0; j < swapsThisRound; j++) {
      const outIdx = scored[j].idx;
      const inEntry = candScored[j];
      // 旧放回候选池，新取出
      candidatePool[inEntry.poolIdx] = selectedEntries[outIdx];
      selectedEntries[outIdx] = candidatePool[inEntry.poolIdx];
    }

    // 1% 随机洗牌
    if (Math.random() < SHUFFLE_PROB) {
      fisherYatesShuffleInPlace(selectedEntries);
    }

    // 更新 selectedUserIds 集合
    selectedUserIds = new Set(selectedEntries.map(e => e.user.openid));
  }

  // 跑满未早停 → 回退最优
  if (convergedIter === MAX_ITER) {
    console.log(`[分布对齐抽样] 跑满${MAX_ITER}轮, 回退最优 maxDev=${(bestMaxDev * 100).toFixed(1)}%`);
    selectedEntries = bestSelection;
    selectedUserIds = new Set(selectedEntries.map(e => e.user.openid));
  }

  // Step 7: minPerTag 保底
  if (minPerTag > 0) {
    selectedEntries = applyMinPerTag(
      selectedEntries, eligibleUsers, dimensions, targetCounts, minPerTag,
    );
  }

  // ========== 去重 + 统计 ==========
  const uniqueEntries = dedupByOpenid(selectedEntries);
  const finalUsers = uniqueEntries.map(e => e.user);

  console.log(`[分布对齐抽样] calculateStatistics前: targetCounts=`, JSON.stringify(targetCounts), `sampleSize=`, sampleSize, `uniqueEntries.length=`, uniqueEntries.length);

  const finalStats = calculateStatistics(uniqueEntries, dimensions, targetCounts, targetPercents, sampleSize);

  console.log(`[分布对齐抽样] 完成: ${finalUsers.length}人, 偏差=${finalStats.maxDeviation.toFixed(1)}%`);

  return {
    selectedUsers: finalUsers,
    statistics: finalStats.dimensions,
    matchScore: Math.max(0, 1 - finalStats.maxDeviation / 100),
    iterations: convergedIter,
    replacedCount: totalReplaced,
    actualSize: finalUsers.length,
    maxDeviation: Math.round(finalStats.maxDeviation * 100) / 100,
  };
}

// ========== minPerTag 保底 ==========

function applyMinPerTag(
  current: Array<{ user: UserProfile; tags: Record<string, string> }>,
  eligible: Array<{ user: UserProfile; tags: Record<string, string> }>,
  dimensions: string[],
  targetCounts: Record<string, Record<string, number>>,
  minPerTag: number,
): Array<{ user: UserProfile; tags: Record<string, string> }> {
  const pool = [...current];
  const usedIds = new Set(pool.map(e => e.user.openid));
  const remaining = eligible.filter(e => !usedIds.has(e.user.openid));

  for (const dim of dimensions) {
    const targets = targetCounts[dim];
    if (!targets) continue;

    for (const tag of Object.keys(targets)) {
      const curCount = pool.filter(e => e.tags[dim] === tag).length;
      if (curCount >= minPerTag) continue;

      const need = minPerTag - curCount;
      const candidates = fisherYatesShuffle(
        remaining.filter(e => e.tags[dim] === tag && !usedIds.has(e.user.openid)),
      );

      let added = 0;
      for (const c of candidates) {
        if (added >= need) break;
        pool.push(c);
        usedIds.add(c.user.openid);
        added++;
      }
    }
  }
  return pool;
}

// ========== 去重 ==========

function dedupByOpenid(
  entries: Array<{ user: UserProfile; tags: Record<string, string> }>,
): Array<{ user: UserProfile; tags: Record<string, string> }> {
  const seen = new Map<string, { user: UserProfile; tags: Record<string, string> }>();
  for (const e of entries) {
    if (e.user.openid && !seen.has(e.user.openid)) {
      seen.set(e.user.openid, e);
    }
  }
  return Array.from(seen.values());
}

// ========== 统计 ==========

function calculateStatistics(
  entries: Array<{ user: UserProfile; tags: Record<string, string> }>,
  dimensions: string[],
  targetCounts: Record<string, Record<string, number>>,
  targetPercents: Record<string, Record<string, number>>,
  sampleSize: number,
): { dimensions: DimensionStatistic[]; maxDeviation: number } {
  // 统计实际分布
  const actualCounts: Record<string, Record<string, number>> = {};
  for (const dim of dimensions) {
    actualCounts[dim] = {};
    for (const tag of Object.keys(targetCounts[dim])) {
      actualCounts[dim][tag] = 0;
    }
  }
  for (const entry of entries) {
    for (const dim of dimensions) {
      const tag = entry.tags[dim];
      if (actualCounts[dim][tag] !== undefined) {
        actualCounts[dim][tag]++;
      }
    }
  }

  // 计算偏差，构建统计
  let maxDeviation = 0;
  const dimensionsStats: DimensionStatistic[] = [];

  for (const dim of dimensions) {
    const tagStats: TagStatistic[] = [];
    for (const [tag, target] of Object.entries(targetCounts[dim])) {
      if (target <= 0) continue;
      const actual = actualCounts[dim][tag] || 0;
      const actualPercent = entries.length > 0
        ? Math.round((actual / entries.length) * 10000) / 100
        : 0;
      // 使用用户原始输入百分比（避免小样本整数舍入导致显示值 ≠ 原始值）
      const targetPercent = targetPercents[dim]?.[tag] ?? (
        sampleSize > 0 ? Math.round((target / sampleSize) * 10000) / 100 : 0
      );
      const deviation = Math.abs(actualPercent - targetPercent);

      maxDeviation = Math.max(maxDeviation, deviation);

      tagStats.push({
        tag,
        tagLabel: getTagLabel(dim, tag),
        targetCount: target,
        actualCount: actual,
        targetPercent,
        actualPercent,
        deviation: Math.round(deviation * 100) / 100,
      });
    }
    if (tagStats.length > 0) {
      dimensionsStats.push({ dimension: dim, label: getDimensionLabel(dim), tags: tagStats });
    }
  }

  return { dimensions: dimensionsStats, maxDeviation };
}

// ========== 辅助 ==========

export function buildQuotaTargets(
  quotas: { dimension: string; tag: string; targetCount: number; quota_percent: number }[],
  _totalSamples: number,
): QuotaTarget[] {
  return quotas.map(q => ({
    dimension: q.dimension,
    tag: q.tag,
    targetPercent: q.quota_percent,
    targetCount: q.targetCount,
  }));
}

/**
 * 腾讯问卷 Webhook 数据接收服务
 *
 * 注意：此文件为前端模拟版本
 * 实际 Webhook 接收需要部署到公网服务器（如腾讯云函数）
 *
 * 腾讯云函数部署模板请参考: /api/webhook-template/
 */

// Webhook 事件类型
export type WebhookEventType = 'answer.create' | 'answer.update' | 'answer.delete';

// Webhook 通用数据结构（来自腾讯问卷文档）
export interface TencentSurveyWebhookPayload {
  id: string;           // 事件唯一标识
  object: 'Answer';     // 对象类型
  action: WebhookEventType;  // 事件类型
  created_at: string;   // 推送时间 YYYY-MM-DD HH:mm:ss
  payload: {
    survey_id: string;      // 问卷ID
    answer_id: string;      // 答卷ID
    respondent_id: string;  // 回答者标识ID
    started_at: string;     // 开始答题时间
    ended_at: string;      // 提交时间
    duration: number;       // 答题时长（秒）
    ip: string;             // 用户IP地址
    answer: TencentSurveyAnswer[];
  };
}

// 答题详情
export interface TencentSurveyAnswer {
  type: 'radio' | 'checkbox' | 'text' | 'upload' | string;
  question_id?: string;
  options?: { id: string; checked: number; text: string }[];
  text?: string;
  files?: { name: string; url: string }[];
}

// 转换后的本地答题记录
export interface TransformedAnswerRecord {
  id: string;
  project_id: string;
  openid: string;
  answer_time: string;
  survey_id: string;
  answer_id: string;
  duration: number;
}

// 本地存储的答题记录
let localAnswerRecords: TransformedAnswerRecord[] = [];

// 事件监听器
type AnswerEventCallback = (record: TransformedAnswerRecord) => void;
const listeners: AnswerEventCallback[] = [];

/**
 * 处理收到的 Webhook 事件
 * 前端模拟版本，实际由云函数调用
 */
export function handleWebhookEvent(payload: TencentSurveyWebhookPayload): void {
  const { action, created_at, payload: data } = payload;

  // 只处理答卷提交事件
  if (action !== 'answer.create') {
    console.log('忽略非创建事件:', action);
    return;
  }

  const openid = data.respondent_id; // 腾讯问卷的 respondent_id 即为 openid
  const registeredAt = data.ended_at || created_at;

  // 转换数据
  const record: TransformedAnswerRecord = {
    id: `ans_${data.answer_id}_${Date.now()}`,
    project_id: extractProjectIdFromSurveyId(data.survey_id),
    openid,
    answer_time: registeredAt,
    survey_id: data.survey_id,
    answer_id: data.answer_id,
    duration: data.duration,
  };

  // 存储到本地
  localAnswerRecords.push(record);

  // 触发监听器
  listeners.forEach(callback => callback(record));

  // 更新用户服务中的注册状态
  // 注意：这里需要动态导入避免循环依赖
  import('./userService').then(({ addRegisteredUser }) => {
    addRegisteredUser(openid, registeredAt);
  }).catch(e => console.error('更新用户注册状态失败:', e));

  console.log('收到新答卷:', record);
}

/**
 * 从问卷链接中提取项目ID
 * 实际使用时需要根据实际情况调整
 */
function extractProjectIdFromSurveyId(surveyId: string): string {
  // 这里是示例逻辑，实际需要根据业务规则调整
  // 可以通过映射表或数据库查询
  return surveyId;
}

/**
 * 添加答卷事件监听器
 */
export function addAnswerListener(callback: AnswerEventCallback): () => void {
  listeners.push(callback);
  return () => {
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
}

/**
 * 获取指定项目的所有答题记录
 */
export function getAnswerRecordsByProject(projectId: string): TransformedAnswerRecord[] {
  return localAnswerRecords.filter(r => r.project_id === projectId);
}

/**
 * 获取所有答题记录
 */
export function getAllAnswerRecords(): TransformedAnswerRecord[] {
  return [...localAnswerRecords];
}

/**
 * 清除所有答题记录（仅用于测试）
 */
export function clearAnswerRecords(): void {
  localAnswerRecords = [];
}

/**
 * 模拟收到一个 Webhook 事件（仅用于测试）
 */
export function simulateWebhookEvent(event?: Partial<TencentSurveyWebhookPayload>): void {
  const defaultEvent: TencentSurveyWebhookPayload = {
    id: `evt_${Date.now()}`,
    object: 'Answer',
    action: 'answer.create',
    created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    payload: {
      survey_id: event?.payload?.survey_id || 'survey_001',
      answer_id: `answer_${Date.now()}`,
      respondent_id: `o${Math.random().toString(36).substring(2, 15)}`,
      started_at: new Date(Date.now() - 300000).toISOString().replace('T', ' ').slice(0, 19),
      ended_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      duration: 300,
      ip: '127.0.0.1',
      answer: [],
    },
  };

  const mergedEvent = {
    ...defaultEvent,
    ...event,
    payload: { ...defaultEvent.payload, ...event?.payload },
  };

  handleWebhookEvent(mergedEvent);
}

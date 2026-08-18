/**
 * 腾讯问卷 Webhook 接收云函数
 *
 * 部署说明：
 * 1. 将此文件部署到腾讯云函数 SCF
 * 2. 配置触发器为 API 网关触发器
 * 3. 将 API 网关的公网地址配置到腾讯问卷的 Webhook 设置中
 *
 * 腾讯云函数控制台: https://console.cloud.tencent.com/scf
 */

const https = require('https');

// 云函数入口
exports.main_handler = async (event, context) => {
  // 处理 CORS 预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: '',
    };
  }

  try {
    // 解析请求体
    const payload = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    console.log('收到腾讯问卷 Webhook:', JSON.stringify(payload, null, 2));

    // 验证请求来源（可选）
    // const sourceIp = event.headers['x-forwarded-for'] || event.headers['host'];
    // if (!isValidSource(sourceIp)) {
    //   return { statusCode: 403, body: 'Forbidden' };
    // }

    // 处理 Webhook 数据
    const result = await processWebhookData(payload);

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({ success: true, data: result }),
    };
  } catch (error) {
    console.error('处理 Webhook 失败:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};

// 处理 Webhook 数据
async function processWebhookData(payload) {
  const { action, created_at, payload: data } = payload;

  // 根据事件类型处理
  switch (action) {
    case 'answer.create':
      return await handleAnswerCreate(data, created_at);
    case 'answer.update':
      return await handleAnswerUpdate(data);
    case 'answer.delete':
      return await handleAnswerDelete(data);
    default:
      console.log('未知事件类型:', action);
      return { ignored: true, reason: 'unknown_action' };
  }
}

// 处理新答卷
async function handleAnswerCreate(data, created_at) {
  // TODO: 将数据存储到数据库
  // 示例：存入云数据库或调用后端 API

  const record = {
    answer_id: data.answer_id,
    survey_id: data.survey_id,
    respondent_id: data.respondent_id, // 即 openid
    started_at: data.started_at,
    ended_at: data.ended_at,
    duration: data.duration,
    received_at: created_at,
  };

  console.log('新答卷:', record);

  // 存储到数据库的逻辑
  // await saveToDatabase(record);

  return { saved: true, record };
}

// 处理答卷更新
async function handleAnswerUpdate(data) {
  // TODO: 更新数据库中的记录
  return { updated: true, answer_id: data.answer_id };
}

// 处理答卷删除
async function handleAnswerDelete(data) {
  // TODO: 从数据库删除记录
  return { deleted: true, answer_id: data.answer_id };
}

// CORS 头
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

// 验证请求来源（可选启用）
function isValidSource(ip) {
  // 腾讯问卷的官方 IP 列表
  // 参考: https://wj.qq.com/docs/v22.07/openapi/webhook/list_ip
  const validIps = [
    '127.0.0.1',
    // 添加腾讯问卷的实际 IP
  ];

  return validIps.includes(ip) || ip.startsWith('10.') || ip.startsWith('172.');
}

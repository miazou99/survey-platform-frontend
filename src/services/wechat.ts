import { WechatConfig } from '../types/types';

const WECHAT_API_BASE = 'https://api.weixin.qq.com';

export interface WechatTemplateMessage {
  touser: string;
  template_id: string;
  url?: string;
  data: {
    [key: string]: {
      value: string;
      color?: string;
    };
  };
}

export async function getAccessToken(appId: string, appSecret: string): Promise<string> {
  const url = `${WECHAT_API_BASE}/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.errcode) {
    throw new Error(`微信API错误: ${data.errmsg}`);
  }

  return data.access_token;
}

export async function sendTemplateMessage(
  accessToken: string,
  message: WechatTemplateMessage
): Promise<{ errcode: number; errmsg: string }> {
  const url = `${WECHAT_API_BASE}/cgi-bin/message/template/send?access_token=${accessToken}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  return response.json();
}

export function generateProjectCode(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');

  return `PRJ-${year}${month}${day}${hour}${minute}-${random}`;
}

export function buildRegisterUrl(baseUrl: string, openid: string): string {
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}userid=${openid}`;
}

export function buildSurveyUrl(baseUrl: string, openid: string): string {
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}userid=${openid}`;
}

export function parseWebhookData(data: any): {
  openid: string;
  gender: string;
  age: string;
  region: string;
  income: string;
} | null {
  try {
    const { answer } = data.payload || {};
    if (!answer || !Array.isArray(answer)) return null;

    let openid = '';
    let gender = '';
    let age = '';
    let region = '';
    let income = '';

    for (const page of answer) {
      const { questions } = page;
      if (!questions) continue;

      for (const q of questions) {
        if (q.type === 'blanks' && q.blanks) {
          for (const blank of q.blanks) {
            if (blank.id?.includes('openid')) openid = blank.value || '';
            if (blank.id?.includes('age')) age = blank.value || '';
            if (blank.id?.includes('region')) region = blank.value || '';
            if (blank.id?.includes('income')) income = blank.value || '';
          }
        }

        if (q.type === 'radio' && q.options) {
          const checked = q.options.find((o: any) => o.checked);
          if (checked) {
            if (q.id?.includes('gender')) {
              gender = checked.text === '男' ? 'male' : 'female';
            }
          }
        }
      }
    }

    return { openid, gender, age, region, income };
  } catch (error) {
    console.error('解析Webhook数据失败:', error);
    return null;
  }
}

/**
 * 获取微信公众号全量关注用户列表
 * 使用微信 API /cgi-bin/user/get 拉取所有用户的 openid
 * 注意：此接口有调用频率限制，建议每天调用一次即可
 */
export async function getFollowerList(accessToken: string): Promise<string[]> {
  const allOpenids: string[] = [];
  let nextOpenid = '';

  do {
    const url = `${WECHAT_API_BASE}/cgi-bin/user/get?access_token=${accessToken}&next_openid=${nextOpenid}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.errcode) {
      throw new Error(`获取关注用户列表失败: ${data.errmsg}`);
    }

    if (data.data?.openid) {
      allOpenids.push(...data.data.openid);
    }

    nextOpenid = data.next_openid || '';
  } while (nextOpenid);

  return allOpenids;
}

/**
 * 获取用户基本信息（包括关注状态）
 * 通过此接口可以获取用户的关注时间
 */
export async function getUserInfo(
  accessToken: string,
  openid: string
): Promise<{
  subscribe: number;  // 1=关注，0=未关注
  subscribe_time?: number;  // 关注时间戳
  openid: string;
} | null> {
  const url = `${WECHAT_API_BASE}/cgi-bin/user/info?access_token=${accessToken}&openid=${openid}&lang=zh_CN`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.errcode) {
    console.error('获取用户信息失败:', data.errmsg);
    return null;
  }

  return {
    subscribe: data.subscribe,
    subscribe_time: data.subscribe_time,
    openid: data.openid,
  };
}

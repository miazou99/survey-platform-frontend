import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Globe,
  MessageSquare,
  Wallet,
  Database,
  Shield,
  Webhook,
  CheckCircle,
  AlertTriangle,
  Info,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { projectApi } from '../../services/api';

interface ConfigStatus {
  deployment: { platform: string; label: string; advice: string };
  wechat: { configured: boolean; appId: string; advice: string };
  wechatPay: { configured: boolean; merchantId: string; advice: string };
  tencentSurvey: { configured: boolean; advice: string; note: string };
  database: { type: string; location: string; advice: string };
  system: { jwtConfigured: boolean; adminConfigured: boolean; advice: string };
  webhook: { url: string; advice: string };
}

interface ConfigCard {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  configured: boolean;
  detail: string;
  extra?: string;
  advice: string;
}

export default function Settings() {
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    projectApi.getConfigStatus().then(setConfig).catch((err) => {
      console.error('加载配置状态失败:', err);
      setError('加载失败，请确认后端已部署并重启');
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-3xl animate-fade-in flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-500">加载配置状态...</span>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="max-w-3xl animate-fade-in">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">安全配置</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error || '无法获取配置状态'}</span>
        </div>
      </div>
    );
  }

  // 构建卡片数据
  const cards: ConfigCard[] = [
    {
      key: 'deployment',
      title: '部署环境',
      subtitle: config.deployment.label,
      icon: Globe,
      color: 'blue',
      configured: true,
      detail: `当前部署平台：${config.deployment.label}`,
      advice: config.deployment.advice,
    },
    {
      key: 'wechat',
      title: '微信公众号',
      subtitle: '模板消息 · 用户授权',
      icon: MessageSquare,
      color: 'green',
      configured: config.wechat.configured,
      detail: config.wechat.configured
        ? `已配置 · AppID: ${config.wechat.appId}`
        : '未配置 AppID 或 AppSecret',
      advice: config.wechat.advice,
    },
    {
      key: 'wechatPay',
      title: '微信支付',
      subtitle: '红包转账',
      icon: Wallet,
      color: 'orange',
      configured: config.wechatPay.configured,
      detail: config.wechatPay.configured
        ? `已配置 · 商户号: ${config.wechatPay.merchantId}`
        : '未配置商户号或证书，红包功能不可用',
      advice: config.wechatPay.advice,
    },
    {
      key: 'tencentSurvey',
      title: '腾讯问卷',
      subtitle: '问卷对接',
      icon: Webhook,
      color: 'cyan',
      configured: config.tencentSurvey.configured,
      detail: config.tencentSurvey.configured
        ? '已配置 API Key'
        : `未配置 API Key${config.tencentSurvey.note ? `（${config.tencentSurvey.note}）` : ''}`,
      advice: config.tencentSurvey.advice,
    },
    {
      key: 'database',
      title: '数据库',
      subtitle: config.database.type,
      icon: Database,
      color: 'emerald',
      configured: true,
      detail: `${config.database.type} · ${config.database.location}`,
      advice: config.database.advice,
    },
    {
      key: 'system',
      title: '系统安全',
      subtitle: '认证与加密',
      icon: Shield,
      color: 'purple',
      configured: config.system.jwtConfigured && config.system.adminConfigured,
      detail: [
        config.system.jwtConfigured ? 'JWT 已配置' : 'JWT 未配置',
        config.system.adminConfigured ? '管理员 已配置' : '管理员 未配置',
      ].join(' · '),
      advice: config.system.advice,
    },
  ];

  return (
    <div className="max-w-3xl animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon className="w-6 h-6 text-gray-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">安全配置</h1>
          <p className="text-sm text-gray-500">当前配置概览，只读展示。修改配置请前往部署平台的环境变量管理。</p>
        </div>
      </div>

      {/* 模块状态卡片 */}
      <div className="space-y-4 mb-6">
        {cards.map((card) => (
          <div key={card.key} className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <div className="flex items-start gap-4">
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  card.configured
                    ? 'bg-green-100'
                    : card.key === 'deployment' || card.key === 'database'
                    ? 'bg-blue-100'
                    : 'bg-yellow-100'
                }`}
              >
                <card.icon
                  className={`w-5 h-5 ${
                    card.configured
                      ? 'text-green-600'
                      : card.key === 'deployment' || card.key === 'database'
                      ? 'text-blue-600'
                      : 'text-yellow-600'
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-gray-900">{card.title}</h3>
                  {card.configured ? (
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : card.key === 'deployment' || card.key === 'database' ? (
                    <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                  )}
                </div>
                <p className="text-sm text-gray-500">{card.subtitle}</p>
                <div className="mt-2">
                  <span
                    className={`inline-block text-sm px-2.5 py-1 rounded-md font-mono ${
                      card.configured
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : card.key === 'deployment' || card.key === 'database'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                    }`}
                  >
                    {card.detail}
                  </span>
                </div>
                {card.extra && (
                  <p className="text-xs text-gray-400 mt-1.5">{card.extra}</p>
                )}
                <div className="mt-3 flex items-start gap-1.5 text-xs text-gray-400">
                  <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>{card.advice}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Webhook 地址 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 mb-6">
        <h3 className="font-bold text-gray-900 mb-1">Webhook 回调地址</h3>
        <p className="text-sm text-gray-500 mb-3">{config.webhook.advice}</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 font-mono break-all">
            {config.webhook.url}
          </code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(config.webhook.url);
            }}
            className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 flex-shrink-0"
          >
            复制
          </button>
        </div>
      </div>

      {/* 各平台修改指引 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
        <h3 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
          <ExternalLink className="w-4 h-4" />
          如何修改配置
        </h3>
        {config.deployment.platform === 'zeabur' ? (
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>登录 <strong>Zeabur</strong>，进入项目面板</li>
            <li>点击「环境变量」标签页</li>
            <li>修改对应的变量值（如 WECHAT_APPID）</li>
            <li>修改后 Zeabur 会自动重新部署，约 1-2 分钟生效</li>
          </ol>
        ) : (
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>SSH 登录 <strong>腾讯云 Lighthouse</strong> 服务器</li>
            <li>编辑项目根目录的 <code>.env</code> 文件</li>
            <li>重启 Docker 容器：<code>docker-compose up -d</code></li>
          </ol>
        )}
      </div>
    </div>
  );
}

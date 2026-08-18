import { LucideIcon } from 'lucide-react';
import { FolderKanban, SearchX, WifiOff, FileQuestion } from 'lucide-react';

type EmptyStateVariant = 'empty' | 'no-results' | 'error' | 'not-found';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const variantConfig: Record<EmptyStateVariant, { icon: LucideIcon; defaultTitle: string; defaultDesc: string }> = {
  empty: {
    icon: FolderKanban,
    defaultTitle: '暂无数据',
    defaultDesc: '暂无任何内容',
  },
  'no-results': {
    icon: SearchX,
    defaultTitle: '没有符合条件的记录',
    defaultDesc: '尝试调整筛选条件',
  },
  error: {
    icon: WifiOff,
    defaultTitle: '加载失败',
    defaultDesc: '网络连接出现问题，请稍后重试',
  },
  'not-found': {
    icon: FileQuestion,
    defaultTitle: '页面不存在',
    defaultDesc: '您访问的页面可能已被删除或转移',
  },
};

export default function EmptyState({
  variant = 'empty',
  title,
  description,
  icon,
  action,
}: EmptyStateProps) {
  const config = variantConfig[variant];
  const Icon = icon || config.icon;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-700 mb-1">{title || config.defaultTitle}</h3>
      <p className="text-sm text-gray-400 text-center mb-4">{description || config.defaultDesc}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

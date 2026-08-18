import { LucideIcon } from 'lucide-react';
import { ProjectStatus } from '../../types/types';

interface StatusBadgeProps {
  status: ProjectStatus;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bgColor: string }> = {
  draft: { label: '草稿', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  pending: { label: '待发红包', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  pending_hongbao: { label: '待发红包', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  active: { label: '进行中', color: 'text-green-600', bgColor: 'bg-green-100' },
  in_progress: { label: '进行中', color: 'text-green-600', bgColor: 'bg-green-100' },
  paused: { label: '已暂停', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  completed: { label: '已完成', color: 'text-blue-600', bgColor: 'bg-blue-100' },
};

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`${padding} rounded-full font-bold ${config.bgColor} ${config.color}`}>
      {config.label}
    </span>
  );
}

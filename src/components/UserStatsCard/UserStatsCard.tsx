import { LucideIcon } from 'lucide-react';

interface UserStatsCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'orange' | 'purple';
  description: string;  // 指标说明
}

const colorMap = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
  green: { bg: 'bg-green-100', text: 'text-green-600' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
};

export default function UserStatsCard({
  label,
  value,
  icon: Icon,
  color,
  description,
}: UserStatsCardProps) {
  const colors = colorMap[color];

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 flex items-center gap-4">
      <div className={`h-12 w-12 rounded-full ${colors.bg} flex items-center justify-center`}>
        <Icon className={`w-6 h-6 ${colors.text}`} />
      </div>
      <div>
        <div className="text-sm text-gray-500">{label}</div>
        <div className={`text-2xl font-bold ${colors.text}`}>{value.toLocaleString()}</div>
        <div className="text-xs text-gray-400 mt-1">{description}</div>
      </div>
    </div>
  );
}
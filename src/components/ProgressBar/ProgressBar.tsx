interface ProgressBarProps {
  value: number; // 0-100
  color?: 'blue' | 'green' | 'orange' | 'gray';
  size?: 'sm' | 'md';
  showLabel?: boolean;
  label?: string;
}

const colorMap = {
  blue: 'bg-gradient-to-r from-blue-500 to-blue-600',
  green: 'bg-gradient-to-r from-green-400 to-green-500',
  orange: 'bg-gradient-to-r from-orange-400 to-orange-500',
  gray: 'bg-gray-300',
};

export default function ProgressBar({
  value,
  color = 'blue',
  size = 'md',
  showLabel = false,
  label,
}: ProgressBarProps) {
  const height = size === 'sm' ? 'h-1.5' : 'h-2';

  return (
    <div className="w-full">
      {showLabel && label && (
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-500">{label}</span>
          <span className="font-bold text-gray-900">{value}%</span>
        </div>
      )}
      <div className={`${height} bg-gray-100 rounded-full overflow-hidden`}>
        <div
          className={`h-full ${colorMap[color]} rounded-full transition-all`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

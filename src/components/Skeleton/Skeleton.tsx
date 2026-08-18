interface SkeletonProps {
  rows?: number;
  height?: 'sm' | 'md' | 'lg';
}

const heightMap = {
  sm: 'h-4',
  md: 'h-6',
  lg: 'h-10',
};

export default function Skeleton({ rows = 5, height = 'md' }: SkeletonProps) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <div className={`flex-1 ${heightMap[height]} bg-gray-200 rounded`} />
          {i === 0 && (
            <div className="w-24 h-6 bg-gray-200 rounded" />
          )}
        </div>
      ))}
    </div>
  );
}

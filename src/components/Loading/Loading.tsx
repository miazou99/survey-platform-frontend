import React from 'react';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
}

const sizeConfig = {
  sm: { dot: 'w-1.5 h-1.5', gap: 'gap-1', container: 'py-4' },
  md: { dot: 'w-2 h-2', gap: 'gap-1.5', container: 'py-8' },
  lg: { dot: 'w-3 h-3', gap: 'gap-2', container: 'py-12' },
};

export default function Loading({ size = 'md', text, fullScreen = false }: LoadingProps) {
  const { dot, gap, container } = sizeConfig[size];

  const content = (
    <div className={`flex flex-col items-center justify-center ${container}`}>
      <div className={`flex items-center ${gap}`}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className={`${dot} bg-blue-500 rounded-full animate-bounce`}
            style={{
              animationDelay: `${i * 0.15}s`,
              animationDuration: '0.6s',
            }}
          />
        ))}
      </div>
      {text && (
        <p className="mt-3 text-sm text-gray-500">{text}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
        {content}
      </div>
    );
  }

  return content;
}

// 骨架屏组件
interface SkeletonProps {
  className?: string;
  rows?: number;
}

export function Skeleton({ className = '', rows = 1 }: SkeletonProps) {
  // 确定性宽度序列，避免每次渲染闪烁
  const widths = [75, 60, 85, 70, 55, 90, 65, 80];
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-gray-200 rounded animate-pulse"
          style={{ width: `${widths[i % widths.length]}%` }}
        />
      ))}
    </div>
  );
}

// 卡片骨架屏
export function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-200 rounded-lg animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse" />
          <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded animate-pulse" />
        <div className="h-3 bg-gray-200 rounded w-4/5 animate-pulse" />
      </div>
    </div>
  );
}
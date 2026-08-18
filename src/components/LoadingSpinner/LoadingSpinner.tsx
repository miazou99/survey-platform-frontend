interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

const sizeMap = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

export default function LoadingSpinner({ size = 'md', text }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <div
        className={`${sizeMap[size]} border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin`}
      />
      {text && <p className="text-gray-500 text-sm">{text}</p>}
    </div>
  );
}

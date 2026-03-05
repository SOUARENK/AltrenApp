interface SkeletonLoaderProps {
  lines?: number;
  className?: string;
}

export function SkeletonLoader({ lines = 3, className = '' }: SkeletonLoaderProps) {
  return (
    <div className={`animate-pulse space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 rounded"
          style={{
            backgroundColor: '#1f1f1f',
            width: i === lines - 1 ? '60%' : '100%',
          }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-xl p-4 animate-pulse ${className}`}
      style={{ backgroundColor: '#141414', border: '1px solid #1f1f1f' }}
    >
      <div className="h-4 rounded mb-3" style={{ backgroundColor: '#1f1f1f', width: '40%' }} />
      <SkeletonLoader lines={3} />
    </div>
  );
}

/** Animated skeleton placeholders shown during loading states. */

interface SkeletonProps {
  className?: string;
}

/** A single pulsing skeleton bar. */
export function SkeletonBar({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-zinc-700 rounded ${className}`}
    />
  );
}

/** Skeleton for room list sidebar items. */
export function RoomListSkeleton() {
  return (
    <div className="space-y-2 p-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-2 p-2">
          <SkeletonBar className="w-8 h-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1">
            <SkeletonBar className="h-4 w-3/4" />
            <SkeletonBar className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton for chat timeline messages. */
export function ChatSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className={`flex gap-3 ${i % 3 === 0 ? 'flex-row-reverse' : ''}`}>
          <SkeletonBar className="w-8 h-8 rounded-full shrink-0" />
          <div className="space-y-1 max-w-[60%]">
            <SkeletonBar className="h-3 w-20" />
            <SkeletonBar className={`h-12 ${i % 2 === 0 ? 'w-48' : 'w-72'}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton for member panel. */
export function MemberSkeleton() {
  return (
    <div className="space-y-2 p-2">
      <SkeletonBar className="h-4 w-20 mb-3" />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center gap-2 p-1">
          <SkeletonBar className="w-6 h-6 rounded-full shrink-0" />
          <SkeletonBar className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for the agent grid (3-column card layout). */
export function AgentGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <SkeletonBar className="w-8 h-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1">
              <SkeletonBar className="h-4 w-3/4" />
              <SkeletonBar className="h-3 w-1/2" />
            </div>
          </div>
          <SkeletonBar className="h-3 w-full" />
          <SkeletonBar className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

/** Same box model as MarketCard so the grid does not jump when data arrives. */
export function MarketCardSkeleton() {
  return (
    <div className="flex h-full flex-col rounded-md border border-line bg-night-900 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-14" />
      </div>
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-2/3" />
      <div className="mt-6 flex items-end justify-between">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-10 w-2/5" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
      </div>
      <Skeleton className="mt-4 h-3 w-full" />
    </div>
  );
}

export function MarketGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <MarketCardSkeleton key={i} />
      ))}
    </div>
  );
}

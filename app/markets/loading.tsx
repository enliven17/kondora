import { MarketGridSkeleton } from "@/components/markets/market-card-skeleton";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

export default function MarketsLoading() {
  return (
    <LoadingRegion label="Loading markets" className="page-x mx-auto max-w-page pt-[calc(var(--header-h)+2.5rem)]">
      <div className="flex flex-col gap-6 pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-4 h-14 w-72 max-w-full sm:h-20 sm:w-[28rem]" />
        </div>
        <div className="flex gap-10">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
      <div className="border-b border-line/70 py-3">
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-20 shrink-0" />
          ))}
        </div>
        <Skeleton className="mt-3 h-10 w-full" />
      </div>
      <Skeleton className="mb-4 mt-6 h-3 w-24" />
      <MarketGridSkeleton />
    </LoadingRegion>
  );
}

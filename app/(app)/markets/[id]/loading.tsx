import { Panel } from "@/components/ui/panel";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

export default function MarketLoading() {
  return (
    <LoadingRegion label="Loading market" className="grid grid-cols-1 gap-4 pb-20 lg:grid-cols-[minmax(0,1fr)_24rem] lg:pb-0">
      <div className="min-w-0 space-y-4">
        <Panel className="p-4 sm:p-5">
          <Skeleton className="h-3 w-28" />
          <div className="mt-3 flex gap-3 sm:gap-4">
            <Skeleton className="size-14 shrink-0 rounded-lg sm:size-20" />
            <div className="flex-1 space-y-2.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-11/12" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line/10 pt-4 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-11 w-36" />
            </div>
            <Skeleton className="h-8 w-56" />
          </div>
          <Skeleton className="mt-4 h-60 w-full sm:h-80" />
        </Panel>
      </div>
      <Panel className="overflow-hidden">
        <div className="border-b border-line/10 px-4 py-4 sm:px-5">
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-5 p-4 sm:p-5">
          <Skeleton className="h-[3.25rem] w-full" />
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-5 gap-1">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-14 w-full" />
        </div>
      </Panel>
    </LoadingRegion>
  );
}

import { Panel } from "@/components/ui/panel";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

function RowSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-3 py-3.5 sm:flex-nowrap sm:px-5">
      <div className="flex basis-full items-center gap-3 sm:flex-1 sm:basis-auto">
        <Skeleton className="size-12 shrink-0 rounded-md sm:size-14" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      </div>
      <Skeleton className="h-7 w-20 sm:w-24" />
      <div className="ml-auto flex gap-1.5 sm:ml-0">
        <Skeleton className="h-9 w-[4.25rem]" />
        <Skeleton className="h-9 w-[4.25rem]" />
      </div>
    </div>
  );
}

export default function MarketsLoading() {
  return (
    <LoadingRegion label="Loading markets" className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_23rem]">
      <div className="min-w-0 space-y-4">
        <Panel className="flex min-h-[13rem] flex-col justify-end p-5 sm:min-h-[15.5rem] sm:p-8">
          <Skeleton className="h-10 w-3/4 max-w-sm sm:h-14" />
          <Skeleton className="mt-4 h-4 w-full max-w-md" />
        </Panel>
        <Panel className="overflow-hidden">
          <div className="flex h-9 items-center justify-between bg-blush/30 px-3 sm:px-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex items-center justify-between border-b border-line/10 px-3 py-2.5 sm:px-5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-40" />
          </div>
          <div className="divide-y divide-line/[0.07]">
            {Array.from({ length: 7 }, (_, i) => (
              <RowSkeleton key={i} />
            ))}
          </div>
        </Panel>
      </div>
      <Panel className="hidden overflow-hidden xl:block">
        <div className="border-b border-line/10 px-4 py-4">
          <Skeleton className="h-4 w-28" />
        </div>
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="size-10 shrink-0 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </Panel>
    </LoadingRegion>
  );
}

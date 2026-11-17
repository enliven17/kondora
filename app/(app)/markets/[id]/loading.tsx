import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

export default function MarketLoading() {
  return (
    <LoadingRegion label="Loading market">
      <div className="border-b border-line">
        <div className="page-x mx-auto max-w-page pb-10 pt-[calc(var(--header-h)+2rem)]">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-5 h-9 w-full max-w-3xl" />
          <Skeleton className="mt-3 h-9 w-2/3 max-w-xl" />
          <Skeleton className="mt-4 h-4 w-80 max-w-full" />
          <div className="mt-6 flex flex-wrap gap-10">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-20" />
            ))}
          </div>
        </div>
      </div>
      <div className="page-x mx-auto grid max-w-page grid-cols-1 gap-10 pt-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-12">
        <div className="min-w-0 space-y-10">
          <div className="rounded-md border border-line bg-night-900/70 p-4 sm:p-5">
            <div className="flex flex-wrap justify-between gap-4">
              <Skeleton className="h-12 w-40" />
              <Skeleton className="h-8 w-56 max-w-full" />
            </div>
            <Skeleton className="mt-4 h-64 w-full sm:h-80" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-5 rounded-md border border-line bg-night-900 p-5">
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="mx-auto h-40 w-full max-w-[340px]" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </LoadingRegion>
  );
}

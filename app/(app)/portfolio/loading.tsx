import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

export default function PortfolioLoading() {
  return (
    <LoadingRegion label="Loading portfolio" className="page-x mx-auto max-w-page pt-[calc(var(--header-h)+2.5rem)]">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-4 h-14 w-80 max-w-full sm:h-20" />
      <Skeleton className="mt-4 h-4 w-96 max-w-full" />
      <div className="mb-8 mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <div className="overflow-hidden rounded-md border border-line">
        <Skeleton className="h-11 w-full rounded-none" />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-t border-line/60 px-4 py-4">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-4 w-16 sm:block" />
            <Skeleton className="hidden h-4 w-16 sm:block" />
            <Skeleton className="h-2 w-20" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

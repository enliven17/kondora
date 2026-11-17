import { Panel } from "@/components/ui/panel";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

export default function PortfolioLoading() {
  return (
    <LoadingRegion label="Loading portfolio" className="mx-auto max-w-6xl space-y-4">
      <Panel className="p-4 sm:p-5">
        <Skeleton className="h-4 w-20" />
        <div className="mt-2 grid grid-cols-1 gap-4 py-4 xs:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-8 w-32 max-w-full" />
            </div>
          ))}
        </div>
      </Panel>
      <Panel className="overflow-hidden">
        <div className="border-b border-line/10 px-5 py-4">
          <Skeleton className="h-4 w-20" />
        </div>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-line/[0.07] px-4 py-4 sm:px-5">
            <Skeleton className="size-10 shrink-0 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="hidden h-9 w-20 sm:block" />
          </div>
        ))}
      </Panel>
      <Panel className="overflow-hidden">
        <div className="border-b border-line/10 px-5 py-4">
          <Skeleton className="h-4 w-16" />
        </div>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <Skeleton className="size-9 shrink-0 rounded-md" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </Panel>
    </LoadingRegion>
  );
}

import Link from "next/link";

import { KondoraMark, KondoraWordmark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/** App header logo: split coin mark plus the Satoshi wordmark from components/brand. */
export function AppLogo({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="Kondora home" className={cn("inline-flex items-center gap-2 text-fg", className)}>
      <KondoraMark title="" className="size-7 text-petal" />
      <KondoraWordmark title="" className="h-[18px]" />
    </Link>
  );
}

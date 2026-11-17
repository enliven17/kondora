import { KondoraMark } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="page-x mx-auto flex min-h-[80vh] max-w-page flex-col items-center justify-center pt-[var(--header-h)] text-center">
      <KondoraMark className="h-14 w-14 text-muted" title="" aria-hidden />
      <p className="micro mt-8">404</p>
      <h1 className="mt-3 font-bold tracking-tight text-display-sm text-fg">This page is not here.</h1>
      <p className="mt-3 max-w-sm text-muted">The market may have closed or the link is wrong.</p>
      <ButtonLink href="/markets" className="mt-8">
        Browse markets
      </ButtonLink>
    </div>
  );
}

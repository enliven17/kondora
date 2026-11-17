/** Top banner card on /markets. Art layered over a gradient so it never renders broken. */
export function MarketsBanner() {
  return (
    <section
      aria-labelledby="banner-title"
      className="relative isolate overflow-hidden rounded-xl border border-line/10 bg-plum"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('/art/app-bg.webp'), radial-gradient(55% 80% at 85% 20%, rgb(var(--petal) / 0.9) 0%, transparent 70%), radial-gradient(50% 70% at 60% 100%, rgb(var(--petal-hot) / 0.6) 0%, transparent 70%), linear-gradient(120deg, rgb(var(--mauve)) 0%, rgb(var(--blush)) 100%)",
        }}
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-plum/85 via-plum/45 to-transparent" />
      <div className="flex min-h-[13rem] flex-col justify-end p-5 sm:min-h-[15.5rem] sm:p-8">
        <h1 id="banner-title" className="max-w-[12ch] text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[0.95] tracking-[-0.04em] text-fg">
          Every outcome has a price
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-fg/85">
          Take YES or NO on live markets with up to 5x leverage. Agents open and settle every one, and bets fill instantly.
        </p>
      </div>
    </section>
  );
}

/**
 * Search skeleton. Mirrors the real layout - filter rail plus result rows -
 * so the page does not jump when content arrives. No artificial delay is
 * added anywhere to make this visible.
 */
export default function SearchLoading() {
  return (
    <div className="bg-white" aria-busy="true">
      <div className="border-b border-line">
        <div className="shell flex items-center justify-between py-3">
          <div className="h-4 w-56 animate-pulse rounded bg-[#e3e6e6]" />
          <div className="h-[33px] w-40 animate-pulse rounded-[8px] bg-[#e3e6e6]" />
        </div>
      </div>

      <div className="shell flex flex-col gap-4 lg:flex-row lg:gap-8">
        <div className="hidden w-[240px] shrink-0 space-y-6 py-4 lg:block">
          {[0, 1, 2].map((g) => (
            <div key={g}>
              <div className="h-4 w-28 animate-pulse rounded bg-[#e3e6e6]" />
              <div className="mt-3 space-y-2">
                {[0, 1, 2, 3].map((r) => (
                  <div key={r} className="h-3 w-full animate-pulse rounded bg-[#eff1f1]" />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1 py-4">
          <div className="h-6 w-32 animate-pulse rounded bg-[#e3e6e6]" />
          <div className="mt-4 divide-y divide-line-soft">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 py-5">
                <div className="h-[128px] w-[128px] shrink-0 animate-pulse rounded bg-[#eff1f1] sm:h-[232px] sm:w-[232px]" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-5 w-4/5 animate-pulse rounded bg-[#e3e6e6]" />
                  <div className="h-5 w-3/5 animate-pulse rounded bg-[#e3e6e6]" />
                  <div className="h-4 w-32 animate-pulse rounded bg-[#eff1f1]" />
                  <div className="h-7 w-28 animate-pulse rounded bg-[#e3e6e6]" />
                  <div className="h-4 w-44 animate-pulse rounded bg-[#eff1f1]" />
                  <div className="h-7 w-[180px] animate-pulse rounded-full bg-[#eff1f1]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

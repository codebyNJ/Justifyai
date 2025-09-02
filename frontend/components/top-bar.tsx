"use client"

import LeftMenu from "@/components/left-menu"
import AuthButton from "@/components/auth-button"

export default function TopBar() {
  const openLeftMenu = (section?: "history" | "account") => {
    try {
      const trigger =
        (document.querySelector("[data-left-menu-trigger]") as HTMLElement | null) ||
        (document.querySelector('button[aria-label="Menu"]') as HTMLElement | null) ||
        (document.querySelector("[data-menu-trigger]") as HTMLElement | null)

      if (section) {
        // Persist a preferred section for the menu to optionally use.
        // LeftMenu can read this key if implemented; harmless otherwise.
        sessionStorage.setItem("leftMenuDefaultSection", section)
      }
      trigger?.click()
    } catch {}
  }

  return (
    <header className="pointer-events-none fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full flex justify-center">
      <div className="pointer-events-auto mx-auto w-full max-w-5xl sm:max-w-6xl lg:max-w-7xl xl:max-w-[92rem] px-3 sm:px-4 md:px-6 h-12 md:h-14 rounded-full border border-white/10 bg-black/70 backdrop-blur supports-[backdrop-filter]:bg-black/50 text-white shadow-lg shadow-black/30 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="sr-only">
            <LeftMenu />
          </div>

          <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => openLeftMenu("history")}
              className="px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium text-white/85 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 transition-colors"
            >
              Chat History
            </button>
            <button
              type="button"
              onClick={() => openLeftMenu("account")}
              className="px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium text-white/85 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 transition-colors"
            >
              Account Details
            </button>
          </nav>
        </div>

        {/* Brand uses site fonts; Doto for brand wordmark via CSS var */}
        <div
          className="text-sm md:text-base font-medium tracking-wide text-center"
          style={{ fontFamily: "var(--font-doto), var(--font-sans)" }}
        >
          Justify AI
        </div>

        <div className="flex items-center gap-2">
          <AuthButton />
        </div>
      </div>
    </header>
  )
}

export { TopBar }

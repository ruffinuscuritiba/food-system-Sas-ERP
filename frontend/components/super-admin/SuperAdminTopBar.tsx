"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft, LayoutDashboard } from "lucide-react"
import { ReactNode } from "react"

interface Props {
  /** Back destination — defaults to /super-admin/dashboard */
  backHref?: string
  /** Label next to the back arrow — defaults to "Painel" */
  backLabel?: string
  /** Optional right-side actions (buttons, etc.) */
  actions?: ReactNode
}

/**
 * Consistent sticky top bar for every super-admin sub-page.
 * Always appears at the same position, same height, same style.
 */
export function SuperAdminTopBar({
  backHref = "/super-admin/dashboard",
  backLabel = "Painel",
  actions,
}: Props) {
  const router = useRouter()

  return (
    <div className="sticky top-0 z-40 flex items-center justify-between gap-4 bg-[#09090b]/95 backdrop-blur border-b border-[#27272a] px-5 py-2.5">
      {/* Back button */}
      <button
        onClick={() => router.push(backHref)}
        className="
          flex items-center gap-1.5 text-xs font-semibold text-zinc-400
          px-3 py-1.5 rounded-lg border border-transparent
          transition-all duration-150
          hover:text-white hover:bg-[#27272a] hover:border-[#3f3f46] hover:scale-[1.03]
          active:scale-[0.97]
        "
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <LayoutDashboard className="w-3 h-3 opacity-60" />
        {backLabel}
      </button>

      {/* Right-side actions */}
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}

/** Preset hover class to apply uniformly to SA action buttons */
export const saBtn =
  "transition-all duration-150 hover:scale-[1.03] hover:brightness-110 active:scale-[0.97]"

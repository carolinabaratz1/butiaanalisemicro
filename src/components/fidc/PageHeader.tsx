import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="hairline-b px-6 py-4 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight leading-none">{title}</h1>
        {subtitle && <div className="mt-1.5 text-[12px] text-muted-foreground">{subtitle}</div>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

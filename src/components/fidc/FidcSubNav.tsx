import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/fidc-monitor", label: "Dashboard Carteiras", end: true },
  { to: "/fidc-monitor/monitor", label: "Monitor por Carteira" },
  { to: "/fidc-monitor/fidcs", label: "FIDCs" },
  { to: "/fidc-monitor/cadastro", label: "Cadastro Mestre" },
  { to: "/fidc-monitor/pareceres", label: "Pareceres" },
  { to: "/fidc-monitor/alertas", label: "Alertas" },
  { to: "/fidc-monitor/alertas-engine", label: "Alertas Engine" },
];

export function FidcSubNav() {
  return (
    <nav className="border-b border-border bg-background px-6">
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              cn(
                "px-3 py-2.5 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function FidcLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <FidcSubNav />
      <div className="flex-1 min-h-0 overflow-auto">{children}</div>
    </div>
  );
}

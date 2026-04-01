import React from "react";
import logoImg from "@/assets/logo-butia.png";

interface ButiaLogoProps {
  variant?: "full" | "icon" | "text";
  theme?: "dark" | "light";
  className?: string;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: { icon: 28, textMain: 13, textSub: 8 },
  md: { icon: 40, textMain: 18, textSub: 11 },
  lg: { icon: 56, textMain: 24, textSub: 15 },
};

export const ButiaLogo: React.FC<ButiaLogoProps> = ({
  variant = "full",
  theme = "dark",
  className = "",
  size = "md",
}) => {
  const color = theme === "dark" ? "#FFFFFF" : "#1B3864";
  const s = SIZES[size];

  const IconImg = (
    <img
      src={logoImg}
      alt="Butiá Investimentos"
      style={{ width: s.icon, height: s.icon }}
      className="object-contain"
    />
  );

  if (variant === "icon") return <div className={className}>{IconImg}</div>;

  if (variant === "text") {
    return (
      <div className={`flex flex-col leading-none ${className}`}>
        <span
          style={{ fontSize: s.textMain, color, fontWeight: 700, letterSpacing: "0.08em" }}
          className="font-sans uppercase"
        >
          BUTIÁ
        </span>
        <span
          style={{ fontSize: s.textSub, color, fontWeight: 400, letterSpacing: "0.12em", opacity: 0.85 }}
          className="font-sans uppercase"
        >
          INVESTIMENTOS
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {IconImg}
      <div className="flex flex-col leading-none">
        <span
          style={{ fontSize: s.textMain, color, fontWeight: 700, letterSpacing: "0.08em" }}
          className="font-sans uppercase"
        >
          BUTIÁ
        </span>
        <span
          style={{ fontSize: s.textSub, color, fontWeight: 400, letterSpacing: "0.12em", opacity: 0.85 }}
          className="font-sans uppercase"
        >
          INVESTIMENTOS
        </span>
      </div>
    </div>
  );
};

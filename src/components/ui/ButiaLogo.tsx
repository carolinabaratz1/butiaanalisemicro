import React from "react";
import logoWhite from "@/assets/logo-butia-horizontal.png";

interface ButiaLogoProps {
  variant?: "full" | "icon" | "text";
  theme?: "dark" | "light";
  className?: string;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: { height: 32 },
  md: { height: 48 },
  lg: { height: 64 },
};

export const ButiaLogo: React.FC<ButiaLogoProps> = ({
  variant = "full",
  theme = "dark",
  className = "",
  size = "md",
}) => {
  const s = SIZES[size];
  const filterStyle: React.CSSProperties =
    theme === "light"
      ? {
          filter:
            "brightness(0) saturate(100%) invert(15%) sepia(50%) saturate(1800%) hue-rotate(196deg) brightness(95%) contrast(95%)",
        }
      : {};

  return (
    <div className={className}>
      <img
        src={logoWhite}
        alt="Butiá Investimentos"
        style={{ height: s.height, width: "auto", ...filterStyle }}
        draggable={false}
      />
    </div>
  );
};

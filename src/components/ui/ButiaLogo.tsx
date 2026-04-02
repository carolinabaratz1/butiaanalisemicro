import React from "react";

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

const PalmSvg: React.FC<{ size: number; fill: string }> = ({ size, fill }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Stylized butiá palm tree */}
    <path
      d="M50 95 C50 95 46 70 48 55 C49 47 50 42 50 42 C50 42 51 47 52 55 C54 70 50 95 50 95Z"
      fill={fill}
    />
    <path
      d="M50 42 C50 42 42 35 30 32 C22 30 12 31 12 31 C12 31 20 26 32 25 C42 24 50 28 50 28Z"
      fill={fill}
    />
    <path
      d="M50 42 C50 42 58 35 70 32 C78 30 88 31 88 31 C88 31 80 26 68 25 C58 24 50 28 50 28Z"
      fill={fill}
    />
    <path
      d="M50 28 C50 28 44 22 36 16 C30 12 22 10 22 10 C22 10 30 10 40 14 C48 17 50 24 50 24Z"
      fill={fill}
    />
    <path
      d="M50 28 C50 28 56 22 64 16 C70 12 78 10 78 10 C78 10 70 10 60 14 C52 17 50 24 50 24Z"
      fill={fill}
    />
    <path
      d="M50 24 C50 24 48 16 50 8 C51 4 54 2 54 2 C54 2 52 6 51 12 C50 18 50 24 50 24Z"
      fill={fill}
    />
    <path
      d="M50 24 C50 24 46 18 42 12 C39 8 34 5 34 5 C34 5 38 7 43 12 C47 16 50 24 50 24Z"
      fill={fill}
    />
    {/* Curved trunk */}
    <path
      d="M47 42 C45 55 42 70 44 85 C44.5 89 46 93 50 95 C54 93 55.5 89 56 85 C58 70 55 55 53 42 C52 38 51 36 50 35 C49 36 48 38 47 42Z"
      fill={fill}
      opacity="0.9"
    />
  </svg>
);

export const ButiaLogo: React.FC<ButiaLogoProps> = ({
  variant = "full",
  theme = "dark",
  className = "",
  size = "md",
}) => {
  const color = theme === "dark" ? "#FFFFFF" : "#1B3864";
  const s = SIZES[size];

  if (variant === "icon")
    return (
      <div className={className}>
        <PalmSvg size={s.icon} fill={color} />
      </div>
    );

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
      <PalmSvg size={s.icon} fill={color} />
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

// src/components/ui/PrimaryButton.tsx
"use client";

import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  onClick: () => void;
  variant?: "primary" | "danger";
};

export default function PrimaryButton({
  children,
  onClick,
  variant = "primary",
}: Props) {
  const base =
    "px-6 py-3 rounded-xl font-semibold text-white transition active:scale-95";

  const styles = {
    primary: "bg-blue-600 hover:bg-blue-700",
    danger: "bg-red-500 hover:bg-red-600",
  };

  return (
    <button onClick={onClick} className={`${base} ${styles[variant]}`}>
      {children}
    </button>
  );
}

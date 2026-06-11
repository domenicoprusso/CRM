"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-9 w-9" />;

  const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const label = theme === "light" ? "Passa a scuro" : theme === "dark" ? "Usa sistema" : "Passa a chiaro";

  return (
    <button
      onClick={() => setTheme(next)}
      title={label}
      aria-label={label}
      className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:border-brand-200 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-brand-500 dark:hover:text-brand-400"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

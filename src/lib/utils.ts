import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "এইমাত্র";
  if (diffMin < 60) return `${diffMin} মিনিট আগে`;
  if (diffHr < 24) return `${diffHr} ঘণ্টা আগে`;
  if (diffDay < 7) return `${diffDay} দিন আগে`;
  return d.toLocaleDateString("bn-BD");
}

export function getPlatformColor(platform: string): string {
  const colors: Record<string, string> = {
    FACEBOOK: "var(--color-facebook)",
    MESSENGER: "var(--color-messenger)",
    WHATSAPP: "var(--color-whatsapp)",
    TELEGRAM: "var(--color-telegram)",
  };
  return colors[platform] ?? "#888";
}

export function getPlatformLabel(platform: string): string {
  const labels: Record<string, string> = {
    FACEBOOK: "Facebook",
    MESSENGER: "Messenger",
    WHATSAPP: "WhatsApp",
    TELEGRAM: "Telegram",
  };
  return labels[platform] ?? platform;
}

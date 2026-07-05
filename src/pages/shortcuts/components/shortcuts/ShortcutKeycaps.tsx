import { cn } from "@/lib/utils";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CommandIcon,
  CornerDownLeftIcon,
  type LucideIcon,
} from "lucide-react";

const KEY_LABELS: Record<string, string> = {
  ctrl: "Ctrl",
  control: "Ctrl",
  cmd: "Cmd",
  command: "Cmd",
  meta: "Cmd",
  shift: "Shift",
  alt: "Alt",
  option: "Alt",
  return: "Enter",
  enter: "Enter",
  esc: "Esc",
  escape: "Esc",
  space: "Space",
  backslash: "\\",
  slash: "/",
  comma: ",",
  period: ".",
  minus: "-",
  equal: "=",
  plus: "+",
  tab: "Tab",
  delete: "Del",
  backspace: "Backspace",
};

const KEY_ICONS: Partial<Record<string, LucideIcon>> = {
  cmd: CommandIcon,
  command: CommandIcon,
  meta: CommandIcon,
  return: CornerDownLeftIcon,
  enter: CornerDownLeftIcon,
  up: ArrowUpIcon,
  down: ArrowDownIcon,
  left: ArrowLeftIcon,
  right: ArrowRightIcon,
};

function getKeyParts(shortcutKey: string, trailingKeys: string[] = []) {
  return shortcutKey
    .split("+")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .concat(trailingKeys);
}

function Keycap({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const Icon = KEY_ICONS[normalized];
  const label =
    KEY_LABELS[normalized] ||
    normalized.charAt(0).toUpperCase() + normalized.slice(1);

  return (
    <span
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-cyan-200/20 bg-black/30 px-2 text-xs font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_20px_rgba(0,0,0,0.18)]",
        Icon ? "px-2" : "px-2.5"
      )}
      title={label}
    >
      {Icon ? <Icon className="size-4" aria-hidden="true" /> : label}
    </span>
  );
}

export function ShortcutKeycaps({
  shortcutKey,
  trailingKeys = [],
  className,
}: {
  shortcutKey: string;
  trailingKeys?: string[];
  className?: string;
}) {
  const parts = getKeyParts(shortcutKey, trailingKeys);
  if (!parts.length) {
    return (
      <span className="text-xs text-muted-foreground">No shortcut set</span>
    );
  }

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      {parts.map((part, index) => (
        <span key={`${part}-${index}`} className="inline-flex items-center gap-1.5">
          {index > 0 ? (
            <span className="text-xs font-medium text-muted-foreground">+</span>
          ) : null}
          <Keycap value={part} />
        </span>
      ))}
    </span>
  );
}

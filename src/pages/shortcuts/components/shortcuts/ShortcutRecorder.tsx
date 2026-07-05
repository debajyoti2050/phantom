import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components";
import { Check, X } from "lucide-react";
import { isMacOS, validateShortcutKey } from "@/lib";
import { invoke } from "@tauri-apps/api/core";
import { ShortcutKeycaps } from "./ShortcutKeycaps";

interface ShortcutRecorderProps {
  onSave: (key: string) => void;
  onCancel: () => void;
  disabled?: boolean;
  actionId?: string;
}

export const ShortcutRecorder = ({
  onSave,
  onCancel,
  disabled = false,
  actionId,
}: ShortcutRecorderProps) => {
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);
  const [error, setError] = useState<string>("");
  const isRecording = true;
  const isMoveWindow = actionId === "move_window";
  const minKeys = isMoveWindow ? 1 : 2;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isRecording) return;

      e.preventDefault();
      e.stopPropagation();

      const keys: string[] = [];

      if (e.metaKey || e.ctrlKey) {
        keys.push(isMacOS() ? "cmd" : "ctrl");
      }
      if (e.altKey) keys.push("alt");
      if (e.shiftKey) keys.push("shift");

      let mainKey = e.key.toLowerCase();
      const specialKeyMap: Record<string, string> = {
        arrowup: "up",
        arrowdown: "down",
        arrowleft: "left",
        arrowright: "right",
        " ": "space",
        escape: "esc",
        enter: "return",
        backspace: "backspace",
        delete: "delete",
        tab: "tab",
        "[": "bracketleft",
        "]": "bracketright",
        ";": "semicolon",
        "'": "quote",
        "`": "grave",
        "\\": "backslash",
        "/": "slash",
        ",": "comma",
        ".": "period",
        "-": "minus",
        "=": "equal",
        "+": "plus",
      };

      if (specialKeyMap[mainKey]) {
        mainKey = specialKeyMap[mainKey];
      }

      if (isMoveWindow) {
        if (["up", "down", "left", "right"].includes(mainKey)) {
          setError(
            "Arrow keys are automatic for Move Window. Only set modifiers."
          );
          return;
        }
        if (keys.length >= 1) {
          setRecordedKeys(keys);
          setError("");
        } else {
          setError("Must include at least one modifier (Cmd/Ctrl/Alt/Shift)");
        }
      } else {
        if (!["control", "alt", "shift", "meta"].includes(mainKey)) {
          keys.push(mainKey);
        }

        if (keys.length >= 2) {
          setRecordedKeys(keys);
          setError("");
        } else {
          setError(
            "Must include at least one modifier (Cmd/Ctrl/Alt/Shift) and one key"
          );
        }
      }
    },
    [isRecording, isMoveWindow]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (!isRecording) return;
      e.preventDefault();
      e.stopPropagation();
    },
    [isRecording]
  );

  useEffect(() => {
    if (!isRecording) return;

    window.focus();
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
    };
  }, [isRecording, handleKeyDown, handleKeyUp]);

  const handleSave = async () => {
    if (recordedKeys.length < minKeys) {
      setError(
        isMoveWindow
          ? "Move Window needs at least one modifier"
          : "Shortcut must have at least one modifier and one key"
      );
      return;
    }

    const shortcutKey = recordedKeys.join("+");

    if (!isMoveWindow) {
      if (!validateShortcutKey(shortcutKey)) {
        setError("Invalid shortcut combination");
        return;
      }

      try {
        const isValid = await invoke<boolean>("validate_shortcut_key", {
          key: shortcutKey,
        });

        if (!isValid) {
          setError("This shortcut combination is not supported");
          return;
        }
      } catch {
        setError("Failed to validate shortcut");
        return;
      }
    }

    onSave(shortcutKey);
  };

  const handleCancel = () => {
    setRecordedKeys([]);
    setError("");
    onCancel();
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div className="rounded-md border-2 border-primary/50 bg-primary/5 px-3 py-2 text-center text-sm">
            {recordedKeys.length > 0 ? (
              <span className="flex justify-center">
                <ShortcutKeycaps shortcutKey={recordedKeys.join("+")} />
              </span>
            ) : (
              <span className="font-medium text-primary animate-pulse">
                Waiting for keys...
              </span>
            )}
          </div>
        </div>

        <Button
          size="sm"
          variant="default"
          onClick={handleSave}
          disabled={disabled || recordedKeys.length < minKeys}
          title="Save shortcut"
        >
          <Check className="h-4 w-4" />
          Save
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCancel}
          disabled={disabled}
          title="Cancel"
        >
          <X className="h-4 w-4" />
          Cancel
        </Button>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {isRecording && !error ? (
        <p className="text-xs text-muted-foreground">
          {isMoveWindow
            ? "Press modifier keys (for example, Ctrl+Shift). Arrow keys work automatically."
            : "Press a key combination now (for example, Ctrl+Shift+K)."}
        </p>
      ) : null}

      {recordedKeys.length >= minKeys && !error ? (
        <p className="text-xs text-green-600">
          Shortcut captured. Click "Save" to apply.
        </p>
      ) : null}
    </div>
  );
};

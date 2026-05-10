import { FormEvent, useEffect, useState } from "react";
import {
  AlertTriangleIcon,
  BrainCircuitIcon,
  CheckCircle2Icon,
  CopyIcon,
  GripIcon,
  Loader2,
  PinIcon,
  SendHorizontalIcon,
  XIcon,
} from "lucide-react";
import { Button, Input, Markdown, ScrollArea, Switch } from "@/components";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

type ResponseMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
};

type ResponseWindowState = {
  open: boolean;
  isLoading: boolean;
  error: string | null;
  notice: string | null;
  response: string;
  keepEngaged: boolean;
  conversationHistory: ResponseMessage[];
};

const emptyState: ResponseWindowState = {
  open: false,
  isLoading: false,
  error: null,
  notice: null,
  response: "",
  keepEngaged: false,
  conversationHistory: [],
};

export function ResponseOverlayWindow() {
  const [state, setState] = useState<ResponseWindowState>(emptyState);
  const [followUp, setFollowUp] = useState("");
  const stateLabel = state.error
    ? "Error"
    : state.isLoading
    ? "Streaming"
    : "Ready";

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    invoke<ResponseWindowState | null>("get_response_window_state").then(
      (initialState) => {
        if (initialState) {
          setState(initialState);
        }
      }
    );

    listen<ResponseWindowState>("response-window-state", (event) => {
      setState(event.payload || emptyState);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        invoke("response_window_action", { action: "close" });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const copyContent = async () => {
    const content = state.response || state.notice || state.error || "";
    if (!content) return;
    await navigator.clipboard.writeText(content);
  };

  const submitFollowUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = followUp.trim();
    if (!text || state.isLoading) return;

    setFollowUp("");
    await invoke("response_window_action", {
      action: "submit_follow_up",
      text,
    });
  };

  return (
    <div className="phantom-response-native-root">
      <div className="phantom-response-window is-native">
        <div className="phantom-response-header" data-tauri-drag-region={true}>
          <div className="flex min-w-0 flex-row items-center gap-2">
            <div className="phantom-response-drag-handle" title="Move response">
              <GripIcon className="size-3.5" />
            </div>
            <div className="phantom-response-icon">
              <BrainCircuitIcon className="size-4" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold select-none">
                {state.keepEngaged ? "Conversation" : "AI Response"}
              </h3>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span
                  className={`phantom-state-chip ${
                    state.error
                      ? "is-error"
                      : state.isLoading
                      ? "is-loading"
                      : "is-ready"
                  }`}
                >
                  {stateLabel}
                </span>
                {state.keepEngaged ? (
                  <span className="phantom-state-chip is-pinned">Pinned</span>
                ) : null}
              </div>
            </div>
          </div>

          <div
            className="flex items-center gap-2 select-none"
            data-tauri-no-drag-region={true}
          >
            <div
              className="flex flex-row items-center gap-2"
              title="Keep panel open"
            >
              <PinIcon className="size-3.5 text-muted-foreground" />
              <Switch
                checked={state.keepEngaged}
                onCheckedChange={(checked) => {
                  invoke("response_window_action", {
                    action: "set_keep_engaged",
                    checked,
                  });
                }}
              />
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={copyContent}
              className="phantom-icon-button"
              title="Copy response"
            >
              <CopyIcon />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => invoke("response_window_action", { action: "close" })}
              className="phantom-icon-button"
              title={state.isLoading ? "Cancel loading" : "Close response"}
            >
              {state.isLoading ? <Loader2 className="animate-spin" /> : <XIcon />}
            </Button>
          </div>
        </div>

        <ScrollArea className="phantom-response-scroll is-native">
          <div className="phantom-response-body">
            {state.error && (
              <div className="phantom-message is-error">
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
                <div>
                  <strong>Error</strong>
                  <p>{state.error}</p>
                </div>
              </div>
            )}
            {!state.error && state.notice && (
              <div className="phantom-message is-notice">
                <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" />
                <div>
                  <strong>Capture Ready</strong>
                  <p>{state.notice}</p>
                </div>
              </div>
            )}
            {state.isLoading && (
              <div className="phantom-message is-loading">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating response...</span>
              </div>
            )}
            {state.response && (
              <div className="phantom-markdown-shell">
                <Markdown>{state.response}</Markdown>
              </div>
            )}

            {state.keepEngaged && state.conversationHistory.length > 1 && (
              <div className="space-y-3 pt-3">
                {[...state.conversationHistory]
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .map((message, index) => {
                    if (!state.isLoading && index === 0) {
                      return null;
                    }
                    return (
                      <div
                        key={message.id}
                        className={`phantom-history-item ${
                          message.role === "user" ? "is-user" : "is-assistant"
                        }`}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground uppercase">
                            {message.role === "user" ? "You" : "AI"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(message.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <Markdown>{message.content}</Markdown>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </ScrollArea>

        <form
          className="phantom-response-followup"
          onSubmit={submitFollowUp}
          data-tauri-no-drag-region={true}
        >
          <Input
            value={followUp}
            onChange={(event) => setFollowUp(event.target.value)}
            placeholder="Continue this conversation..."
            disabled={state.isLoading}
            className="phantom-response-followup-input"
          />
          <Button
            type="submit"
            size="icon"
            className="phantom-response-followup-send"
            disabled={!followUp.trim() || state.isLoading}
            title="Send follow-up"
          >
            {state.isLoading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <SendHorizontalIcon />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

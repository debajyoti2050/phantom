import {
  Button,
  CustomCursor,
  DragButton,
  Updater,
} from "@/components";
import {
  SystemAudio,
  Completion,
  AudioVisualizer,
  StatusIndicator,
} from "./components";
import { useApp } from "@/hooks";
import { useApp as useAppContext } from "@/contexts";
import { PanelsTopLeftIcon } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorLayout } from "@/layouts";
import { getPlatform } from "@/lib";

const App = () => {
  const { isHidden, systemAudio } = useApp();
  const { customizable } = useAppContext();
  const platform = getPlatform();

  const openDashboard = async () => {
    try {
      await invoke("open_dashboard");
    } catch (error) {
      console.error("Failed to open dashboard:", error);
    }
  };

  return (
    <ErrorBoundary
      fallbackRender={() => {
        return <ErrorLayout isCompact />;
      }}
      resetKeys={["app-error"]}
      onReset={() => {
        console.log("Reset");
      }}
    >
      <div
        className={`phantom-overlay-root ${
          isHidden ? "hidden pointer-events-none" : ""
        }`}
      >
        <div className="phantom-overlay-shell">
          <DragButton />

          {systemAudio?.capturing ? (
            <div className="phantom-audio-strip">
              <div className="flex flex-1 items-center gap-2">
                <AudioVisualizer isRecording={systemAudio?.capturing} />
              </div>
              <StatusIndicator
                setupRequired={systemAudio.setupRequired}
                error={systemAudio.error}
                isProcessing={systemAudio.isProcessing}
                isAIProcessing={systemAudio.isAIProcessing}
                capturing={systemAudio.capturing}
              />
            </div>
          ) : (
            <div className="phantom-command-strip">
              <Completion isHidden={isHidden} />
              <SystemAudio {...systemAudio} />
              <Button
                size="icon"
                variant="ghost"
                className="phantom-icon-button"
                title="Open dashboard"
                onClick={openDashboard}
              >
                <PanelsTopLeftIcon className="h-4 w-4" />
              </Button>
            </div>
          )}

          <Updater />
        </div>
        {customizable.cursor.type === "invisible" && platform !== "linux" ? (
          <CustomCursor />
        ) : null}
      </div>
    </ErrorBoundary>
  );
};

export default App;

import { Button } from "@/components";
import { Loader2, ScanLineIcon, SquareDashedMousePointerIcon } from "lucide-react";
import { UseCompletionReturn } from "@/types";
import { MAX_FILES } from "@/config";
import { useApp } from "@/contexts";

export const Screenshot = ({
  screenshotConfiguration,
  attachedFiles,
  isLoading,
  captureScreenshot,
  isScreenshotLoading,
}: UseCompletionReturn) => {
  const { supportsImages } = useApp();
  const captureMode = screenshotConfiguration.enabled
    ? "Screenshot"
    : "Selection";
  const processingMode = screenshotConfiguration.mode;

  const isDisabled =
    attachedFiles.length >= MAX_FILES || isLoading || isScreenshotLoading;

  return (
    <Button
      size="icon"
      className="phantom-icon-button"
      title={
        !supportsImages
          ? `${captureMode} mode (${processingMode}) - current provider may not support image input`
          : `${captureMode} mode (${processingMode}) - ${attachedFiles.length}/${MAX_FILES} files`
      }
      onClick={captureScreenshot}
      disabled={isDisabled}
    >
      {isScreenshotLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : screenshotConfiguration.enabled ? (
        <ScanLineIcon className="h-4 w-4" />
      ) : (
        <SquareDashedMousePointerIcon className="h-4 w-4" />
      )}
    </Button>
  );
};

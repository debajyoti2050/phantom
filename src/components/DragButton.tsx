import { useEffect } from "react";
import { GripIcon } from "lucide-react";
import { Button } from "@/components";
import { useWindowResize } from "@/hooks";

export const DragButton = () => {
  const { resizeWindow } = useWindowResize();

  useEffect(() => {
    resizeWindow(false);
  }, [resizeWindow]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="phantom-icon-button"
      data-tauri-drag-region={true}
      title="Move overlay"
    >
      <GripIcon className="h-4 w-4" />
    </Button>
  );
};

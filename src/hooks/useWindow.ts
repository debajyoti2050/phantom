import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useCallback, useEffect } from "react";

const COLLAPSED_WINDOW_HEIGHT = 64;
const EXPANDED_WINDOW_HEIGHT = 720;

// Helper function to check if any overlay surface is open in the DOM
const isAnyExpandedSurfaceOpen = (): boolean => {
  const popoverContents = document.querySelectorAll(
    '[data-radix-popper-content-wrapper], [data-phantom-response-window="true"]'
  );
  return popoverContents.length > 0;
};

export const useWindowResize = () => {
  const resizeWindow = useCallback(async (expanded: boolean) => {
    try {
      if (!expanded && isAnyExpandedSurfaceOpen()) {
        return;
      }

      const newHeight = expanded
        ? EXPANDED_WINDOW_HEIGHT
        : COLLAPSED_WINDOW_HEIGHT;

      await invoke("set_window_height", {
        height: newHeight,
      });
    } catch (error) {
      console.error("Failed to resize window:", error);
    }
  }, []);

  // Setup drag handling and popover monitoring
  useEffect(() => {
    let isDragging = false;
    let shrinkTimer: ReturnType<typeof setTimeout> | null = null;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isDragRegion = target.closest('[data-tauri-drag-region="true"]');

      if (isDragRegion) {
        isDragging = true;
      }
    };

    const handleMouseUp = async () => {
      if (isDragging) {
        isDragging = false;

        setTimeout(() => {
          if (!isAnyExpandedSurfaceOpen()) {
            resizeWindow(false);
          }
        }, 100);
      }
    };

    // Debounced shrink: wait for DOM to settle before deciding to shrink the window.
    // Prevents racing with resizeWindow(true) calls when popover is mid-render.
    const observer = new MutationObserver(() => {
      if (shrinkTimer) clearTimeout(shrinkTimer);
      shrinkTimer = setTimeout(() => {
        if (!isAnyExpandedSurfaceOpen()) {
          resizeWindow(false);
        }
      }, 250);
    });

    // Observe the body for changes to detect popover open/close
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state"],
    });

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      if (shrinkTimer) clearTimeout(shrinkTimer);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mouseup", handleMouseUp);
      observer.disconnect();
    };
  }, [resizeWindow]);

  return { resizeWindow };
};

interface UseWindowFocusOptions {
  onFocusLost?: () => void;
  onFocusGained?: () => void;
}

export const useWindowFocus = ({
  onFocusLost,
  onFocusGained,
}: UseWindowFocusOptions = {}) => {
  const handleFocusChange = useCallback(
    async (focused: boolean) => {
      if (focused && onFocusGained) {
        onFocusGained();
      } else if (!focused && onFocusLost) {
        onFocusLost();
      }
    },
    [onFocusLost, onFocusGained]
  );

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupFocusListener = async () => {
      try {
        const window = getCurrentWebviewWindow();

        // Listen to focus change events
        unlisten = await window.onFocusChanged(({ payload: focused }) => {
          handleFocusChange(focused);
        });
      } catch (error) {
        console.error("Failed to setup focus listener:", error);
      }
    };

    setupFocusListener();

    // Cleanup
    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [handleFocusChange]);
};

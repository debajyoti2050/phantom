import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";

export type OverlayScaleInfo = {
  scale: number;
  min: number;
  max: number;
  step: number;
  width: number;
  collapsedHeight: number;
  expandedHeight: number;
  responseHeight: number;
};

const defaultOverlayScaleInfo: OverlayScaleInfo = {
  scale: 1,
  min: 0.85,
  max: 1.25,
  step: 0.05,
  width: 560,
  collapsedHeight: 52,
  expandedHeight: 720,
  responseHeight: 560,
};

export function useOverlayScale() {
  const [metrics, setMetrics] = useState<OverlayScaleInfo>(
    defaultOverlayScaleInfo
  );

  const refresh = useCallback(async () => {
    const next = await invoke<OverlayScaleInfo>("get_overlay_scale");
    setMetrics(next);
    return next;
  }, []);

  const setScale = useCallback(async (scale: number) => {
    const next = await invoke<OverlayScaleInfo>("set_overlay_scale", { scale });
    setMetrics(next);
    return next;
  }, []);

  useEffect(() => {
    let isMounted = true;
    let unlisten: (() => void) | null = null;

    invoke<OverlayScaleInfo>("get_overlay_scale").then((next) => {
      if (isMounted) {
        setMetrics(next);
      }
    });

    listen<OverlayScaleInfo>("overlay-scale-changed", (event) => {
      if (isMounted) {
        setMetrics(event.payload);
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      isMounted = false;
      unlisten?.();
    };
  }, []);

  return {
    metrics,
    refresh,
    setScale,
  };
}

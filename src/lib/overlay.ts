import type { OverlayState, StageBounds } from '../types';

export const DEFAULT_STAGE_BOUNDS: StageBounds = {
  width: 1280,
  height: 720,
};

export const DEFAULT_STAGE_RATIO =
  DEFAULT_STAGE_BOUNDS.width / DEFAULT_STAGE_BOUNDS.height;
export const DEFAULT_OVERLAY_SIZE_RATIO = 0.18;
export const MIN_OVERLAY_SIZE_RATIO = 0.12;
export const MAX_OVERLAY_SIZE_RATIO = 0.36;
export const DEFAULT_OVERLAY_MARGIN_PX = 28;

export interface OverlayPixels {
  x: number;
  y: number;
  size: number;
}

export function createInitialOverlay(bounds: StageBounds): OverlayState {
  const base = Math.min(bounds.width, bounds.height);
  const size = base * DEFAULT_OVERLAY_SIZE_RATIO;

  return clampOverlay(
    pixelsToOverlay(
      {
        x: bounds.width - size - DEFAULT_OVERLAY_MARGIN_PX,
        y: bounds.height - size - DEFAULT_OVERLAY_MARGIN_PX,
        size,
      },
      bounds,
    ),
    bounds,
  );
}

export function overlayToPixels(
  overlay: OverlayState,
  bounds: StageBounds,
): OverlayPixels {
  const base = Math.min(bounds.width, bounds.height);
  const size = overlay.size * base;

  return {
    x: overlay.x * bounds.width,
    y: overlay.y * bounds.height,
    size,
  };
}

export function pixelsToOverlay(
  pixels: OverlayPixels,
  bounds: StageBounds,
): OverlayState {
  const base = Math.min(bounds.width, bounds.height);

  return {
    x: pixels.x / bounds.width,
    y: pixels.y / bounds.height,
    size: pixels.size / base,
  };
}

export function clampOverlay(
  overlay: OverlayState,
  bounds: StageBounds,
): OverlayState {
  const base = Math.min(bounds.width, bounds.height);
  const minSize = MIN_OVERLAY_SIZE_RATIO * base;
  const maxSize = Math.min(MAX_OVERLAY_SIZE_RATIO * base, base * 0.5);
  const sizePx = clamp(overlay.size * base, minSize, maxSize);
  const maxX = Math.max(0, bounds.width - sizePx);
  const maxY = Math.max(0, bounds.height - sizePx);

  return pixelsToOverlay(
    {
      x: clamp(overlay.x * bounds.width, 0, maxX),
      y: clamp(overlay.y * bounds.height, 0, maxY),
      size: sizePx,
    },
    bounds,
  );
}

export function moveOverlay(
  overlay: OverlayState,
  deltaX: number,
  deltaY: number,
  bounds: StageBounds,
): OverlayState {
  const pixels = overlayToPixels(overlay, bounds);

  return clampOverlay(
    pixelsToOverlay(
      {
        x: pixels.x + deltaX,
        y: pixels.y + deltaY,
        size: pixels.size,
      },
      bounds,
    ),
    bounds,
  );
}

export function resizeOverlay(
  overlay: OverlayState,
  deltaSize: number,
  bounds: StageBounds,
): OverlayState {
  const pixels = overlayToPixels(overlay, bounds);

  return clampOverlay(
    pixelsToOverlay(
      {
        x: pixels.x,
        y: pixels.y,
        size: pixels.size + deltaSize,
      },
      bounds,
    ),
    bounds,
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

import {
  clampOverlay,
  createInitialOverlay,
  moveOverlay,
  overlayToPixels,
  resizeOverlay,
} from './overlay';

describe('overlay utilities', () => {
  const bounds = { width: 1280, height: 720 };

  it('creates the initial overlay inside the lower-right corner', () => {
    const overlay = createInitialOverlay(bounds);
    const pixels = overlayToPixels(overlay, bounds);

    expect(pixels.x + pixels.size).toBeLessThanOrEqual(bounds.width);
    expect(pixels.y + pixels.size).toBeLessThanOrEqual(bounds.height);
    expect(pixels.x).toBeGreaterThan(bounds.width * 0.6);
    expect(pixels.y).toBeGreaterThan(bounds.height * 0.55);
  });

  it('clamps drag movement to the stage bounds', () => {
    const next = moveOverlay(
      { x: 0.82, y: 0.76, size: 0.18 },
      280,
      300,
      bounds,
    );
    const pixels = overlayToPixels(next, bounds);

    expect(pixels.x + pixels.size).toBeLessThanOrEqual(bounds.width);
    expect(pixels.y + pixels.size).toBeLessThanOrEqual(bounds.height);
  });

  it('limits resize operations and keeps the bubble visible', () => {
    const next = resizeOverlay(
      { x: 0.76, y: 0.7, size: 0.18 },
      500,
      bounds,
    );
    const pixels = overlayToPixels(next, bounds);

    expect(pixels.size).toBeLessThanOrEqual(
      Math.min(bounds.width, bounds.height) * 0.36,
    );
    expect(pixels.x + pixels.size).toBeLessThanOrEqual(bounds.width);
    expect(pixels.y + pixels.size).toBeLessThanOrEqual(bounds.height);
    expect(clampOverlay(next, bounds)).toEqual(next);
  });
});

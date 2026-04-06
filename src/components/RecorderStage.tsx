import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  clampOverlay,
  createInitialOverlay,
  moveOverlay,
  overlayToPixels,
  resizeOverlay,
  type OverlayPixels,
} from '../lib/overlay';
import type { OverlayState, RecorderStatus, StageBounds } from '../types';

interface RecorderStageProps {
  cameraEnabled: boolean;
  liveCameraStream: MediaStream | null;
  liveDisplayStream: MediaStream | null;
  overlayState: OverlayState;
  previewUrl: string | null;
  stageAspectRatio: number;
  status: RecorderStatus;
  onOverlayChange: (next: OverlayState) => void;
}

type InteractionMode = 'drag' | 'resize' | null;

export function RecorderStage({
  cameraEnabled,
  liveCameraStream,
  liveDisplayStream,
  overlayState,
  previewUrl,
  stageAspectRatio,
  status,
  onOverlayChange,
}: RecorderStageProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const displayVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const [stageBounds, setStageBounds] = useState<StageBounds>({
    width: 1280,
    height: 720,
  });
  const [hasInitializedOverlay, setHasInitializedOverlay] = useState(false);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }

    const updateBounds = () => {
      const nextBounds = {
        width: Math.max(frame.clientWidth, 1),
        height: Math.max(frame.clientHeight, 1),
      };

      setStageBounds(nextBounds);

      if (!hasInitializedOverlay) {
        onOverlayChange(createInitialOverlay(nextBounds));
        setHasInitializedOverlay(true);
      }
    };

    updateBounds();

    const resizeObserver = new ResizeObserver(updateBounds);
    resizeObserver.observe(frame);

    return () => {
      resizeObserver.disconnect();
    };
  }, [hasInitializedOverlay, onOverlayChange, stageAspectRatio]);

  useEffect(() => {
    const clampedOverlay = clampOverlay(overlayState, stageBounds);

    if (!isSameOverlay(clampedOverlay, overlayState)) {
      onOverlayChange(clampedOverlay);
    }
  }, [overlayState, onOverlayChange, stageBounds]);

  useEffect(() => {
    if (!displayVideoRef.current) {
      return;
    }

    displayVideoRef.current.srcObject = liveDisplayStream;
    if (liveDisplayStream) {
      void displayVideoRef.current.play().catch(() => undefined);
    }
  }, [liveDisplayStream]);

  useEffect(() => {
    if (!cameraVideoRef.current) {
      return;
    }

    cameraVideoRef.current.srcObject = liveCameraStream;
    if (liveCameraStream) {
      void cameraVideoRef.current.play().catch(() => undefined);
    }
  }, [liveCameraStream]);

  const overlayPixels = useMemo<OverlayPixels>(
    () => overlayToPixels(overlayState, stageBounds),
    [overlayState, stageBounds],
  );

  const showOverlay = cameraEnabled && status !== 'recorded';
  const showLiveDisplay = Boolean(liveDisplayStream) && status !== 'recorded';

  const startInteraction =
    (mode: InteractionMode) => (event: ReactPointerEvent<HTMLDivElement | HTMLButtonElement>) => {
      if (!showOverlay) {
        return;
      }

      event.preventDefault();
      const startPoint = { x: event.clientX, y: event.clientY };
      const initialOverlay = overlayState;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startPoint.x;
        const deltaY = moveEvent.clientY - startPoint.y;

        if (mode === 'drag') {
          onOverlayChange(
            moveOverlay(initialOverlay, deltaX, deltaY, stageBounds),
          );
          return;
        }

        onOverlayChange(
          resizeOverlay(initialOverlay, Math.max(deltaX, deltaY), stageBounds),
        );
      };

      const handlePointerUp = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp, { once: true });
    };

  return (
    <div
      className="stage-card"
      ref={frameRef}
      style={{ aspectRatio: String(stageAspectRatio) }}
    >
      <div className="stage-surface">
        {showLiveDisplay ? (
          <video
            autoPlay
            className="stage-video"
            muted
            playsInline
            ref={displayVideoRef}
          />
        ) : previewUrl ? (
          <video className="stage-video" controls playsInline src={previewUrl} />
        ) : (
          <div className="stage-placeholder">
            <span className="stage-placeholder-tag">Preview</span>
            <h2>Capture your screen inside a clean camera-first layout.</h2>
            <p>
              Start recording to composite your screen, microphone, and webcam
              into one file.
            </p>
          </div>
        )}

        {showOverlay ? (
          <div
            className="camera-overlay"
            onPointerDown={startInteraction('drag')}
            style={{
              height: `${overlayPixels.size}px`,
              left: `${overlayPixels.x}px`,
              top: `${overlayPixels.y}px`,
              width: `${overlayPixels.size}px`,
            }}
          >
            {liveCameraStream ? (
              <video
                autoPlay
                className="camera-video"
                muted
                playsInline
                ref={cameraVideoRef}
              />
            ) : (
              <div className="camera-placeholder">Camera</div>
            )}
            <button
              aria-label="Resize camera"
              className="camera-resize"
              onPointerDown={startInteraction('resize')}
              type="button"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function isSameOverlay(left: OverlayState, right: OverlayState) {
  return (
    Math.abs(left.x - right.x) < 0.0001 &&
    Math.abs(left.y - right.y) < 0.0001 &&
    Math.abs(left.size - right.size) < 0.0001
  );
}

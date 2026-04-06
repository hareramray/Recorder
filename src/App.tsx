import { useState } from 'react';
import { RecorderStage } from './components/RecorderStage';
import {
  DEFAULT_STAGE_BOUNDS,
  DEFAULT_STAGE_RATIO,
  createInitialOverlay,
} from './lib/overlay';
import { useScreenRecorder } from './hooks/useScreenRecorder';
import './App.css';

function App() {
  const [overlayState, setOverlayState] = useState(() =>
    createInitialOverlay(DEFAULT_STAGE_BOUNDS),
  );
  const {
    canDownload,
    canStart,
    canStop,
    downloadRecording,
    errorMessage,
    includeCamera,
    includeMicrophone,
    isSupported,
    liveCameraStream,
    liveDisplayStream,
    recordingResult,
    resetRecording,
    setIncludeCamera,
    setIncludeMicrophone,
    stageAspectRatio,
    startRecording,
    status,
    statusMessage,
    stopRecording,
  } = useScreenRecorder({ overlayState });

  const handleStart = async () => {
    if (recordingResult) {
      resetRecording();
    }

    await startRecording();
  };

  return (
    <div className="app-shell">
      <div className="app-backdrop" />
      <main className="app-content">
        <section className="hero-copy">
          <p className="eyebrow">Screen recorder</p>
          <h1>Record your screen with a movable webcam bubble.</h1>
          <p className="hero-body">
            A desktop-first recorder built for fast walkthroughs. Share your
            display, layer a circular camera feed on top, and download the
            finished video instantly.
          </p>
        </section>

        <section className="recorder-panel">
          <RecorderStage
            cameraEnabled={includeCamera}
            liveCameraStream={liveCameraStream}
            liveDisplayStream={liveDisplayStream}
            onOverlayChange={setOverlayState}
            overlayState={overlayState}
            previewUrl={recordingResult?.url ?? null}
            stageAspectRatio={stageAspectRatio || DEFAULT_STAGE_RATIO}
            status={status}
          />

          <div className="control-bar">
            <div className="control-actions">
              <button
                className="primary-button"
                disabled={!canStart}
                onClick={() => {
                  void handleStart();
                }}
                type="button"
              >
                {recordingResult ? 'Record again' : 'Start recording'}
              </button>
              <button
                className="secondary-button"
                disabled={!canStop}
                onClick={() => {
                  void stopRecording();
                }}
                type="button"
              >
                Stop
              </button>
              <button
                aria-pressed={includeCamera}
                className="toggle-button"
                disabled={
                  status === 'recording' ||
                  status === 'requesting_permissions' ||
                  status === 'stopping'
                }
                onClick={() => setIncludeCamera((current) => !current)}
                type="button"
              >
                Camera {includeCamera ? 'On' : 'Off'}
              </button>
              <button
                aria-pressed={includeMicrophone}
                className="toggle-button"
                disabled={
                  status === 'recording' ||
                  status === 'requesting_permissions' ||
                  status === 'stopping'
                }
                onClick={() => setIncludeMicrophone((current) => !current)}
                type="button"
              >
                Mic {includeMicrophone ? 'On' : 'Off'}
              </button>
              <button
                className="secondary-button"
                disabled={!canDownload}
                onClick={downloadRecording}
                type="button"
              >
                Download
              </button>
            </div>

            <div className="status-panel">
              <span className={`status-chip status-${status}`}>
                {status.replace('_', ' ')}
              </span>
              <p className="status-message">{statusMessage}</p>
              {!isSupported ? (
                <p className="status-error">
                  Desktop Chrome or Edge is required for the full recorder
                  workflow.
                </p>
              ) : null}
              {errorMessage ? <p className="status-error">{errorMessage}</p> : null}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;

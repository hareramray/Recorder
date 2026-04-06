import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createBrowserRecorderSession } from '../lib/recorderSession';
import { DEFAULT_STAGE_RATIO } from '../lib/overlay';
import { isBrowserRecordingSupported } from '../lib/media';
import {
  RecorderError,
  type OverlayState,
  type RecorderResult,
  type RecorderSession,
} from '../types';

type CreateSession = typeof createBrowserRecorderSession;

interface UseScreenRecorderOptions {
  overlayState: OverlayState;
  createSession?: CreateSession;
}

const STATUS_LABELS = {
  idle: 'Ready to capture your screen.',
  requesting_permissions: 'Choose a screen, window, or tab to share.',
  recording: 'Recording in progress.',
  stopping: 'Finalizing the recording.',
  recorded: 'Recording ready to preview and download.',
  error: 'Recording could not be completed.',
} as const;

export function useScreenRecorder({
  overlayState,
  createSession = createBrowserRecorderSession,
}: UseScreenRecorderOptions) {
  const sessionRef = useRef<RecorderSession | null>(null);
  const overlayStateRef = useRef(overlayState);
  const stopPromiseRef = useRef<Promise<void> | null>(null);
  const resultUrlRef = useRef<string | null>(null);
  const [status, setStatus] = useState<
    | 'idle'
    | 'requesting_permissions'
    | 'recording'
    | 'stopping'
    | 'recorded'
    | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState<string>(STATUS_LABELS.idle);
  const [includeCamera, setIncludeCamera] = useState(true);
  const [includeMicrophone, setIncludeMicrophone] = useState(true);
  const [liveDisplayStream, setLiveDisplayStream] = useState<MediaStream | null>(
    null,
  );
  const [liveCameraStream, setLiveCameraStream] = useState<MediaStream | null>(
    null,
  );
  const [stageAspectRatio, setStageAspectRatio] = useState(DEFAULT_STAGE_RATIO);
  const [recordingResult, setRecordingResult] = useState<RecorderResult | null>(
    null,
  );
  const isSupported = useMemo(() => isBrowserRecordingSupported(), []);

  useEffect(() => {
    overlayStateRef.current = overlayState;
  }, [overlayState]);

  useEffect(() => {
    return () => {
      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
        resultUrlRef.current = null;
      }

      void sessionRef.current?.destroy();
      sessionRef.current = null;
    };
  }, []);

  const resetRecording = useCallback(() => {
    setRecordingResult((current) => {
      if (current?.url) {
        URL.revokeObjectURL(current.url);
        if (resultUrlRef.current === current.url) {
          resultUrlRef.current = null;
        }
      }

      return null;
    });
    setErrorMessage('');
    setStatusMessage(STATUS_LABELS.idle);
    setStatus('idle');
  }, []);

  const stopRecording = useCallback(async () => {
    if (!sessionRef.current) {
      return;
    }

    if (stopPromiseRef.current) {
      return stopPromiseRef.current;
    }

    setStatus('stopping');
    setStatusMessage(STATUS_LABELS.stopping);

    const activeSession = sessionRef.current;
    stopPromiseRef.current = activeSession
      .stop()
      .then((result) => {
        sessionRef.current = null;
        resultUrlRef.current = result.url;
        setRecordingResult(result);
        setLiveDisplayStream(null);
        setLiveCameraStream(null);
        setStageAspectRatio(result.width / result.height);
        setStatus('recorded');
        setErrorMessage('');
        setStatusMessage(STATUS_LABELS.recorded);
      })
      .catch((error: unknown) => {
        sessionRef.current = null;
        setLiveDisplayStream(null);
        setLiveCameraStream(null);
        setStatus('error');
        setErrorMessage(toUserMessage(error));
        setStatusMessage(STATUS_LABELS.error);
      })
      .finally(() => {
        stopPromiseRef.current = null;
      });

    return stopPromiseRef.current;
  }, []);

  const startRecording = useCallback(async () => {
    if (
      !isSupported ||
      status === 'requesting_permissions' ||
      status === 'recording'
    ) {
      if (!isSupported) {
        setStatus('error');
        setErrorMessage(
          'This app currently requires desktop Chrome or Edge with screen, camera, and audio capture support.',
        );
        setStatusMessage(STATUS_LABELS.error);
      }
      return;
    }

    if (recordingResult?.url) {
      URL.revokeObjectURL(recordingResult.url);
      if (resultUrlRef.current === recordingResult.url) {
        resultUrlRef.current = null;
      }
      setRecordingResult(null);
    }

    setErrorMessage('');
    setStatus('requesting_permissions');
    setStatusMessage(STATUS_LABELS.requesting_permissions);

    try {
      const session = await createSession({
        includeCamera,
        includeMicrophone,
        getOverlayState: () => overlayStateRef.current,
        onDisplayEnded: () => {
          void stopRecording();
        },
      });

      sessionRef.current = session;
      setLiveDisplayStream(session.captureSources.displayStream);
      setLiveCameraStream(session.captureSources.cameraStream);
      setStageAspectRatio(session.width / session.height);
      setStatus('recording');
      setStatusMessage(STATUS_LABELS.recording);
    } catch (error) {
      sessionRef.current = null;
      setLiveDisplayStream(null);
      setLiveCameraStream(null);
      setStatus('error');
      setErrorMessage(toUserMessage(error));
      setStatusMessage(STATUS_LABELS.error);
    }
  }, [
    createSession,
    includeCamera,
    includeMicrophone,
    isSupported,
    recordingResult,
    status,
    stopRecording,
  ]);

  const downloadRecording = useCallback(() => {
    if (!recordingResult) {
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = recordingResult.url;
    anchor.download = `recording-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
    anchor.click();
  }, [recordingResult]);

  return {
    canDownload: Boolean(recordingResult),
    canStart:
      isSupported &&
      status !== 'requesting_permissions' &&
      status !== 'recording' &&
      status !== 'stopping',
    canStop: status === 'recording',
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
  };
}

function toUserMessage(error: unknown) {
  if (error instanceof RecorderError) {
    return error.message;
  }

  return 'The recorder could not start or finish cleanly.';
}

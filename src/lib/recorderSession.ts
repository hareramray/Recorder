import { overlayToPixels, type OverlayPixels } from './overlay';
import { selectSupportedMimeType } from './media';
import {
  RecorderError,
  type CaptureSources,
  type OverlayState,
  type RecorderResult,
  type RecorderSession,
  type RecorderSessionOptions,
  type StageBounds,
} from '../types';

const DISPLAY_CAPTURE_CONSTRAINTS = {
  video: {
    displaySurface: 'monitor',
    frameRate: {
      ideal: 30,
      max: 30,
    },
  },
  audio: true,
} satisfies DisplayMediaStreamOptions;

const CAMERA_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: 'user',
  width: {
    ideal: 960,
  },
  height: {
    ideal: 960,
  },
};

const MICROPHONE_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

export async function createBrowserRecorderSession(
  options: RecorderSessionOptions,
): Promise<RecorderSession> {
  let displayStream: MediaStream | null = null;
  let userStream: MediaStream | null = null;
  let compositeStream: MediaStream | null = null;
  let canvasStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let rafId = 0;
  let cleanupDone = false;

  try {
    displayStream = await navigator.mediaDevices.getDisplayMedia(
      DISPLAY_CAPTURE_CONSTRAINTS,
    );
  } catch (error) {
    throw mapDisplayCaptureError(error);
  }

  try {
    if (options.includeCamera || options.includeMicrophone) {
      userStream = await navigator.mediaDevices.getUserMedia({
        video: options.includeCamera ? CAMERA_CONSTRAINTS : false,
        audio: options.includeMicrophone ? MICROPHONE_CONSTRAINTS : false,
      });
    }
  } catch (error) {
    stopTracks(displayStream);
    throw mapUserMediaError(error);
  }

  const cameraStream = extractStream(userStream, 'video');
  const microphoneStream = extractStream(userStream, 'audio');
  const displayVideo = document.createElement('video');
  const cameraVideo = cameraStream ? document.createElement('video') : null;

  try {
    await prepareVideo(displayVideo, displayStream);

    if (cameraStream && cameraVideo) {
      await prepareVideo(cameraVideo, cameraStream);
    }

    const width = displayVideo.videoWidth || 1280;
    const height = displayVideo.videoHeight || 720;
    const stageBounds: StageBounds = {
      width,
      height,
    };
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new RecorderError(
        'recording_failed',
        'Canvas rendering is unavailable in this browser.',
      );
    }

    canvas.width = width;
    canvas.height = height;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    const drawComposite = () => {
      drawFrame({
        cameraVideo,
        context,
        displayVideo,
        overlay: options.getOverlayState(),
        stageBounds,
      });
      rafId = window.requestAnimationFrame(drawComposite);
    };

    rafId = window.requestAnimationFrame(drawComposite);
    canvasStream = canvas.captureStream(30);

    const audioBundle = createAudioMix(displayStream, microphoneStream);
    audioContext = audioBundle.audioContext;
    compositeStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioBundle.audioTracks,
    ]);

    const mimeType = selectSupportedMimeType();
    const recorder = mimeType
      ? new MediaRecorder(compositeStream, { mimeType })
      : new MediaRecorder(compositeStream);
    const recordedChunks: BlobPart[] = [];
    let stopPromise: Promise<RecorderResult> | null = null;

    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    });

    recorder.start(250);

    const finalizeCleanup = async () => {
      if (cleanupDone) {
        return;
      }

      cleanupDone = true;
      window.cancelAnimationFrame(rafId);
      displayVideo.pause();
      displayVideo.srcObject = null;

      if (cameraVideo) {
        cameraVideo.pause();
        cameraVideo.srcObject = null;
      }

      stopTracks(canvasStream);
      stopTracks(compositeStream);
      stopTracks(displayStream);
      stopTracks(userStream);

      if (audioContext) {
        await audioContext.close().catch(() => undefined);
      }
    };

    const stopRecording = async () => {
      if (!stopPromise) {
        stopPromise = new Promise<RecorderResult>((resolve, reject) => {
          const handleStop = async () => {
            recorder.removeEventListener('stop', handleStop);
            recorder.removeEventListener('error', handleError);
            const blob = new Blob(recordedChunks, {
              type: recorder.mimeType || mimeType || 'video/webm',
            });
            const url = URL.createObjectURL(blob);

            await finalizeCleanup();
            resolve({
              blob,
              url,
              mimeType: blob.type || recorder.mimeType || mimeType || 'video/webm',
              width,
              height,
            });
          };

          const handleError = async () => {
            recorder.removeEventListener('stop', handleStop);
            recorder.removeEventListener('error', handleError);
            await finalizeCleanup();
            reject(
              new RecorderError(
                'recording_failed',
                'Recording failed before the file could be finalized.',
              ),
            );
          };

          recorder.addEventListener('stop', handleStop, { once: true });
          recorder.addEventListener('error', handleError, { once: true });

          if (recorder.state === 'inactive') {
            void handleStop();
            return;
          }

          recorder.stop();
        });
      }

      return stopPromise;
    };

    const displayTrack = displayStream.getVideoTracks()[0];
    if (displayTrack) {
      displayTrack.addEventListener(
        'ended',
        () => {
          options.onDisplayEnded?.();
        },
        { once: true },
      );
    }

    const captureSources: CaptureSources = {
      displayStream,
      cameraStream,
      microphoneStream,
    };

    return {
      captureSources,
      stop: stopRecording,
      destroy: async () => {
        try {
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
        } catch {
          // Ignore destroy-time recorder failures and prefer releasing devices.
        }

        await finalizeCleanup();
      },
      width,
      height,
      mimeType: mimeType || recorder.mimeType || 'video/webm',
    };
  } catch (error) {
    window.cancelAnimationFrame(rafId);
    stopTracks(displayStream);
    stopTracks(userStream);
    stopTracks(canvasStream);
    stopTracks(compositeStream);

    if (audioContext) {
      await audioContext.close().catch(() => undefined);
    }

    displayVideo.srcObject = null;
    if (cameraVideo) {
      cameraVideo.srcObject = null;
    }

    throw normalizeError(error);
  }
}

function drawFrame({
  cameraVideo,
  context,
  displayVideo,
  overlay,
  stageBounds,
}: {
  cameraVideo: HTMLVideoElement | null;
  context: CanvasRenderingContext2D;
  displayVideo: HTMLVideoElement;
  overlay: OverlayState;
  stageBounds: StageBounds;
}) {
  context.clearRect(0, 0, stageBounds.width, stageBounds.height);
  context.fillStyle = '#fffaf1';
  context.fillRect(0, 0, stageBounds.width, stageBounds.height);
  context.drawImage(displayVideo, 0, 0, stageBounds.width, stageBounds.height);

  if (!cameraVideo) {
    return;
  }

  const pixels = overlayToPixels(overlay, stageBounds);
  drawCircularCamera(context, cameraVideo, pixels);
}

function drawCircularCamera(
  context: CanvasRenderingContext2D,
  cameraVideo: HTMLVideoElement,
  overlay: OverlayPixels,
) {
  const centerX = overlay.x + overlay.size / 2;
  const centerY = overlay.y + overlay.size / 2;
  const radius = overlay.size / 2;

  context.save();
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.closePath();
  context.clip();
  context.drawImage(cameraVideo, overlay.x, overlay.y, overlay.size, overlay.size);
  context.restore();

  context.save();
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.strokeStyle = '#121212';
  context.lineWidth = Math.max(4, overlay.size * 0.028);
  context.stroke();
  context.restore();
}

function createAudioMix(
  displayStream: MediaStream,
  microphoneStream: MediaStream | null,
) {
  const AudioCtor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioCtor) {
    throw new RecorderError(
      'unsupported',
      'This browser does not support the required audio APIs.',
    );
  }

  const audioContext = new AudioCtor();
  const mediaDestination = audioContext.createMediaStreamDestination();

  connectAudioStream(audioContext, mediaDestination, displayStream);
  connectAudioStream(audioContext, mediaDestination, microphoneStream);

  return {
    audioContext,
    audioTracks: mediaDestination.stream.getAudioTracks(),
  };
}

function connectAudioStream(
  audioContext: AudioContext,
  mediaDestination: MediaStreamAudioDestinationNode,
  stream: MediaStream | null,
) {
  if (!stream || stream.getAudioTracks().length === 0) {
    return;
  }

  const source = audioContext.createMediaStreamSource(stream);
  source.connect(mediaDestination);
}

async function prepareVideo(video: HTMLVideoElement, stream: MediaStream) {
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await waitForVideoMetadata(video);

  try {
    await video.play();
  } catch {
    // Stream-backed video elements can fail to autoplay in tests and older browsers.
  }
}

function waitForVideoMetadata(video: HTMLVideoElement) {
  return new Promise<void>((resolve, reject) => {
    const handleLoaded = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(
        new RecorderError(
          'recording_failed',
          'Live preview could not be prepared for recording.',
        ),
      );
    };
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', handleLoaded);
      video.removeEventListener('error', handleError);
    };

    if (video.readyState >= 1) {
      resolve();
      return;
    }

    video.addEventListener('loadedmetadata', handleLoaded, { once: true });
    video.addEventListener('error', handleError, { once: true });
  });
}

function extractStream(
  stream: MediaStream | null,
  kind: MediaStreamTrack['kind'],
) {
  if (!stream) {
    return null;
  }

  const tracks =
    kind === 'audio' ? stream.getAudioTracks() : stream.getVideoTracks();

  return tracks.length > 0 ? new MediaStream(tracks) : null;
}

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function mapDisplayCaptureError(error: unknown) {
  if (
    error instanceof DOMException &&
    (error.name === 'AbortError' || error.name === 'NotAllowedError')
  ) {
    return new RecorderError(
      'screen_capture_cancelled',
      'Screen sharing was canceled before recording started.',
    );
  }

  return new RecorderError(
    'screen_capture_unavailable',
    'The screen could not be captured in this browser session.',
  );
}

function mapUserMediaError(error: unknown) {
  if (
    error instanceof DOMException &&
    (error.name === 'NotAllowedError' || error.name === 'SecurityError')
  ) {
    return new RecorderError(
      'camera_mic_denied',
      'Camera or microphone access was denied.',
    );
  }

  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return new RecorderError(
      'device_not_found',
      'The requested camera or microphone could not be found.',
    );
  }

  return new RecorderError(
    'recording_failed',
    'Camera or microphone setup failed before recording started.',
  );
}

function normalizeError(error: unknown) {
  if (error instanceof RecorderError) {
    return error;
  }

  return new RecorderError(
    'recording_failed',
    'The recording session could not be prepared.',
  );
}

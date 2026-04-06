const RECORDER_MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=h264,opus',
  'video/webm',
];

export function selectSupportedMimeType() {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return '';
  }

  return (
    RECORDER_MIME_CANDIDATES.find((mimeType) =>
      MediaRecorder.isTypeSupported(mimeType),
    ) ?? ''
  );
}

export function isBrowserRecordingSupported() {
  const hasWindow = typeof window !== 'undefined';
  const hasNavigator = typeof navigator !== 'undefined';
  const CanvasCtor =
    hasWindow && 'HTMLCanvasElement' in window
      ? window.HTMLCanvasElement
      : undefined;
  const AudioCtor =
    hasWindow && 'AudioContext' in window
      ? window.AudioContext
      : 'webkitAudioContext' in window
        ? (window as Window & { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext
        : undefined;

  return Boolean(
    hasWindow &&
      hasNavigator &&
      typeof window.MediaRecorder !== 'undefined' &&
      typeof navigator.mediaDevices?.getDisplayMedia === 'function' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function' &&
      typeof CanvasCtor?.prototype.captureStream === 'function' &&
      AudioCtor,
  );
}

export type RecorderStatus =
  | 'idle'
  | 'requesting_permissions'
  | 'recording'
  | 'stopping'
  | 'recorded'
  | 'error';

export type RecorderErrorCode =
  | 'unsupported'
  | 'screen_capture_cancelled'
  | 'screen_capture_unavailable'
  | 'camera_mic_denied'
  | 'device_not_found'
  | 'recording_failed'
  | 'recording_interrupted';

export interface StageBounds {
  width: number;
  height: number;
}

export interface OverlayState {
  x: number;
  y: number;
  size: number;
}

export interface CaptureSources {
  displayStream: MediaStream;
  cameraStream: MediaStream | null;
  microphoneStream: MediaStream | null;
}

export interface RecorderResult {
  blob: Blob;
  url: string;
  mimeType: string;
  width: number;
  height: number;
}

export interface RecorderSession {
  captureSources: CaptureSources;
  stop: () => Promise<RecorderResult>;
  destroy: () => Promise<void>;
  width: number;
  height: number;
  mimeType: string;
}

export interface RecorderSessionOptions {
  includeCamera: boolean;
  includeMicrophone: boolean;
  getOverlayState: () => OverlayState;
  onDisplayEnded?: () => void;
}

export class RecorderError extends Error {
  code: RecorderErrorCode;

  constructor(code: RecorderErrorCode, message: string) {
    super(message);
    this.name = 'RecorderError';
    this.code = code;
  }
}

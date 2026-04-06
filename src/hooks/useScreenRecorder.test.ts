import { act, renderHook, waitFor } from '@testing-library/react';
import { useScreenRecorder } from './useScreenRecorder';
import { RecorderError, type RecorderResult, type RecorderSession } from '../types';

describe('useScreenRecorder', () => {
  const overlayState = { x: 0.78, y: 0.72, size: 0.18 };
  const originalMediaRecorder = globalThis.MediaRecorder;
  const originalMediaDevices = navigator.mediaDevices;
  const originalCaptureStream = HTMLCanvasElement.prototype.captureStream;
  const originalAudioContext = window.AudioContext;
  const createMockStream = () =>
    ({
      getAudioTracks: () => [],
      getTracks: () => [],
      getVideoTracks: () => [],
    }) as unknown as MediaStream;

  beforeEach(() => {
    class MockMediaRecorder {
      static isTypeSupported() {
        return true;
      }
    }

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getDisplayMedia: vi.fn(),
        getUserMedia: vi.fn(),
      },
    });
    globalThis.MediaRecorder = MockMediaRecorder as unknown as typeof MediaRecorder;
    HTMLCanvasElement.prototype.captureStream = vi
      .fn()
      .mockReturnValue({
        getVideoTracks: () => [],
      }) as unknown as typeof HTMLCanvasElement.prototype.captureStream;
    window.AudioContext = class {
      createMediaStreamDestination() {
        return {
          stream: {
            getAudioTracks: () => [],
          },
        } as unknown as MediaStreamAudioDestinationNode;
      }
    } as unknown as typeof AudioContext;
  });

  afterEach(() => {
    globalThis.MediaRecorder = originalMediaRecorder;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: originalMediaDevices,
    });
    HTMLCanvasElement.prototype.captureStream = originalCaptureStream;
    window.AudioContext = originalAudioContext;
  });

  it('transitions to recording when a session starts successfully', async () => {
    const displayStream = createMockStream();
    const cameraStream = createMockStream();
    const microphoneStream = createMockStream();
    const stop = vi.fn<RecorderSession['stop']>().mockResolvedValue({
      blob: new Blob(['ok'], { type: 'video/webm' }),
      height: 720,
      mimeType: 'video/webm',
      url: 'blob:recording',
      width: 1280,
    } satisfies RecorderResult);
    const createSession = vi.fn().mockResolvedValue({
      captureSources: {
        cameraStream,
        displayStream,
        microphoneStream,
      },
      destroy: vi.fn().mockResolvedValue(undefined),
      mimeType: 'video/webm',
      stop,
      width: 1280,
      height: 720,
    } satisfies RecorderSession);

    const { result } = renderHook(() =>
      useScreenRecorder({ overlayState, createSession }),
    );

    await act(async () => {
      await result.current.startRecording();
    });

    expect(createSession).toHaveBeenCalled();
    expect(result.current.status).toBe('recording');
    expect(result.current.liveDisplayStream).toBe(displayStream);
    expect(result.current.errorMessage).toBe('');
  });

  it('surfaces a canceled share as an error state', async () => {
    const createSession = vi.fn().mockRejectedValue(
      new RecorderError(
        'screen_capture_cancelled',
        'Screen sharing was canceled before recording started.',
      ),
    );

    const { result } = renderHook(() =>
      useScreenRecorder({ overlayState, createSession }),
    );

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toContain('Screen sharing was canceled');
  });

  it('moves to recorded after stop resolves', async () => {
    const displayStream = createMockStream();
    const stop = vi.fn<RecorderSession['stop']>().mockResolvedValue({
      blob: new Blob(['done'], { type: 'video/webm' }),
      height: 720,
      mimeType: 'video/webm',
      url: 'blob:done',
      width: 1280,
    } satisfies RecorderResult);
    const createSession = vi.fn().mockResolvedValue({
      captureSources: {
        cameraStream: null,
        displayStream,
        microphoneStream: null,
      },
      destroy: vi.fn().mockResolvedValue(undefined),
      mimeType: 'video/webm',
      stop,
      width: 1280,
      height: 720,
    } satisfies RecorderSession);

    const { result } = renderHook(() =>
      useScreenRecorder({ overlayState, createSession }),
    );

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      await result.current.stopRecording();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('recorded');
    });
    expect(result.current.recordingResult?.url).toBe('blob:done');
  });
});

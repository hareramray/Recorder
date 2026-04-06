import { selectSupportedMimeType } from './media';

describe('selectSupportedMimeType', () => {
  const originalMediaRecorder = globalThis.MediaRecorder;

  afterEach(() => {
    globalThis.MediaRecorder = originalMediaRecorder;
  });

  it('returns the first supported mime type', () => {
    class MockMediaRecorder {
      static isTypeSupported(type: string) {
        return type === 'video/webm;codecs=vp8,opus';
      }
    }

    globalThis.MediaRecorder = MockMediaRecorder as unknown as typeof MediaRecorder;

    expect(selectSupportedMimeType()).toBe('video/webm;codecs=vp8,opus');
  });

  it('falls back to an empty string when no mime type is supported', () => {
    class MockMediaRecorder {
      static isTypeSupported() {
        return false;
      }
    }

    globalThis.MediaRecorder = MockMediaRecorder as unknown as typeof MediaRecorder;

    expect(selectSupportedMimeType()).toBe('');
  });
});

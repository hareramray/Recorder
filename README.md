# Screen Recorder App

A desktop-first screen recorder built with React, TypeScript, and Vite. The app captures your screen, mixes microphone and display audio when available, overlays a circular webcam bubble, and exports the final recording as a `.webm` file.

## Features

- Screen capture with the browser `getDisplayMedia()` API
- Optional webcam overlay rendered as a circular bubble
- Draggable and resizable camera bubble
- Optional microphone capture
- In-app preview after recording stops
- One-click local download
- Inline status and permission error feedback

## Tech Stack

- React 18
- TypeScript
- Vite
- Vitest
- Testing Library

## Requirements

- Node.js 22 or newer
- npm 11 or newer
- Desktop Chrome or Microsoft Edge

This app depends on browser APIs that are not consistently supported in all browsers. Chrome and Edge are the intended targets for v1.

## Getting Started

```bash
npm install
npm run dev
```

Open the local Vite URL in Chrome or Edge, then:

1. Click `Start recording`.
2. Choose the screen, window, or tab you want to share.
3. Allow camera and microphone access if prompted.
4. Drag or resize the webcam bubble as needed.
5. Click `Stop` to finalize the recording.
6. Preview and download the generated `.webm` file.

## Available Scripts

```bash
npm run dev
npm run build
npm run preview
npm test
```

## Notes

- Output format is `webm`.
- The saved video includes the webcam overlay when camera capture is enabled.
- Display audio depends on what the browser allows for the selected share target.
- The app is local-only. It does not upload, sync, or store recordings remotely.

## Project Structure

```text
src/
  App.tsx                         Main app shell and controls
  components/RecorderStage.tsx    Preview stage and webcam overlay UI
  hooks/useScreenRecorder.ts      Recorder state and actions
  lib/recorderSession.ts          Media capture, compositing, and recording
  lib/overlay.ts                  Overlay sizing and boundary helpers
```

## Verification

The project is set up to verify with:

```bash
npx tsc -b
npm run build
npm test
```

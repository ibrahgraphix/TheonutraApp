## Theonutra

Monorepo with:
- **React Native (Expo)** app in `apps/mobile` (Android + iOS)
- **TypeScript backend (Node/Express)** in `apps/api`

## Prereqs

- Node.js (LTS recommended)
- For Android: Android Studio + an emulator (or a physical device)
- For iOS: macOS + Xcode, or use Expo Go on a device

## Install

```bash
npm install
```

## Run (recommended)

### Backend API

```bash
npm run dev:api
```

API health check: `http://localhost:3001/health`

### Mobile app

```bash
npm run dev:mobile
```

From the Expo CLI UI you can launch Android/iOS, or directly:

```bash
npm -w mobile run android
```

## Build API

```bash
npm -w api run build
npm -w api run start
```


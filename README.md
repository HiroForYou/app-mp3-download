# app-mp3-download

**English** · [Español](README.es.md)

Monorepo with two components: an Express server that converts YouTube links to MP3, and a mobile app (Expo/React Native) that uses that server to download and manage music.

## Structure

| Folder | Description | Stack |
|---|---|---|
| `server/` | API that converts video to MP3 via `yt-dlp` + `ffmpeg` | Node.js, Express |
| `musicdown/` | Mobile client app for the server | Expo, React Native, NativeWind |

## Requirements

| Component | Requirement |
|---|---|
| `server/` | Node.js, with `yt-dlp` and `ffmpeg` available on `PATH` |
| `musicdown/` | Node.js, pnpm, Expo CLI |

## Getting started

### Server

```bash
cd server
npm install
cp .env.example .env   # set API_KEY
node --env-file=.env server.js
```

Endpoints, environment variables and Docker deployment: [server/README.md](server/README.md).

### Mobile app

```bash
cd musicdown
pnpm install
npx expo start --dev-client
```

Android development build:

```bash
npx eas-cli build --profile development --platform android
```

## Legal notice

For personal, self-hosted use. Downloading audio from YouTube may violate its Terms of Service depending on the content and jurisdiction. Do not expose the server as a public service for third parties.

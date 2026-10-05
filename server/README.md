# musicdown-server

**English** · [Español](README.es.md)

Express server that converts a YouTube link (or any other site supported by yt-dlp) into an MP3 stream for the MusicDown app. Conversion runs on the server because mobile apps cannot run `ffmpeg` or `yt-dlp` reliably.

| Stage | Tool | Output |
|---|---|---|
| Download | `yt-dlp` (best audio stream) | Audio piped to `ffmpeg` |
| Encoding | `ffmpeg` | 192 kbps MP3 |
| Response | Express | MP3 streamed as the HTTP response body |

## Endpoints

| Method and path | Auth | Response |
|---|---|---|
| `GET /api/health` | No | `{ ok: true }`. Used by the connection test in the app settings. |
| `GET /api/metadata?url=<video_url>` | `x-api-key` | `{ title, artist, thumbnail, duration }`, read with `yt-dlp -j` (no download) |
| `GET /api/convert?url=<video_url>&filename=<hint>` | `x-api-key` | `audio/mpeg` stream with `Content-Disposition: attachment` |

The `x-api-key` header is checked only when `API_KEY` is set.

## Environment variables

| Variable | Default | Use |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `API_KEY` | (empty: no auth) | Value required in the `x-api-key` header |
| `YTDLP_PATH` | `yt-dlp` | Path to the `yt-dlp` binary |
| `FFMPEG_PATH` | `ffmpeg` | Path to the `ffmpeg` binary |

## Running locally

```bash
npm install
cp .env.example .env   # set API_KEY
node --env-file=.env server.js
```

Requires `yt-dlp` and `ffmpeg` on `PATH`, or `YTDLP_PATH` / `FFMPEG_PATH` pointing to them.

## Deployment (Docker)

```bash
docker build -t musicdown-server .
docker run -p 3000:3000 -e API_KEY=your-long-random-string musicdown-server
```

The image runs on any container host (Railway, Render, Fly.io, a VPS with Docker). In the app settings, set the public URL and the same `API_KEY`.

## Operating notes

| # | Point |
|---|---|
| 1 | Set `API_KEY` in production. Without it, anyone with the URL can convert videos using the server's bandwidth and compute. |
| 2 | No rate limiting. The API key is the only access control. |
| 3 | Personal, self-hosted use only (e.g. content you own, Creative Commons or public-domain audio). Downloading audio from YouTube may violate its Terms of Service depending on content and jurisdiction. Do not expose the server as a public service. |

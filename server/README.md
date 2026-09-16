# musicdown-server

Small Express server that converts a YouTube (or other yt-dlp-supported) link
to a real MP3 stream, so the MusicDown app doesn't need to do this on-device
(mobile apps can't run ffmpeg/yt-dlp reliably — see the root README for why).

It pipes `yt-dlp` (best audio stream) straight into `ffmpeg` (encodes to
192kbps MP3) and streams the result back as the HTTP response body. It also
exposes a metadata endpoint so the app can prefill title/artist/thumbnail
before the actual download starts.

## Endpoints

- `GET /api/health` — `{ ok: true }`, no auth required. Used by the app's
  "Probar conexión" button.
- `GET /api/metadata?url=<video_url>` — `{ title, artist, thumbnail, duration }`
  extracted via `yt-dlp -j` (no download).
- `GET /api/convert?url=<video_url>&filename=<hint>` — streams back an
  `audio/mpeg` response with `Content-Disposition: attachment`.

Both `/api/metadata` and `/api/convert` require the `x-api-key` header when
`API_KEY` is set (strongly recommended once deployed publicly — see below).

## Running locally

```bash
npm install
cp .env.example .env   # edit API_KEY
node --env-file=.env server.js
```

Requires `yt-dlp` and `ffmpeg` on your `PATH` (or set `YTDLP_PATH` /
`FFMPEG_PATH` env vars to point at them).

## Deploying (Docker)

```bash
docker build -t musicdown-server .
docker run -p 3000:3000 -e API_KEY=your-long-random-string musicdown-server
```

Deploy the image to any container host (Railway, Render, Fly.io, a VPS with
Docker, etc.) and point the app's Settings screen at the resulting public
URL + the same `API_KEY`.

## Important

- **Always set `API_KEY` in production.** Without it, anyone who discovers
  the server's URL can use it to convert arbitrary videos on your
  bandwidth/compute — this server does not rate-limit or otherwise restrict
  usage beyond the API key check.
- **Personal/self-hosted use only.** Downloading audio from YouTube may
  violate YouTube's Terms of Service depending on the content and your
  jurisdiction. This server is meant for your own private use (e.g. content
  you own, Creative Commons/public-domain audio) — don't expose it as a
  public service for others.

# musicdown-server

[English](README.md) · **Español**

Servidor Express que convierte un enlace de YouTube (o de cualquier otro sitio compatible con yt-dlp) en un stream MP3 para la app MusicDown. La conversión corre en el servidor porque las apps móviles no ejecutan `ffmpeg` ni `yt-dlp` de forma fiable.

| Etapa | Herramienta | Salida |
|---|---|---|
| Descarga | `yt-dlp` (mejor stream de audio) | Audio enviado por pipe a `ffmpeg` |
| Codificación | `ffmpeg` | MP3 a 192 kbps |
| Respuesta | Express | MP3 enviado como cuerpo de la respuesta HTTP |

## Endpoints

| Método y ruta | Auth | Respuesta |
|---|---|---|
| `GET /api/health` | No | `{ ok: true }`. Lo usa el botón "Probar conexión" de la app. |
| `GET /api/metadata?url=<video_url>` | `x-api-key` | `{ title, artist, thumbnail, duration }`, leído con `yt-dlp -j` (sin descarga) |
| `GET /api/convert?url=<video_url>&filename=<hint>` | `x-api-key` | Stream `audio/mpeg` con `Content-Disposition: attachment` |

El header `x-api-key` se valida solo si `API_KEY` está definido.

## Variables de entorno

| Variable | Valor por defecto | Uso |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP |
| `API_KEY` | (vacío: sin auth) | Valor exigido en el header `x-api-key` |
| `YTDLP_PATH` | `yt-dlp` | Ruta al binario de `yt-dlp` |
| `FFMPEG_PATH` | `ffmpeg` | Ruta al binario de `ffmpeg` |

## Ejecución local

```bash
npm install
cp .env.example .env   # configurar API_KEY
node --env-file=.env server.js
```

Requiere `yt-dlp` y `ffmpeg` en el `PATH`, o `YTDLP_PATH` / `FFMPEG_PATH` apuntando a ellos.

## Despliegue (Docker)

```bash
docker build -t musicdown-server .
docker run -p 3000:3000 -e API_KEY=una-cadena-larga-y-aleatoria musicdown-server
```

La imagen corre en cualquier host de contenedores (Railway, Render, Fly.io, un VPS con Docker). En la configuración de la app se indica la URL pública y el mismo `API_KEY`.

## Notas de operación

| # | Punto |
|---|---|
| 1 | Definir `API_KEY` en producción. Sin él, cualquiera con la URL puede convertir videos usando el ancho de banda y el cómputo del servidor. |
| 2 | Sin rate limiting. La API key es el único control de acceso. |
| 3 | Uso personal y autohospedado (p. ej. contenido propio, audio Creative Commons o de dominio público). Descargar audio de YouTube puede infringir sus Términos de Servicio según el contenido y la jurisdicción. No exponer el servidor como servicio público. |

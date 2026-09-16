# app-mp3-download

Monorepo con dos componentes: un servidor Express que convierte enlaces de YouTube a MP3, y una app móvil (Expo/React Native) que consume ese servidor para descargar y gestionar música.

## Estructura

| Carpeta | Descripción | Stack |
|---|---|---|
| `server/` | API que convierte video a MP3 vía `yt-dlp` + `ffmpeg` | Node.js, Express |
| `musicdown/` | App móvil cliente del servidor | Expo, React Native, NativeWind |

## Requisitos

| Componente | Requisito |
|---|---|
| `server/` | Node.js, `yt-dlp` y `ffmpeg` disponibles en `PATH` |
| `musicdown/` | Node.js, pnpm, Expo CLI |

## Puesta en marcha

### Servidor

```bash
cd server
npm install
cp .env.example .env   # configurar API_KEY
node --env-file=.env server.js
```

Detalle de endpoints, variables de entorno y despliegue con Docker: [server/README.md](server/README.md).

### App móvil

```bash
cd musicdown
pnpm install
npx expo start --dev-client
```

Build de desarrollo para Android:

```bash
npx eas-cli build --profile development --platform android
```

## Aviso legal

Uso personal y autohospedado. Descargar audio de YouTube puede infringir sus Términos de Servicio según el contenido y la jurisdicción. No exponer el servidor como servicio público para terceros.

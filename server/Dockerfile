FROM node:20-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg python3 ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server.js ./

ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]

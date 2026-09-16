// index.js
// Requiere:
// npm install youtube-mp3-downloader

const YoutubeMp3Downloader = require("youtube-mp3-downloader");
const path = require("path");

const url = process.argv[2];

if (!url) {
    console.log("Uso:");
    console.log("node index.js <URL_DE_YOUTUBE>");
    process.exit(1);
}

const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);

if (!match) {
    console.error("URL de YouTube inválida.");
    process.exit(1);
}

const videoId = match[1];

const YD = new YoutubeMp3Downloader({
    ffmpegPath: "ffmpeg", // o ruta completa al ejecutable
    outputPath: path.join(__dirname, "downloads"),
    youtubeVideoQuality: "highestaudio",
    queueParallelism: 2,
    progressTimeout: 2000,
});

YD.on("finished", (err, data) => {
    if (err) {
        console.error(err);
        return;
    }

    console.log("Descarga completada:");
    console.log(data);
});

YD.on("error", (error) => {
    console.error("Error:", error);
});

YD.on("progress", (progress) => {
    process.stdout.write(`\r${progress.progress.percentage}%`);
});

YD.download(videoId);
const express = require('express');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || '';
const YTDLP_PATH = process.env.YTDLP_PATH || 'yt-dlp';
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';

const app = express();

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

app.use((req, res, next) => {
  log(`${req.method} ${req.originalUrl}`, `from ${req.ip}`);
  next();
});

function checkAuth(req, res, next) {
  if (!API_KEY) return next();
  if (req.get('x-api-key') !== API_KEY) {
    log('Rejected request: missing/invalid x-api-key');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function sanitizeFilename(name) {
  return String(name || 'track')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim()
    .slice(0, 80) || 'track';
}

// jobId -> { percent, stage }. Lets the app poll /api/progress while a
// /api/convert download+transcode is running, since the response body itself
// is the binary mp3 stream and can't also carry progress messages.
const jobs = new Map();

function setJobProgress(jobId, percent, stage) {
  if (!jobId) return;
  jobs.set(jobId, { percent, stage });
}

function clearJobLater(jobId, delayMs = 60000) {
  if (!jobId) return;
  setTimeout(() => jobs.delete(jobId), delayMs);
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/progress', checkAuth, (req, res) => {
  const jobId = req.query.jobId;
  const job = jobId ? jobs.get(jobId) : null;
  res.json(job || { percent: 0, stage: 'unknown' });
});

app.get('/api/metadata', checkAuth, (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }
  log('metadata: fetching', url);

  const proc = spawn(YTDLP_PATH, ['-j', '--no-warnings', '--no-playlist', url]);
  let out = '';
  let err = '';
  proc.stdout.on('data', (chunk) => {
    out += chunk;
  });
  proc.stderr.on('data', (chunk) => {
    err += chunk;
  });
  proc.on('error', (e) => {
    log('metadata: yt-dlp failed to start:', e.message);
    res.status(502).json({ error: 'yt-dlp is not available on the server' });
  });
  proc.on('close', (code) => {
    if (res.headersSent) return;
    if (code !== 0) {
      log('metadata: yt-dlp exited with code', code, err.slice(-500));
      return res.status(502).json({ error: 'yt-dlp failed', details: err.slice(-2000) });
    }
    try {
      const info = JSON.parse(out);
      log('metadata: ok ->', info.title, '/', info.uploader || info.channel);
      res.json({
        title: info.title || null,
        artist: info.uploader || info.channel || null,
        thumbnail: info.thumbnail || null,
        duration: info.duration || null,
      });
    } catch (e) {
      log('metadata: could not parse yt-dlp output:', e.message);
      res.status(502).json({ error: 'Could not parse yt-dlp output' });
    }
  });
});

const YTDLP_PROGRESS_RE = /\[download\]\s+(\d+(?:\.\d+)?)%/;

app.get('/api/convert', checkAuth, (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }
  const filenameHint = sanitizeFilename(req.query.filename);
  const jobId = req.query.jobId;
  log('convert: starting', url, '-> filename hint:', filenameHint, jobId ? `(job ${jobId})` : '');
  setJobProgress(jobId, 0, 'downloading');

  const ytdlp = spawn(YTDLP_PATH, ['-f', 'bestaudio/best', '--no-playlist', '--newline', '-o', '-', url]);
  const ffmpeg = spawn(FFMPEG_PATH, ['-i', 'pipe:0', '-vn', '-f', 'mp3', '-b:a', '192k', 'pipe:1']);

  let ytdlpErr = '';
  let ffmpegErr = '';
  let bytesStreamed = 0;
  ytdlp.stderr.on('data', (chunk) => {
    ytdlpErr += chunk;
    const text = chunk.toString();
    const match = text.match(YTDLP_PROGRESS_RE);
    if (match) {
      setJobProgress(jobId, Math.min(99, parseFloat(match[1])), 'downloading');
    }
  });
  ffmpeg.stderr.on('data', (chunk) => {
    ffmpegErr += chunk;
  });

  ytdlp.stdout.pipe(ffmpeg.stdin);

  const fail = (message, details) => {
    log('convert: FAILED -', message, details ? details.slice(-500) : '');
    setJobProgress(jobId, 0, 'error');
    clearJobLater(jobId, 5000);
    if (!res.headersSent) {
      res.status(502).json({ error: message, details: details ? details.slice(-2000) : undefined });
    } else {
      res.destroy();
    }
  };

  ytdlp.on('error', (e) => fail('yt-dlp is not available on the server', e.message));
  ffmpeg.on('error', (e) => fail('ffmpeg is not available on the server', e.message));

  ytdlp.on('close', (code) => {
    if (code !== 0) {
      log('convert: yt-dlp exited with code', code, ytdlpErr.slice(-500));
    } else {
      setJobProgress(jobId, 99, 'converting');
    }
  });
  ffmpeg.on('close', (code) => {
    if (code !== 0 && !res.writableEnded) {
      fail('ffmpeg failed to convert audio', ffmpegErr);
    } else if (code === 0) {
      log(`convert: done - streamed ${bytesStreamed} bytes for`, url);
      setJobProgress(jobId, 100, 'done');
      clearJobLater(jobId);
    }
  });

  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Disposition', `attachment; filename="${filenameHint}.mp3"`);
  ffmpeg.stdout.on('data', (chunk) => {
    bytesStreamed += chunk.length;
  });
  ffmpeg.stdout.pipe(res);

  req.on('close', () => {
    if (!res.writableEnded) {
      log('convert: client disconnected early for', url);
    }
    ytdlp.kill('SIGKILL');
    ffmpeg.kill('SIGKILL');
  });
});

app.listen(PORT, () => {
  console.log(`musicdown server listening on port ${PORT}`);
  if (!API_KEY) {
    console.warn('WARNING: API_KEY is not set — this server accepts unauthenticated requests.');
  }
});

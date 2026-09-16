import { Directory, File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Asset as NextAsset } from 'expo-media-library/next';

import { writeMp3Tags } from './id3';
import { addTrack, getTrack, listTracks, removeTrack, updateTrack } from './library';
import { detectLinkKind } from './linkKind';
import { getServerSettings } from './settings';
import type { Track } from './types';

function generateId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '').trim();
  return cleaned.slice(0, 80) || 'track';
}

function ensureDirectory(dir: Directory): Directory {
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

function tracksDirectory(): Directory {
  return ensureDirectory(new Directory(Paths.document, 'tracks'));
}

function tempDirectory(): Directory {
  return ensureDirectory(new Directory(Paths.cache, 'musicdown-tmp'));
}

function uniqueFile(dir: Directory, baseName: string, extension: string): File {
  let candidate = new File(dir, `${baseName}${extension}`);
  let attempt = 1;
  while (candidate.exists) {
    attempt += 1;
    candidate = new File(dir, `${baseName} (${attempt})${extension}`);
  }
  return candidate;
}

export interface YoutubeMetadata {
  title: string | null;
  artist: string | null;
  thumbnail: string | null;
}

function requireServerUrl(serverUrl: string): string {
  if (!serverUrl) {
    throw new Error('Configura la URL del servidor en Ajustes para descargar enlaces de YouTube.');
  }
  return serverUrl.replace(/\/+$/, '');
}

export async function fetchYoutubeMetadata(sourceUrl: string): Promise<YoutubeMetadata> {
  const { serverUrl, apiKey } = await getServerSettings();
  const base = requireServerUrl(serverUrl);
  const endpoint = `${base}/api/metadata?url=${encodeURIComponent(sourceUrl)}`;
  const response = await fetch(endpoint, {
    headers: apiKey ? { 'x-api-key': apiKey } : undefined,
  });
  if (!response.ok) {
    throw new Error(`No se pudo obtener información del video (${response.status})`);
  }
  return response.json();
}

async function pollJobProgress(
  base: string,
  apiKey: string,
  jobId: string,
  onProgress: (percent: number) => void,
  shouldContinue: () => boolean
): Promise<void> {
  while (shouldContinue()) {
    try {
      const response = await fetch(`${base}/api/progress?jobId=${jobId}`, {
        headers: apiKey ? { 'x-api-key': apiKey } : undefined,
      });
      if (response.ok) {
        const data = await response.json();
        if (typeof data.percent === 'number') onProgress(data.percent);
      }
    } catch {
      // Ignore transient polling errors — the main download request is authoritative.
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
}

async function downloadYoutubeAudio(
  sourceUrl: string,
  destination: Directory,
  filenameHint: string,
  onProgress?: (percent: number) => void
): Promise<File> {
  const { serverUrl, apiKey } = await getServerSettings();
  const base = requireServerUrl(serverUrl);
  const jobId = generateId();
  const endpoint = `${base}/api/convert?url=${encodeURIComponent(sourceUrl)}&filename=${encodeURIComponent(filenameHint)}&jobId=${jobId}`;

  let polling = true;
  const pollPromise = onProgress
    ? pollJobProgress(base, apiKey, jobId, onProgress, () => polling)
    : Promise.resolve();

  try {
    return (await File.downloadFileAsync(endpoint, destination, {
      idempotent: true,
      headers: apiKey ? { 'x-api-key': apiKey } : undefined,
    })) as File;
  } finally {
    polling = false;
    await pollPromise;
  }
}

export async function downloadImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    const destination = new File(tempDirectory(), `cover-${generateId()}.jpg`);
    const downloaded = await File.downloadFileAsync(url, destination, { idempotent: true });
    const bytes = await downloaded.bytes();
    downloaded.delete();
    return bytes;
  } catch (e) {
    console.warn('downloadImageBytes: failed for', url, '-', e instanceof Error ? e.message : e);
    return null;
  }
}

export function extractYoutubeVideoId(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.slice(1) || null;
    }
    const v = parsed.searchParams.get('v');
    if (v) return v;
    const shortsMatch = parsed.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch) return shortsMatch[1];
  } catch {
    // Not a parseable URL — no fallback thumbnail possible.
  }
  return null;
}

async function fetchYoutubeCoverBytes(sourceUrl: string, thumbnailUrl: string | null): Promise<Uint8Array | undefined> {
  if (thumbnailUrl) {
    const bytes = await downloadImageBytes(thumbnailUrl);
    if (bytes) return bytes;
  }
  // yt-dlp's chosen thumbnail URL (often maxresdefault.jpg) doesn't exist for
  // every video. hqdefault.jpg is available for virtually all YouTube videos,
  // so fall back to it before giving up on a cover entirely.
  const videoId = extractYoutubeVideoId(sourceUrl);
  if (videoId) {
    const bytes = await downloadImageBytes(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);
    if (bytes) return bytes;
  }
  return undefined;
}

async function publishToMediaLibrary(file: File): Promise<string | null> {
  // We only ever create new assets, never read the user's existing library,
  // so request write-only access. This avoids the granular 'audio' read
  // permission, which isn't declared in Expo Go's manifest (only a real
  // native build honors the config plugin that would add it).
  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (!permission.granted) return null;

  // No album grouping: createAlbumAsync does raw File I/O to create the
  // album's directory, which needs a real WRITE_EXTERNAL_STORAGE grant that
  // modern Android (13+) won't give out anymore. createAssetAsync alone uses
  // the modern MediaStore insert path and drops the file into the default
  // Music/ location for its media type without hitting that wall.
  const asset = await MediaLibrary.createAssetAsync(file.uri);
  return asset.id;
}

async function unpublishFromMediaLibrary(mediaAssetId: string | null): Promise<void> {
  if (!mediaAssetId) return;
  try {
    await MediaLibrary.deleteAssetsAsync([mediaAssetId]);
  } catch {
    // Asset may already be gone (deleted externally) — safe to ignore.
  }
}

export interface ExternalAudioItem {
  mediaAssetId: string;
  title: string;
  artist: string;
  fileUri: string;
}

/**
 * Lists every audio file in the device's Music folder, including ones this
 * app didn't download. Requires real read access to audio (`READ_MEDIA_AUDIO`
 * on Android 13+), which Expo Go cannot grant — only a development build
 * (whose native manifest actually includes the config-plugin permissions)
 * can use this.
 */
export async function listAllMusicFolderAudio(excludeMediaAssetIds: Set<string>): Promise<ExternalAudioItem[]> {
  const permission = await MediaLibrary.requestPermissionsAsync(false, ['audio']);
  if (!permission.granted) {
    throw new Error(
      'Se necesita permiso de lectura de audio. Esto requiere un development build — no funciona en Expo Go.'
    );
  }

  let album: MediaLibrary.Album | null = null;
  try {
    album = await MediaLibrary.getAlbumAsync('Music');
  } catch {
    album = null;
  }

  const { assets } = await MediaLibrary.getAssetsAsync({
    mediaType: 'audio',
    album: album ?? undefined,
    first: 500,
    sortBy: [['creationTime', false]],
  });

  return assets
    .filter((asset) => !excludeMediaAssetIds.has(asset.id))
    .map((asset) => ({
      mediaAssetId: asset.id,
      title: asset.filename.replace(/\.[^.]+$/, ''),
      artist: 'Desconocido',
      fileUri: asset.uri,
    }));
}

export async function deleteExternalAsset(mediaAssetId: string): Promise<void> {
  // The legacy deleteAssetsAsync() doesn't implement Android 11+'s required
  // user-consent flow for deleting media this app doesn't own (files found
  // via the "Todas" scan) — it can silently no-op instead of deleting.
  // The "next" API's Asset.delete() properly triggers the system
  // confirmation dialog via MediaStore.createDeleteRequest(). On Android 14+
  // its permission check also required READ_MEDIA_VISUAL_USER_SELECTED, which
  // can only be granted through the photo/video picker flow and is therefore
  // impossible to satisfy for an audio-only app — patched out via pnpm
  // (patches/expo-media-library.patch).
  await NextAsset.delete([new NextAsset(mediaAssetId)]);
}

export async function downloadTrack(sourceUrl: string, onProgress?: (percent: number) => void): Promise<Track> {
  const kind = detectLinkKind(sourceUrl);
  const id = generateId();
  const temp = tempDirectory();

  let title = 'Pista sin título';
  let artist = 'Desconocido';
  let coverBytes: Uint8Array | undefined;
  let downloadedFile: File;

  if (kind === 'youtube') {
    const metadata = await fetchYoutubeMetadata(sourceUrl).catch(() => null);
    if (metadata?.title) title = metadata.title;
    if (metadata?.artist) artist = metadata.artist;
    coverBytes = await fetchYoutubeCoverBytes(sourceUrl, metadata?.thumbnail ?? null);
    downloadedFile = await downloadYoutubeAudio(sourceUrl, temp, sanitizeFilename(title), onProgress);
  } else {
    downloadedFile = (await File.downloadFileAsync(sourceUrl, temp, { idempotent: true })) as File;
    const guessedName = downloadedFile.name.replace(/\.[^.]+$/, '');
    if (guessedName) title = guessedName;
  }

  const rawBytes = await downloadedFile.bytes();
  downloadedFile.delete();

  const taggedBytes = writeMp3Tags(rawBytes, { title, artist, coverBytes });

  const finalFile = uniqueFile(tracksDirectory(), sanitizeFilename(title), '.mp3');
  finalFile.create();
  finalFile.write(taggedBytes);

  let coverUri: string | null = null;
  if (coverBytes) {
    const coverFile = new File(tracksDirectory(), `${id}-cover.jpg`);
    if (coverFile.exists) coverFile.delete();
    coverFile.create();
    coverFile.write(coverBytes);
    coverUri = coverFile.uri;
  }

  const mediaAssetId = await publishToMediaLibrary(finalFile);

  const track: Track = {
    id,
    title,
    artist,
    album: '',
    coverUri,
    fileUri: finalFile.uri,
    mediaAssetId,
    sourceUrl,
    createdAt: Date.now(),
  };

  await addTrack(track);
  return track;
}

export interface MetadataPatch {
  title: string;
  artist: string;
  album?: string;
  coverBytes?: Uint8Array;
}

export async function updateTrackMetadata(id: string, patch: MetadataPatch): Promise<Track> {
  const existing = await getTrack(id);
  if (!existing) {
    throw new Error('Pista no encontrada');
  }

  const file = new File(existing.fileUri);
  const rawBytes = await file.bytes();

  let coverBytesForTag = patch.coverBytes;
  if (!coverBytesForTag && existing.coverUri) {
    coverBytesForTag = await new File(existing.coverUri).bytes();
  }

  const taggedBytes = writeMp3Tags(rawBytes, {
    title: patch.title,
    artist: patch.artist,
    album: patch.album,
    coverBytes: coverBytesForTag,
  });
  file.write(taggedBytes);

  let coverUri = existing.coverUri;
  if (patch.coverBytes) {
    const coverFile = new File(tracksDirectory(), `${id}-cover.jpg`);
    if (coverFile.exists) coverFile.delete();
    coverFile.create();
    coverFile.write(patch.coverBytes);
    coverUri = coverFile.uri;
  }

  await unpublishFromMediaLibrary(existing.mediaAssetId);
  const mediaAssetId = await publishToMediaLibrary(file);

  const updated = await updateTrack(id, {
    title: patch.title,
    artist: patch.artist,
    album: patch.album ?? existing.album,
    coverUri,
    mediaAssetId,
  });
  if (!updated) {
    throw new Error('No se pudo actualizar la pista');
  }
  return updated;
}

export async function deleteTrack(id: string): Promise<void> {
  const existing = await getTrack(id);
  if (!existing) return;

  try {
    new File(existing.fileUri).delete();
  } catch {
    // Already removed from disk — nothing to do.
  }
  if (existing.coverUri) {
    try {
      new File(existing.coverUri).delete();
    } catch {
      // Already removed from disk — nothing to do.
    }
  }
  await unpublishFromMediaLibrary(existing.mediaAssetId);
  await removeTrack(id);
}

export async function clearLibrary(): Promise<void> {
  const tracks = await listTracks();
  for (const track of tracks) {
    await deleteTrack(track.id);
  }
}

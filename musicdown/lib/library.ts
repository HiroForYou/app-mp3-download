import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Track } from './types';

const STORAGE_KEY = 'musicdown.tracks.v1';

async function readAll(): Promise<Track[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as Track[]) : [];
}

async function writeAll(tracks: Track[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tracks));
}

export async function listTracks(): Promise<Track[]> {
  const tracks = await readAll();
  return tracks.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getTrack(id: string): Promise<Track | null> {
  const tracks = await readAll();
  return tracks.find((t) => t.id === id) ?? null;
}

export async function addTrack(track: Track): Promise<void> {
  const tracks = await readAll();
  tracks.push(track);
  await writeAll(tracks);
}

export async function updateTrack(id: string, patch: Partial<Track>): Promise<Track | null> {
  const tracks = await readAll();
  const index = tracks.findIndex((t) => t.id === id);
  if (index === -1) return null;
  tracks[index] = { ...tracks[index], ...patch };
  await writeAll(tracks);
  return tracks[index];
}

export async function removeTrack(id: string): Promise<void> {
  const tracks = await readAll();
  await writeAll(tracks.filter((t) => t.id !== id));
}

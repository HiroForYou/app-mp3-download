export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUri: string | null;
  fileUri: string;
  mediaAssetId: string | null;
  sourceUrl: string;
  createdAt: number;
}

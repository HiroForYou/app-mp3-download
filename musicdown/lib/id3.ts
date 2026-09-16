import { ID3Writer } from 'browser-id3-writer';

// browser-id3-writer declares ImageType as a TS `const enum` (type-only, erased
// at compile time), but the package itself ships plain JS with no runtime
// `ImageType` export — so `ImageType.CoverFront` is `undefined` at runtime.
// Use the raw APIC picture-type value instead: 0x03 = "Cover (front)".
const COVER_FRONT = 0x03;

export interface TrackTags {
  title: string;
  artist: string;
  album?: string;
  coverBytes?: Uint8Array;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function writeMp3Tags(mp3Bytes: Uint8Array, tags: TrackTags): Uint8Array {
  const writer = new ID3Writer(toArrayBuffer(mp3Bytes));
  writer.setFrame('TIT2', tags.title);
  writer.setFrame('TPE1', [tags.artist]);
  if (tags.album) {
    writer.setFrame('TALB', tags.album);
  }
  if (tags.coverBytes) {
    try {
      writer.setFrame('APIC', {
        type: COVER_FRONT,
        data: toArrayBuffer(tags.coverBytes),
        description: 'Cover',
      });
    } catch (e) {
      // browser-id3-writer throws if it can't detect a known image format
      // (jpeg/png/gif/webp/...) from the bytes' magic number. Skip the cover
      // rather than losing the whole download over a bad thumbnail.
      console.warn('writeMp3Tags: skipping cover art -', e instanceof Error ? e.message : e);
    }
  }
  const taggedBuffer = writer.addTag();
  return new Uint8Array(taggedBuffer);
}

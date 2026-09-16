const YOUTUBE_HOSTS = ['youtube.com', 'youtu.be', 'music.youtube.com'];

export type LinkKind = 'youtube' | 'direct';

export function detectLinkKind(rawUrl: string): LinkKind {
  try {
    const { hostname } = new URL(rawUrl);
    const host = hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
    if (YOUTUBE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
      return 'youtube';
    }
  } catch {
    // Not a parseable URL — treat as direct and let the download step surface the error.
  }
  return 'direct';
}

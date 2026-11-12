import { spawn } from 'node:child_process';
import ffmpegStatic from 'ffmpeg-static';

// The package's types disagree with its ESM default export; it is the path to the binary.
const ffmpegPath = ffmpegStatic as unknown as string | null;

/** What WhatsApp accepts as an audio message. Browsers record WebM, which it rejects. */
const ACCEPTED = new Set(['audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/amr']);

export const needsConversion = (mime: string) => !ACCEPTED.has(mime.split(';')[0]!.trim());

/** Convert any recording to OGG/Opus, which shows as a voice note in WhatsApp. */
export function toOggOpus(input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error('ffmpeg is not available'));
    const p = spawn(ffmpegPath, ['-v', 'error', '-i', 'pipe:0', '-vn', '-c:a', 'libopus', '-b:a', '32k', '-ac', '1', '-ar', '16000', '-f', 'ogg', 'pipe:1']);
    const out: Buffer[] = [];
    let err = '';
    p.stdout.on('data', (d: Buffer) => out.push(d));
    p.stderr.on('data', (d: Buffer) => (err += d));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 && out.length ? resolve(Buffer.concat(out)) : reject(new Error(`ffmpeg failed (${code}): ${err.slice(0, 200)}`))));
    p.stdin.on('error', () => undefined); // ffmpeg may close the pipe early on bad input
    p.stdin.end(input);
  });
}

export async function forWhatsApp(data: Buffer, mime: string): Promise<{ data: Buffer; mime: string }> {
  return needsConversion(mime) ? { data: await toOggOpus(data), mime: 'audio/ogg' } : { data, mime: mime.split(';')[0]! };
}

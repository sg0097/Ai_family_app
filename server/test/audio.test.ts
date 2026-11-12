import { spawnSync } from 'node:child_process';
import ffmpegStatic from 'ffmpeg-static';

const ffmpegPath = ffmpegStatic as unknown as string;
import { describe, expect, it } from 'vitest';
import { forWhatsApp, needsConversion } from '../src/lib/audio.js';

describe('audio for WhatsApp', () => {
  it('knows which formats need converting', () => {
    expect(needsConversion('audio/webm;codecs=opus')).toBe(true);
    expect(needsConversion('audio/ogg')).toBe(false);
    expect(needsConversion('audio/mp4')).toBe(false);
  });
  it('turns a WebM recording into OGG/Opus', async () => {
    const made = spawnSync(ffmpegPath!, ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-c:a', 'libopus', '-f', 'webm', 'pipe:1'], { maxBuffer: 5_000_000 });
    expect(made.status).toBe(0);
    const out = await forWhatsApp(made.stdout, 'audio/webm;codecs=opus');
    expect(out.mime).toBe('audio/ogg');
    expect(out.data.subarray(0, 4).toString()).toBe('OggS');
  });
  it('rejects garbage instead of sending it', async () => {
    await expect(forWhatsApp(Buffer.from('not audio'), 'audio/webm')).rejects.toThrow();
  });
});

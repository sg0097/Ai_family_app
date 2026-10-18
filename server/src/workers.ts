import { Worker } from 'bullmq';
import { processInbound } from './conversation/processor.js';
import { connection, schedulerQueue } from './lib/queues.js';
import { tick } from './routines/scheduler.js';
import { sendOutbound, type OutboundJob } from './whatsapp/outbound.js';

export async function startWorkers() {
  // One repeatable tick per minute, shared across all worker processes.
  await schedulerQueue.upsertJobScheduler('tick', { every: 60_000 }, { name: 'tick' });

  const workers = [
    new Worker('scheduler', () => tick(), { connection, concurrency: 1 }),
    new Worker<{ messageId: string }>('inbound', (job) => processInbound(job.data.messageId), { connection, concurrency: 4 }),
    new Worker<OutboundJob>('outbound', (job) => sendOutbound(job.data), { connection, concurrency: 4 }),
  ];
  for (const w of workers) w.on('failed', (job, err) => console.error(`[${w.name}] job ${job?.id} failed:`, err.message));
  return workers;
}

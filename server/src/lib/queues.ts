import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from './env.js';
import type { OutboundJob } from '../whatsapp/outbound.js';

export const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const schedulerQueue = new Queue('scheduler', { connection });
export const inboundQueue = new Queue<{ messageId: string }>('inbound', { connection });
export const outboundQueue = new Queue<OutboundJob>('outbound', { connection });

const retry = { attempts: 3, backoff: { type: 'exponential', delay: 5_000 }, removeOnComplete: 1000, removeOnFail: 5000 };

export const enqueueInbound = (messageId: string) => inboundQueue.add('inbound', { messageId }, retry);
export const enqueueOutbound = (job: OutboundJob) => outboundQueue.add('outbound', job, retry);

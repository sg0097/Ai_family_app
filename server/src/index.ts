import { buildApp } from './app.js';
import { env } from './lib/env.js';
import { startWorkers } from './workers.js';

if (env.ROLE !== 'api') {
  await startWorkers();
  console.log('[workers] scheduler, inbound and outbound workers running');
}
if (env.ROLE !== 'worker') {
  const app = await buildApp();
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
}

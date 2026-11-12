import { defineConfig } from 'vitest/config';

// Modules that read env at import time get harmless values; tests never touch a database.
export default defineConfig({ test: { env: { DATABASE_URL: 'postgresql://x:x@localhost:1/x', JWT_SECRET: 'test-secret' } } });

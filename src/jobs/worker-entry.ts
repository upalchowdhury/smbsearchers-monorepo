/**
 * Worker entry point for background job processing.
 * Run with: npx tsx src/jobs/worker-entry.ts
 */
import './workers'; // Import and start workers
import { setupSchedules } from './scheduler';

console.log('[worker] Starting DealFlow background worker...');

async function main() {
    await setupSchedules();
    console.log('[worker] Workers started and schedules configured.');
    console.log('[worker] Press Ctrl+C to stop.');
}

main().catch(console.error);

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('[worker] Shutting down...');
    process.exit(0);
});

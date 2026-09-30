require('dotenv').config();
const mongoose = require('mongoose');
const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const URL = require('./models/url');

const QUEUE_NAME = 'analytics-queue';

// ---------- Redis (Upstash) ----------
const redisConnection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null, // mandatory for BullMQ workers
});

redisConnection.on('error', (err) => {
    console.error('Worker: Redis connection error:', err.message);
});

let analyticsWorker;

async function start() {
    // 1. Connect to MongoDB FIRST, then start consuming jobs
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Worker: MongoDB connected successfully');

    // 2. Start the worker
    analyticsWorker = new Worker(
        QUEUE_NAME,
        async (job) => {
            const { shortId, timestamp } = job.data;

            const result = await URL.findOneAndUpdate(
                { shortId },
                { $push: { visitArray: { timestamp } } }
            );

            // Short URL deleted or invalid: retrying will never help, so don't throw
            if (!result) {
                console.warn(`Worker: shortId "${shortId}" not found, skipping job ${job.id}`);
                return;
            }

            // NOTE: no try/catch on purpose.
            // If MongoDB fails, the error is thrown, the job is marked failed,
            // and BullMQ retries using the attempts/backoff set by the producer.
        },
        {
            connection: redisConnection,
            concurrency: 5,          // process 5 jobs in parallel
            drainDelay: 10,          // idle blocking wait in seconds (fewer Redis commands)
            stalledInterval: 60000,  // stalled-job check every 60s (default 30s)
        }
    );

    // 3. Events
    analyticsWorker.on('completed', (job) => {
        console.log(`Job ${job.id} done`);
    });

    analyticsWorker.on('failed', (job, err) => {
        const attempts = job?.opts?.attempts ?? 1;
        console.error(
            `Job ${job?.id} failed (attempt ${job?.attemptsMade}/${attempts}):`,
            err.message
        );
    });

    // Without this listener, worker-level errors can crash the process
    analyticsWorker.on('error', (err) => {
        console.error('Worker error:', err.message);
    });

    console.log('Worker is running and waiting for jobs in Redis...');
}

// ---------- Graceful shutdown ----------
async function shutdown(signal) {
    console.log(`\n${signal} received, shutting down gracefully...`);
    try {
        if (analyticsWorker) await analyticsWorker.close(); // waits for active jobs
        await mongoose.disconnect();
        await redisConnection.quit();
        console.log('Worker: shutdown complete');
        process.exit(0);
    } catch (err) {
        console.error('Worker: error during shutdown:', err);
        process.exit(1);
    }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch((err) => {
    console.error('Worker failed to start:', err);
    process.exit(1);
});
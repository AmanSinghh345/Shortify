const { encodeBase62 } = require('./base62');

// ================= Classic Snowflake ID (no database needed) =================
//
// Every ID is built from 3 parts packed into one 63-bit number (the 64th bit is
// the unused sign bit, exactly like Twitter's original Snowflake):
//
//   | 41 bits: milliseconds since our epoch | 10 bits: instance id | 12 bits: sequence |
//
//   - timestamp -> time moves forward, so IDs made at different times never match
//   - instance  -> two servers can never make the same ID (each has its own number)
//   - sequence  -> counts 0,1,2... for IDs made by one server in the same millisecond
//
// Capacity: 1024 instances, 4096 IDs per millisecond per instance, about 69 years.
// A 63-bit number needs 11 base62 characters.

const TIMESTAMP_BITS = 41n;
const INSTANCE_BITS = 10n;
const SEQUENCE_BITS = 12n;
const TOTAL_BITS = TIMESTAMP_BITS + INSTANCE_BITS + SEQUENCE_BITS;   // 63

const EPOCH_MS = 1767225600000;                           // 1 Jan 2026 00:00:00 UTC
const MAX_INSTANCE = (1 << Number(INSTANCE_BITS)) - 1;    // 1023
const MAX_SEQUENCE = (1 << Number(SEQUENCE_BITS)) - 1;    // 4095
const MAX_TIMESTAMP = 2 ** Number(TIMESTAMP_BITS);

// Which server is this? Set INSTANCE_ID (0-1023) in .env. Every running copy
// of the backend MUST have a different number.
const instanceId = Number(process.env.INSTANCE_ID || 0);
if (!Number.isInteger(instanceId) || instanceId < 0 || instanceId > MAX_INSTANCE) {
    throw new Error(`INSTANCE_ID must be a whole number from 0 to ${MAX_INSTANCE}`);
}

let lastTimestamp = 0;
let sequence = 0;

function nextSnowflake() {
    const now = Date.now() - EPOCH_MS;

    if (now > lastTimestamp) {
        // A new millisecond started: reset the sequence.
        lastTimestamp = now;
        sequence = 0;
    } else {
        // Same millisecond (or the clock moved backwards): keep counting.
        sequence++;
        if (sequence > MAX_SEQUENCE) {
            // Used all 4096 slots for this millisecond: borrow the next one.
            // The (timestamp, sequence) pair always moves forward, so no duplicates.
            lastTimestamp++;
            sequence = 0;
        }
    }

    if (lastTimestamp >= MAX_TIMESTAMP) {
        throw new Error('Timestamp bits exhausted');
    }

    // Pack the 3 parts into one number using bit shifts.
    return (
        (BigInt(lastTimestamp) << (INSTANCE_BITS + SEQUENCE_BITS)) |
        (BigInt(instanceId) << SEQUENCE_BITS) |
        BigInt(sequence)
    );
}

// ---- Scramble: so links don't look like time-ordered counters ----
// Two kinds of steps are used, and BOTH are one-to-one mappings
// (different inputs can never give the same output), so uniqueness is kept:
//   1. multiply by an ODD number, keeping only the lowest 63 bits
//   2. xor-shift: x ^ (x >> 31)  -> mixes the high bits down into the low bits
// Repeating them makes neighbouring IDs look completely unrelated.
const MASK = (1n << TOTAL_BITS) - 1n;       // keeps only the lowest 63 bits
const KEY_1 = 0xBF58476D1CE4E5B9n;          // odd
const KEY_2 = 0x94D049BB133111EBn;          // odd

function scramble(n) {
    let x = n;
    x ^= x >> 31n;
    x = (x * KEY_1) & MASK;
    x ^= x >> 31n;
    x = (x * KEY_2) & MASK;
    x ^= x >> 31n;
    return x;
}

// How many base62 characters do we need to hold a 63-bit number? -> 11
let ID_LENGTH = 1;
while (62n ** BigInt(ID_LENGTH) < (1n << TOTAL_BITS)) ID_LENGTH++;

// Controller does `await generateShortId()`, which works fine with a normal value.
function generateShortId() {
    return encodeBase62(scramble(nextSnowflake()), ID_LENGTH);
}

module.exports = { generateShortId, ID_LENGTH };
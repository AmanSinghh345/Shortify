require('dotenv').config();
const { generateShortId } = require('../utils/generateId');
const URL=require('../models/url');
const redis=require('redis');
const { Queue } = require('bullmq');
const IORedis = require('ioredis');

//Redis Client Setup 
const redisClient=redis.createClient({url:process.env.REDIS_URL});
redisClient.on('error',(err)=>console.log('Redis Error: ' ,err)); 
redisClient.connect().then(()=>console.log("Upstash Redis Connected"));

// Upstash Redis connection for the Queue
const redisConnection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null
});

// ---------------- Custom alias rules ----------------
// 3-10 characters: letters, numbers, - and _ only.
// Max 10 on purpose: generated Snowflake IDs are always 11 characters,
// so an alias can never be equal to a generated ID.
const ALIAS_REGEX = /^[A-Za-z0-9_-]{3,10}$/;

// Words we keep for ourselves (future routes like /login or /api).
const RESERVED_ALIASES = new Set([
    'api', 'url', 'urls', 'login', 'logout', 'signup', 'register', 'auth', 'oauth',
    'admin', 'dashboard', 'health', 'stats', 'analytics', 'static', 'assets',
    'docs', 'help', 'about', 'terms', 'privacy', 'settings', 'account',
]);

// Returns an error message if the alias is not allowed, or null if it is fine.
function validateAlias(alias) {
    if (typeof alias !== 'string') return 'Alias must be text';
    if (!ALIAS_REGEX.test(alias)) {
        return 'Alias must be 3-10 characters: letters, numbers, - or _';
    }
    if (RESERVED_ALIASES.has(alias.toLowerCase())) {
        return 'This alias is reserved, please choose another';
    }
    return null;
}

// ---------------- Expiry options ----------------
// The frontend sends a name like "7d". WE decide what it means in seconds,
// so a user can never send a weird value like "999999999999".
const EXPIRY_OPTIONS = {
    '1h': 60 * 60,
    '1d': 24 * 60 * 60,
    '7d': 7 * 24 * 60 * 60,
    '30d': 30 * 24 * 60 * 60,
};

//Generate New URL
const MAX_RETRIES = 3;

async function GenerateNewShortURL(req,res){
    const body = req.body || {};
    const url = body.url;
    const alias = typeof body.alias === 'string' ? body.alias.trim() : body.alias;
    const expiresIn = body.expiresIn;

    if(!url || typeof url !== 'string'){
        return res.status(400).json({error:'Url is Required'});
    }

    // ---- Work out the expiry date (null = never) ----
    let expiresAt = null;
    if (expiresIn && expiresIn !== 'never') {
        if (!Object.hasOwn(EXPIRY_OPTIONS, expiresIn)) {
            return res.status(400).json({ error: 'Invalid expiry option' });
        }
        expiresAt = new Date(Date.now() + EXPIRY_OPTIONS[expiresIn] * 1000);
    }

    // Small helper so we don't repeat ourselves below
    const saveLink = (shortId) => URL.create({
        shortId,
        longUrl: url,
        expiresAt,
        visitArray: [],
    });

    try{
        // ---- Path 1: the user chose a custom alias ----
        const wantsAlias = alias !== undefined && alias !== null && alias !== '';
        if (wantsAlias) {
            const aliasError = validateAlias(alias);
            if (aliasError) return res.status(400).json({ error: aliasError });

            try {
                await saveLink(alias);
                return res.json({ id: alias, expiresAt });
            } catch (error) {
                // 11000 = duplicate key: someone already owns this alias.
                // The unique index decides who was first, even if two people
                // submit the same alias at the same moment.
                if (error.code === 11000) {
                    return res.status(409).json({ error: 'This alias is already taken, try another' });
                }
                throw error;
            }
        }

        // ---- Path 2: no alias, generate a Snowflake ID ----
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            const shortID = await generateShortId();   // new Snowflake ID, in base62
            try{
                await saveLink(shortID);
                return res.json({ id: shortID, expiresAt });
            }
            catch(error){
                // 11000 = "duplicate key": this ID is already taken.
                // Just generate the next one and try again.
                if (error.code === 11000) continue;
                throw error;   // any other error -> handled by the outer catch
            }
        }
        // All retries used up (should basically never happen)
        return res.status(500).json({ error: 'Could not generate a unique ID, try again' });
    }
    catch(error){
        console.error('Generate URL Error:', error);
        return res.status(500).json({ error: 'Server Error' });
    }
}

// Create the Producer Queue (Name must exactly match the worker's queue)
const analyticsQueue = new Queue('analytics-queue', { connection: redisConnection });

// NEW: put a link in the Redis cache.
// Links with an expiry get a Redis TTL equal to the time they have left, so Redis
// forgets them at the same moment they expire. Without this, the cache would keep
// redirecting after the link has expired.
async function cacheLink(entry) {
    if (!entry.expiresAt) {
        await redisClient.set(entry.shortId, entry.longUrl);
        return;
    }
    const msLeft = entry.expiresAt.getTime() - Date.now();
    if (msLeft > 0) {
        // PX = expire after this many milliseconds
        await redisClient.set(entry.shortId, entry.longUrl, {
            expiration: { type: 'PX', value: msLeft },
        });
    }
}

//Redirect 
async function handleRedirectURL(req, res) {
    const shortId = req.params.shortId;
    try {
        // 1. Check in Redis Cache
        // (an expired link is no longer here, because its Redis TTL ran out)
        const cacheUrl = await redisClient.get(shortId);

        if (cacheUrl) {
            // CACHE HIT: Queue mein job bhejo aur turant redirect karo
            await analyticsQueue.add('record-click', {
                shortId: shortId,
                timestamp: Date.now()
            });
            return res.redirect(cacheUrl);
        }

        // 2. CACHE MISS: Sirf DB se URL 'Read' karo (Update nahi karna hai)
        const entry = await URL.findOne({ shortId });
        
        if (!entry) return res.status(404).json({ error: "Url Not Found" });

        // NEW: the TTL index deletes expired links only about once a minute,
        // so we must check the date ourselves. 410 = "Gone" (it existed, now it doesn't).
        if (entry.expiresAt && entry.expiresAt.getTime() <= Date.now()) {
            return res.status(410).json({ error: "This link has expired" });
        }

        // Queue mein job bhejo
        await analyticsQueue.add('record-click', {
            shortId: shortId,
            timestamp: Date.now()
        });

        // Naye URL ko Redis Cache mein daal do future ke liye (with TTL if it expires)
        await cacheLink(entry);

        // Redirect user
        return res.redirect(entry.longUrl);
        
    } catch (error) {
        console.error("Redirect Error:", error);
        return res.status(500).json({ error: "Server Error" });
    }
}


module.exports = {
    GenerateNewShortURL,
    handleRedirectURL
};
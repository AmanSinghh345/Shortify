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

//Generate New URL
const MAX_RETRIES = 3;

async function GenerateNewShortURL(req,res){
    const body=req.body;
    if(!body.url){
        return res.status(400).json({error:'Url is Required'});
    }

    try{
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            const shortID = await generateShortId();   // new Snowflake ID, in base62
            try{
                await URL.create({
                    shortId: shortID,
                    longUrl: body.url,
                    visitArray: [],
                });
                return res.json({id: shortID});
            }
            catch(error){
                // 11000 = "duplicate key": this ID is already taken
                // (can happen later, e.g. if someone picked it as a custom alias).
                // Just ask the counter for the next one and try again.
                if (error.code === 11000) continue;
                throw error;   
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

//Redirect 
async function handleRedirectURL(req, res) {
    const shortId = req.params.shortId;
    try {
        // 1. Check in Redis Cache
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

        // Queue mein job bhejo
        await analyticsQueue.add('record-click', {
            shortId: shortId,
            timestamp: Date.now()
        });

        // Naye URL ko Redis Cache mein daal do future ke liye
        await redisClient.set(shortId, entry.longUrl);

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
require('dotenv').config();
const {nanoid}=require('nanoid');
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
async function GenerateNewShortURL(req,res){
    const body=req.body;
    if(!body.url){
        return res.status(400).json({error:'Url is Required'});
    }
    const shortID=nanoid(7);
    try{
          await URL.create(
            {
                shortId:shortID,
                longUrl:body.url,
                visitArray:[],
            }
        );
        return res.json({id:shortID});
    }
    catch(error){
      if (error.code == 11000) {
            return res.status(500).json({ error: 'Collision occured, try again' });
        }
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
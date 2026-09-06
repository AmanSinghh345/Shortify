const {nanoid}=require('nanoid');
const URL=require('../models/url');

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

//Redirect 
async function handleRedirectURL(req, res) {
    const shortId = req.params.shortId;
    try {
        const entry = await URL.findOneAndUpdate(
            { shortId },
            { $push: { visitArray: { timestamp: Date.now() } } }
        );
        if (!entry) return res.status(404).json({ error: "Url Not Found" });
        return res.redirect(entry.longUrl);
    } catch (error) {
        return res.status(500).json({ error: "Server Error" });
    }
}


module.exports = {
    GenerateNewShortURL,
    handleRedirectURL
};
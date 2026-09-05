const express=require('express');
const mongoose=require('mongoose');
const {nanoid}=require('nanoid');
const URL=require('./models/url');
const app=express();

app.use(express.json());


mongoose.connect('mongodb://localhost:27017/url-shortner')
        .then(()=>console.log("mongodb connected "))
        .catch((err)=>console.log("mongodb error ",err));

app.get('/',(req,res)=>{
    res.send("hello to my website server");
})

app.post('/url',async (req,res) => {
    const body=req.body;
    if(!body.url){
       return  res.status(400).json({error:'url is required'});
    }

    const shortID=nanoid(7);
    try{
       await  URL.create({
        shortId :shortID,
        longUrl : body.url,
        visitArray:[],
       });

       return res.json({id:shortID});
    }
    catch(error){
        if(error.code==11000){
          return   res.status(500).json({error:'Collision occured,try again'});
        }
        else  return  res.status(500).json({error:'Server Error'});
    }
});

app.get('/:shortId',async (req,res)=>{
    const shortId=req.params.shortId;
    try{
        const entry=await URL.findOneAndUpdate(
            {shortId},
            {
                $push:{
                    visitArray:{timestamp:Date.now()}
                }
            }
        );
        if(!entry){
            return res.status(404).json({error:"Url Not Found"});
        }
        return res.redirect(entry.longUrl);
    }
    catch(error){
        return res.status(500).json({error:"Server Error"});
    }
});

const port=8000;
app.listen(port,()=> {console.log(`server is running on port ${port}`)
});

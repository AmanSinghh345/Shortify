const express=require('express');
const mongoose=require('mongoose');
const urlRoute=require('./routes/url');
const app=express();

app.use(express.json());


mongoose.connect('mongodb://localhost:27017/url-shortner')
        .then(()=>console.log("mongodb connected "))
        .catch((err)=>console.log("mongodb error ",err));

app.get('/',(req,res)=>{
    res.send("hello to my website server");
})

app.use('/',urlRoute);

const port=8000;
app.listen(port,()=> {console.log(`server is running on port ${port}`)
});

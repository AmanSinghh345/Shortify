require('dotenv').config();
const express=require('express');
const mongoose=require('mongoose');
const urlRoute=require('./routes/url');
const app=express();
const cors=require('cors');

app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI)
        .then(()=>console.log("mongodb connected "))
        .catch((err)=>console.log("mongodb error ",err));

app.get('/',(req,res)=>{
    res.send("hello to my website server");
})

app.use('/',urlRoute);

const port=process.env.PORT || 8000;
app.listen(port,()=> {console.log(`server is running on port ${port}`)
});

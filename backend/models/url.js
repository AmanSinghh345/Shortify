const mongoose=require('mongoose');

const urlSchema=new mongoose.Schema({
    shortId : {
        type:String,
        required:true,
        unique:true
    },
    longUrl : {
        type:String,
        required:true
    },
    // NEW: when the link stops working. null = never expires.
    expiresAt : {
        type:Date,
        default:null
    },
    visitArray : [{timestamp : { type : Number}}] 
},{timestamps:true});

// NEW: TTL index. MongoDB checks this index about once a minute and automatically
// deletes documents whose expiresAt date has passed.
// expireAfterSeconds: 0 means "delete exactly at expiresAt, with no extra delay".
// Documents where expiresAt is null are never deleted.
urlSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const URL=mongoose.model('url',urlSchema);

module.exports=URL;
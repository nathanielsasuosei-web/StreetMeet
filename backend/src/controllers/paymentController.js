import prisma from "../config/prisma.js";


export async function createSubscription(req,res){

try{

const userId=req.user.id;

const {
plan,
amount
}=req.body;


const subscription =
await prisma.subscription.create({

data:{

userId,

plan,

amount,

paymentReference:
"STREET-"+Date.now(),

active:false,

expiresAt:
new Date(
Date.now()+30*24*60*60*1000
)

}

});


res.json({

message:
"Payment initiated",

subscription

});


}catch(error){

res.status(500).json({
message:error.message
});

}

}import Subscription from "../models/Subscription.js";


export const createPayment = async(req,res)=>{

try{

const {plan,amount}=req.body;


const payment = await Subscription.create({

user:req.user.id,

plan,

amount,

status:"pending"

});


res.json({

message:"Payment created",

payment

});


}
catch(error){

res.status(500)
.json({
error:error.message
});

}

};
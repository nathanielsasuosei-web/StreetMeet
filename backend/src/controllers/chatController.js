import prisma from "../config/prisma.js";


export async function getMessages(req,res){

try{

const userId=req.user.id;

const otherUser=req.params.userId;


const messages =
await prisma.message.findMany({

where:{
OR:[
{
senderId:userId,
receiverId:otherUser
},
{
senderId:otherUser,
receiverId:userId
}
]
},

orderBy:{
createdAt:"asc"
}

});


res.json(messages);


}catch(error){

res.status(500).json({
message:error.message
});

}

}
import prisma from "../config/prisma.js";


// Get people to discover

export async function discoverUsers(req,res){

try{

const users = await prisma.user.findMany({

where:{
id:{
not:req.user.id
}
},

select:{
id:true,
fullName:true,
bio:true,
city:true,
profileImage:true
}

});


res.json(users);


}catch(error){

res.status(500).json({
message:error.message
});

}

}


// Like a user

export async function likeUser(req,res){

try{

const currentUser=req.user.id;

const targetUser=req.params.id;


// Save like

await prisma.like.create({

data:{
fromUserId:currentUser,
toUserId:targetUser
}

});


// Check if they liked back

const match =
await prisma.like.findFirst({

where:{
fromUserId:targetUser,
toUserId:currentUser
}

});


if(match){

await prisma.match.create({

data:{
userOneId:currentUser,
userTwoId:targetUser
}

});


return res.json({
message:"It's a match ❤️"
});

}


res.json({
message:"Like sent"
});


}catch(error){

res.status(500).json({
message:error.message
});

}

}
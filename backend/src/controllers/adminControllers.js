import prisma from "../config/prisma.js";


export async function getUsers(req,res){

try{

const users =
await prisma.user.findMany({

select:{
id:true,
fullName:true,
email:true,
role:true,
verified:true
}

});


res.json(users);


}catch(error){

res.status(500).json({
message:error.message
});

}

}



export async function verifyUser(req,res){

try{

const userId=req.params.id;


const user =
await prisma.user.update({

where:{
id:userId
},

data:{
verified:true
}

});


res.json({

message:"User verified",
user

});


}catch(error){

res.status(500).json({
message:error.message
});

}

}
import prisma from "../config/prisma.js";
import { hashPassword, comparePassword } from "../utils/hash.js";
import { createToken } from "../utils/jwt.js";


export async function register(req, res){

    try {

        const {
            fullName,
            email,
            password,
            gender
        } = req.body;


        const existingUser = await prisma.user.findUnique({
            where:{
                email
            }
        });


        if(existingUser){
            return res.status(400).json({
                message:"Email already exists"
            });
        }


        const hashedPassword = await hashPassword(password);


        const user = await prisma.user.create({

            data:{
                fullName,
                email,
                password:hashedPassword,
                gender
            }

        });


        const token = createToken(user.id);


        res.json({

            message:"Account created successfully",
            token,
            user:{
                id:user.id,
                fullName:user.fullName,
                email:user.email
            }

        });


    } catch(error){

        res.status(500).json({
            message:error.message
        });

    }

}


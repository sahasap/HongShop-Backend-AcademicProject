import database from "../services/database.js"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import multer from "multer"
import { promises as fs } from 'fs'
import path from 'path'

const profileStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'img_mem');
    },
    filename: function (req, file, cb) {
        const filename = `${req.member.memEmail}.jpg`; 
        cb(null, filename);
    }
});

export const uploadProfileImageMiddleware = multer({ storage: profileStorage }).single('file');

export async function NewMember(req,res) {
    console.log(`POST /members is Requested`);
    const { memEmail, memName, password } = req.body;

    try {
        if (!memEmail || !memName || !password) {
            return res.status(400).json({ message: `ERROR: memEmail, memName, and password are required`, regist: false });
        }

        const chkRow = await database.query({
            text: `SELECT * FROM members WHERE "memEmail" = $1`,
            values: [memEmail]
        });

        if (chkRow.rowCount != 0) {
            return res.status(409).json({ message: `ERROR: memEmail ${memEmail} already exists`, regist: false });
        }

        const saltround = 11;
        const pwdHash = await bcrypt.hash(password, saltround);

        await database.query({
            text: `INSERT INTO "members" ("memEmail", "memName", "memHash") VALUES ($1, $2, $3)`,
            values: [memEmail, memName, pwdHash]
        });

        const sourcePath = path.join('img_mem', 'default.jpg');
        const destinationPath = path.join('img_mem', `${memEmail}.jpg`);
        await fs.copyFile(sourcePath, destinationPath);
        console.log(`Default image assigned to new member: ${memEmail}`);

        res.status(201).json({
            message: "Registration successful. A default profile image has been assigned.",
            regist: true,
            data: { memEmail, memName }
        });

    } catch (err) {
        console.error("Error in NewMember:", err);
        return res.status(500).json({ message: err.message, regist: false });
    }
}

export async function LoginMember(req,res) {
    console.log(`POST /loginMembers is Requested`)
    const bodyData = req.body
    try{
        if (!bodyData.loginName || !bodyData.password) {
            return res.json({message: `ERROR: loginName and password is Required`})
        }
        
        const result = await database.query({
            text: `SELECT * FROM members WHERE "memEmail" = $1 OR "memName" = $1`,
            values: [req.body.loginName]
        })

        if (result.rowCount == 0) {
            return res.json({message: `Login Fail`, login:false})
        }

        const loginOk = await bcrypt.compare(req.body.password, result.rows[0].memHash)
        
        if(loginOk){
            const theuser = {
                memEmail: result.rows[0].memEmail,
                memName: result.rows[0].memName,
                dutyId: result.rows[0].dutyId
            }
            const secret_key = process.env.SECRET_KEY
            const token = jwt.sign(theuser, secret_key, {expiresIn:'1h'})
            
            res.cookie('token', token, {
                httpOnly: true, 
                secure: true,
                sameSite: 'strict' 
            })

            res.json({message: `Login Success`, login:true, user: theuser ,token: token})
        } else {
            res.json({message: `Login Fail`, login:false})
        }
    }
    catch(err){
        return res.json({
            message: err.message
        })
    }
}

export async function getMember(req,res) {
    console.log(`GET /getMember is Requested`)
    const token = req.cookies.token
    if(!token)
        return res.json({message: `No member`,login:false})
    try{
        const secret_key = process.env.SECRET_KEY
        const member = jwt.verify(token,secret_key)
        console.log(member)
        return res.json({
            memEmail: member.memEmail,
            memName: member.memName,
            dutyId: member.dutyId,
            login:true
        })
    }
    catch(err){
        console.log(member)
        return res.json({
            message: `The information was falsified.`,login:false
        })
    }
}

export async function editRole(req,res) {
    console.log(`PUT /members/role is Requested to change member role`);
    
    const { memEmail, dutyId } = req.body; 

    if (!memEmail || !dutyId) {
        return res.status(400).json({ 
            message: 'Missing memEmail or new dutyId in request body.' 
        });
    }
    if (dutyId !== 'admin' && dutyId !== 'member') {
        return res.status(400).json({ 
            message: 'Invalid dutyId. Must be "admin" or "member".' 
        });
    }
    
    try {
        const strQry = `UPDATE members
                        SET "dutyId" = $1
                        WHERE "memEmail" = $2
                        RETURNING *`;

        const result = await database.query(strQry, [dutyId, memEmail]);

        if (result.rowCount === 0) {
            return res.status(404).json({ 
                message: `Member with email ${memEmail} not found.` 
            });
        }
        
        const updatedMember = result.rows[0];
        return res.status(200).json({
            message: `Role for member ${updatedMember.memEmail} updated successfully to ${updatedMember.dutyId}.`,
            member: {
                memEmail: updatedMember.memEmail,
                dutyId: updatedMember.dutyId
            }
        });

    } catch(err) {
        console.error("Error in editRole:", err);
        return res.status(500).json({
            message: 'An error occurred while updating the member role.',
            error: err.message
        });
    }
}

export async function editProfile(req,res) {
    const { memEmail } = req.member;
    const { memName, password } = req.body;

    try {
        const queryParts = [];
        const queryParams = [];
        let paramIndex = 1;
        let newImagePath = null;

        if (memName && memName.trim() !== '') {
            queryParts.push(`"memName" = $${paramIndex++}`);
            queryParams.push(memName);
        }

        if (password && password.trim() !== '') {
            const memHash = await bcrypt.hash(password, 11);
            queryParts.push(`"memHash" = $${paramIndex++}`);
            queryParams.push(memHash);
        }

        if (req.file) {
            newImagePath = `${memEmail}.jpg`; 
            
            queryParts.push(`"mem_image_url" = $${paramIndex++}`); 
            queryParams.push(newImagePath);
        }

        if (queryParts.length === 0 && !req.file) {
            return res.status(400).json({ message: 'No name, password, or image file provided for update.' });
        }
        
        if (queryParts.length > 0) {
            queryParams.push(memEmail);
            const updateQuery = `UPDATE members SET ${queryParts.join(', ')} WHERE "memEmail" = $${paramIndex} RETURNING *`;
            await database.query(updateQuery, queryParams);
        }
        
        let message = '';
        if (queryParts.length > 0 && req.file) {
            message = 'Profile details and image updated successfully.';
        } else if (queryParts.length > 0) {
            message = 'Profile details updated successfully.';
        } else if (req.file) {
            message = 'Profile image updated successfully.';
        }

        const responseData = { message };

        if (newImagePath) {
            responseData.newImagePath = newImagePath;
        }

        return res.status(200).json({ message });

    } catch (err) {
        console.error("Error in editProfile:", err);
        return res.status(500).json({ message: 'An error occurred during profile update.', error: err.message });
    }
}

export async function LogoutMember(req,res) {
    console.log(`GET /logoutMember is Requested`)
    try{
        res.clearCookie('token',{
            httpOnly: true,
            secure: true,
            sameSite: 'strict'
        })
        res.json({message: `Logout Success`, logout:true})
    }
    catch(err){
        return res.json({
            message: err.message
        })
    }
}

export async function getAllmember(req,res) {
    console.log(`GET /members is Requested`)
    try{
        const strQry = `SELECT m.* FROM members m 
                        ORDER BY m."memEmail"`

        const result = await database.query(strQry)
        return res.status(200).json(result.rows)
    }
    catch(err){
        return res.status(500).json({
            message:err.message
        })
    }
}
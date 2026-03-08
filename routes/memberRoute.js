import express from "express"
import * as memberC from "../controllers/memberController.js"
import { isAdmin } from "../services/authAdmin.js"
import { authenticateToken } from "../services/authAdmin.js"

const router = express.Router()

router.get('/members/detail',authenticateToken,memberC.getMember)
router.post('/members/logout',memberC.LogoutMember)
router.post('/members/register', memberC.NewMember)
router.post('/members/login',memberC.LoginMember)
router.put('/members/role',authenticateToken,isAdmin,memberC.editRole)
router.put('/members/profile', authenticateToken, memberC.uploadProfileImageMiddleware, memberC.editProfile)
router.get('/members',authenticateToken,isAdmin,memberC.getAllmember)

export default router
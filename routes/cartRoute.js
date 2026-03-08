import express from "express"
import * as cartC from "../controllers/cartController.js"
import { isAdmin , authenticateToken } from "../services/authAdmin.js"

const router = express.Router()

router.post('/carts/chkcart', authenticateToken, cartC.chkCart)
router.post('/carts/addcart', authenticateToken, cartC.postCart)
router.post('/carts/addcartdtl', authenticateToken, cartC.postCartDtl)
router.get('/carts/sumcart/:id', authenticateToken, cartC.sumCart)
router.get('/carts/getcart/:id', authenticateToken, cartC.getCart)
router.get('/carts/getcartdtl/:id', authenticateToken, cartC.getCartDtl)
router.post('/carts/getcartbycus', authenticateToken, cartC.getCartByCus)
router.delete('/carts/delcartdtl', authenticateToken, cartC.delCartDtl)
router.delete('/carts/delcart', authenticateToken, cartC.delCart)
router.put('/carts/updateqtydtl/:cartId/:pdId', authenticateToken, cartC.updateQtyDtl)
router.post('/carts/confirm/:id', authenticateToken, cartC.confirmCart)
router.get('/carts/history', authenticateToken, cartC.getCartHistory) 
router.post('/admin/history', authenticateToken, isAdmin, cartC.getCartByEmail)
router.get('/admin/orders', authenticateToken, isAdmin, cartC.getAllConfirmedOrders);

export default router
import express from "express"
import * as productC from "../controllers/productController.js"
import { authenticateToken , isAdmin } from "../services/authAdmin.js"

const router = express.Router()

router.get('/products',productC.getAllProducts)
router.get('/products/pdtypes', productC.getAllPdTypes);
router.get('/products/brands', productC.getAllBrands);
router.get('/products/featured', productC.getFeaturedProducts); 
router.get('/products/:id',productC.getProductById)
router.post('/products',authenticateToken , isAdmin,productC.AddNewProduct)
router.delete('/products/:id',authenticateToken , isAdmin,productC.deleteProduct)
router.get('/products/brands/:id',productC.getProductByBrandId)
router.get('/products/search/:id',productC.getSearchProduct)
router.put('/products/:id', authenticateToken, isAdmin,productC.uploadImageMiddleware, productC.editProduct)


export default router
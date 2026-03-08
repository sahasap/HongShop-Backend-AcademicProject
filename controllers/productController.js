import database from "../services/database.js"
import multer from "multer"
import { promises as fs } from 'fs'
import path from 'path'

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'img_pd');
    },
    filename: function (req, file, cb) {
        const filename = `${req.params.id}.jpg`;
        cb(null, filename);
    }
});

export const uploadImageMiddleware = multer({ storage: storage }).single('file');

export async function getAllProducts(req,res) {
    console.log(`GET /products is Requested`)
    try{
        const strQry = `SELECT p.* ,
                        (
                            SELECT row_to_json(brand_obj)
                            FROM (SELECT "brandId","brandName"
                                    FROM brands
                                    WHERE "brandId"=p."brandId")brand_obj
                        )AS brand,
                        (
                            SELECT row_to_json(pdt_obj)
                            FROM (SELECT "pdTypeId","pdTypeName"
                                    FROM "pdTypes"
                                    WHERE "pdTypeId"=p."pdTypeId")pdt_obj
                        )AS pdt
                        FROM products p `

        const result = await database.query(strQry)
        return res.status(200).json(result.rows)
    }
    catch(err){
        return res.status(500).json({
            message:err.message
        })
    }
}

export async function getProductById(req,res) {
    console.log(`GET /products/id is Requested`)
    try{
        const result = await database.query({
            text: `SELECT p.* ,
                        (
                            SELECT row_to_json(brand_obj)
                            FROM (SELECT "brandId","brandName"
                                    FROM brands
                                    WHERE "brandId"=p."brandId")brand_obj
                        )AS brand,
                        (
                            SELECT row_to_json(pdt_obj)
                            FROM (SELECT "pdTypeId","pdTypeName"
                                    FROM "pdTypes"
                                    WHERE "pdTypeId"=p."pdTypeId")pdt_obj
                        )AS pdt
                        FROM products p 
                        WHERE p."pdId" = $1`,
            values:[req.params.id]
        })
        return res.status(200).json(result.rows)
    }
    catch(err){
        return res.status(500).json({
            message:err.message
        })
    }
}

export async function AddNewProduct(req, res) {
    console.log(`POST /products is Requested`);
    const { pdId, pdName, pdPrice, pdTypeId, brandId } = req.body;

    if (!pdId) {
        return res.status(400).json({ message: "Product ID (pdId) is required." });
    }

    // 💡 1. กำหนดชื่อไฟล์รูปภาพ
    const newImagePath = `${pdId}.jpg`; 

    try {
        await database.query({
            text: ` INSERT INTO products ("pdId", "pdName", "pdPrice", "pdTypeId", "brandId", "pd_image_url")
                    VALUES ($1, $2, $3, $4, $5, $6)`,

            values: [pdId, pdName, pdPrice, pdTypeId, brandId, newImagePath] 
        });

        const sourcePath = path.join('img_pd', 'default.jpg');
        const destinationPath = path.join('img_pd', newImagePath);
        
        await fs.copyFile(sourcePath, destinationPath);
        console.log(`Default image copied for product: ${pdId}`);

        res.status(201).json({
            message: "Product created successfully with a default image.",
            data: req.body
        });

    } catch (err) {
        console.error("Error creating product:", err);
        return res.status(500).json({ message: err.message });
    }
}

export async function editProduct(req, res) {
        console.log(`PUT /products/${req.params.id} is Requested`);
        const { id } = req.params;
        const fieldsToUpdate = req.body;
    
        try {
            const setClauses = [];
            const values = [];
            let paramIndex = 1;
    
            const allowedColumns = ['pdName', 'pdPrice', 'pdRemark', 'pdTypeId', 'brandId'];
    
            allowedColumns.forEach(col => {
                if (fieldsToUpdate[col] !== undefined) {
                    setClauses.push(`"${col}" = $${paramIndex++}`);
                    values.push(fieldsToUpdate[col]);
                }
            });
    
            if (req.file) {
                const newImagePath = req.file.filename; 
                
                setClauses.push(`"pd_image_url" = $${paramIndex++}`);
                values.push(newImagePath);
            }
    
            if (setClauses.length > 0) {
                values.push(id);
                const queryText = `UPDATE "products" SET ${setClauses.join(', ')} WHERE "pdId" = $${paramIndex}`;
                
                const result = await database.query({ text: queryText, values: values });
                if (result.rowCount === 0) {
                    return res.status(404).json({ message: `Product with id ${id} not found.` });
                }
            }
    
            let message = '';
            if (setClauses.length > 1 && req.file) {
                message = 'Product details and image updated successfully.';
            } else if (setClauses.length > 0 && !req.file) {
                message = 'Product details updated successfully.';
            } else if (req.file) {
                message = 'Product image updated successfully.';
            } else {
                return res.status(400).json({ message: 'No data or file provided for update.' });
            }
            
            return res.status(200).json({ message: message, data: fieldsToUpdate });
    
        } catch (err) {
            console.error("Error updating product:", err);
            return res.status(500).json({ message: err.message });
        }
    }

export async function deleteProduct(req,res) {
    console.log(`DELETE /products ${req.params.id} is Requested`)
    try{
        const bodyData = req.body
        const result = await database.query({
            text:`  DELETE FROM "products"
                    WHERE "pdId" = $1
                `,
            values:[req.params.id]
        })
        if(result.rowCount == 0){
            return res.status(404).json({message:`ERROR id ${req.params.id} NOT FOUND`})
        }
        return res.status(204).end()
    }
    catch(err){
        return res.status(500).json({message:err.message})
    }
}

export async function getProductByBrandId(req,res) {
    console.log(`GET /products/brands/id is Requested`)
    try{
        const result = await database.query({
            text: `SELECT p.* ,
                        (
                            SELECT row_to_json(pdt_obj)
                            FROM (SELECT "pdTypeId","pdTypeName"
                                    FROM "pdTypes"
                                    WHERE "pdTypeId"=p."pdTypeId")pdt_obj
                        )AS pdt
                        FROM products p 
                        WHERE p."brandId" ILIKE $1`,
            values:[req.params.id]
        })
        return res.status(200).json(result.rows)
    }
    catch(err){
        return res.status(500).json({
            message:err.message
        })
    }
}

export async function getSearchProduct(req,res) {
    console.log(`GET /search id=${req.params.id} is Requested`)
    try{
        const result = await database.query({
            text: `SELECT p.* ,
                    (
                        SELECT row_to_json(brand_obj)
                        FROM (SELECT "brandId","brandName"
                                FROM brands
                                WHERE "brandId"=p."brandId")brand_obj
                    )AS brand,
                    (
                        SELECT row_to_json(pdt_obj)
                        FROM (SELECT "pdTypeId","pdTypeName"
                                FROM "pdTypes"
                                WHERE "pdTypeId"=p."pdTypeId")pdt_obj
                    )AS pdt
                    FROM products p 
                    WHERE (
                            p."pdId" = $1
                        OR  p."pdName" ILIKE $1
                        OR  p."pdRemark" ILIKE $1
                    )`,
            values:[`%${req.params.id}%`]
        })
        return res.status(200).json(result.rows)
    }
    catch(err){
        return res.status(500).json({
            message:err.message
        })
    }
}

export async function getAllPdTypes(req, res) {
    try {
        const result = await database.query({
            text: 'SELECT * FROM "pdTypes"'
        })
        return res.status(200).json(result.rows)
    } catch (error) {
        console.error('Error fetching product types:', error);
        res.status(500).json({ message: 'Error fetching product types' });
    }
}

export async function getAllBrands(req, res) {
    try {
        const result = await database.query({
            text: 'SELECT * FROM "brands"'
        })
        return res.status(200).json(result.rows)
    } catch (error) {
        console.error('Error fetching brands:', error);
        res.status(500).json({ message: 'Error fetching brands' });
    }
}

export async function getFeaturedProducts(req, res) {
    try{
        const strQry = `SELECT p.* ,
                        (
                            SELECT row_to_json(brand_obj)
                            FROM (SELECT "brandId","brandName"
                                    FROM brands
                                    WHERE "brandId"=p."brandId")brand_obj
                        )AS brand,
                        (
                            SELECT row_to_json(pdt_obj)
                            FROM (SELECT "pdTypeId","pdTypeName"
                                    FROM "pdTypes"
                                    WHERE "pdTypeId"=p."pdTypeId")pdt_obj
                        )AS pdt
                        FROM products p ORDER BY "pdId"
                        OFFSET 0 LIMIT 4`

        const result = await database.query(strQry)
        return res.status(200).json(result.rows)
    }
    catch(err){
        return res.status(500).json({
            message:err.message
        })
    }
}
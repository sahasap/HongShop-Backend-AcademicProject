import database from "../services/database.js"

export async function chkCart(req,res) { 
    if (!req.member || !req.member.memEmail) {
        return res.status(401).json({ error: true, errormessage: "Unauthorized. Token is missing or invalid." });
    }

    const customerIdentifier = req.member.memEmail; 
    
    console.log(`POST CART customer ${customerIdentifier} is requested`);

    const result = await database.query({
        text: `SELECT * FROM carts WHERE "cusId" = $1 AND "cartCf" != true ORDER BY "cartDate" DESC`, 
        values: [customerIdentifier],
    });
    
    if (result.rows.length > 0) {
        return res.json({ 
            cartExist: true, 
            carts: result.rows
        });
    } else {
        return res.json({ cartExist: false, carts: [] });
    }
}

export async function postCart(req, res) {
    console.log(`POST /CART is requested `);
    
    if (!req.member || !req.member.memEmail) {
        return res.status(401).json({ cartOK: false, messageAddCart: "Unauthorized. Please log in to add to cart." });
    }
    
    const customerIdentifier = req.member.memEmail; 

    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const currentDate = `${year}${month}${day}`;

        let i = 0;
        let theId = "";
        let existsResult = [];
        do {
            i++;
            theId = `${currentDate}${String(i).padStart(4, "0")}`; 
            existsResult = await database.query({
                text: 'SELECT EXISTS (SELECT * FROM carts WHERE "cartId" = $1) ',
                values: [theId],
            });
        } while (existsResult.rows[0].exists);

        const result = await database.query({
            text: ` INSERT INTO carts ("cartId", "cusId", "cartDate")
                    VALUES ($1,$2,$3) `,
            values: [
                theId,
                customerIdentifier,
                now,
            ],
        });

        return res.json({ cartOK: true, messageAddCart: theId });
    } catch (err) {
        console.error("Error in postCart:", err);
        return res.status(500).json({ cartOK: false, messageAddCart: err.message });
    }
}

export async function postCartDtl(req, res) {
    console.log(`POST /CARTDETAIL is requested `);
    
    if (!req.member) {
        return res.status(401).json({ cartDtlOK: false, messageAddCartDtl: "Authentication required." });
    }

    try {
        if (req.body.cartId == null || req.body.pdId == null) {
            return res.status(400).json({ 
                cartDtlOK: false,
                messageAddCartDtl: "CartId and ProductID are required",
            });
        }
        
        const { cartId, pdId } = req.body;
        const priceResult = await database.query({
            text: `SELECT "pdPrice" FROM products WHERE "pdId" = $1`,
            values: [pdId],
        });

        if (priceResult.rowCount === 0) {
            return res.status(404).json({
                cartDtlOK: false,
                messageAddCartDtl: `Product ID ${pdId} not found.`,
            });
        }
        
        const currentPrice = parseFloat(priceResult.rows[0].pdPrice);

        const pdResult = await database.query({
            text: `SELECT * FROM "cartDtl" ctd WHERE ctd."cartId" = $1 AND ctd."pdId" = $2`,
            values: [cartId, pdId], 
        }); 	
        
        if (pdResult.rowCount === 0) {
            try {
                await database.query({
                    text: `INSERT INTO "cartDtl" ("cartId", "pdId", qty, price)
                           VALUES ($1,$2,$3,$4)`,
                    values: [cartId, pdId, 1, currentPrice], 
                });
                
                return res.json({ 
                    cartDtlOK: true, 
                    messageAddCartDtl: `Product ${pdId} added to cart ${cartId} at price ${currentPrice}.` 
                });
            } catch (err) {
                console.error("INSERT DETAIL ERROR:", err);
                return res.status(500).json({ 
                    cartDtlOK: false,
                    messageAddCartDtl: `Error inserting product detail: ${err.message}`,
                });
            }
        } else {
            try {
                const newQty = pdResult.rows[0].qty + 1;
                
                await database.query({
                    text: `UPDATE "cartDtl" SET qty = $1
                           WHERE "cartId" = $2
                           AND "pdId" = $3`,
                    values: [newQty, cartId, pdId],
                });
                
                return res.json({ 
                    cartDtlOK: true, 
                    messageAddCartDtl: `Quantity of product ${pdId} updated to ${newQty} in cart ${cartId}.` 
                });
            } catch (err) {
                console.error("UPDATE DETAIL ERROR:", err);
                return res.status(500).json({
                    cartDtlOK: false,
                    messageAddCartDtl: `Error updating product detail quantity: ${err.message}`,
                });
            }
        }
    } catch (err) {
        console.error("POST CART DETAIL GENERAL ERROR:", err);
        return res.status(500).json({
            cartDtlOK: false,
            messageAddCartDtl: `An unexpected error occurred: ${err.message}`,
        });
    }
}

export async function sumCart(req, res) {
    console.log(`GET SumCart ${req.params.id} is requested `)
    const result = await database.query({
        text: `  SELECT SUM(qty) AS qty,SUM(qty*price) AS money
                FROM "cartDtl" ctd
                WHERE ctd."cartId" = $1` ,
        values: [req.params.id]
    })
    console.log(result.rows[0])
    return res.json({
        id: req.params.id,
        qty: result.rows[0].qty,
        money: result.rows[0].money
    })
}

export async function getCart(req, res) {
    console.log(`GET Cart is Requested`)
    try {
        const result = await database.query({
            text:`  SELECT ct.*, SUM(ctd.qty) AS sqty,SUM(ctd.price*ctd.qty) AS sprice
                    FROM carts ct LEFT JOIN "cartDtl" ctd ON ct."cartId" = ctd."cartId"
                    WHERE ct."cartId"=$1
                    GROUP BY ct."cartId" ` ,
            values:[req.params.id]
        })
        console.log(`id=${req.params.id} \n`+result.rows[0])
        return res.json(result.rows)
    }
    catch (err) {
        return res.json({
            error: err.message
        })
    }
}

export async function getCartDtl(req, res) {
    console.log(`GET CartDtl is Requested`)
    try {
        const result = await database.query({
        text:`  SELECT  ROW_NUMBER() OVER (ORDER BY ctd."pdId") AS row_number,
                        ctd."pdId",pd."pdName",ctd.qty,ctd.price
                FROM    "cartDtl" ctd LEFT JOIN "products" pd ON ctd."pdId" = pd."pdId"  
                WHERE ctd."cartId" =$1
                ORDER BY ctd."pdId" ` ,
            values:[req.params.id]
        })
        console.log(`id=${req.params.id} \n`+result.rows[0])
        return res.json(result.rows)
    }
    catch (err) {
        return res.json({
            error: err.message
        })
    }
}

export async function confirmCart(req, res) {
    console.log(`POST /confirmCart is requested`);

    const { id: cartId } = req.params; 
    
    if (!req.member || !req.member.memEmail) {
        return res.status(401).json({ error: true, message: "Authentication required." });
    }
    const { memEmail } = req.member; 

    if (!cartId) {
        return res.status(400).json({ error: true, message: "cartId is required from URL parameters." });
    }

    try {
        const result = await database.query({
            // 💡 FIX: ลบ "orderDate" = NOW() ออก
            text: `UPDATE carts 
                   SET "cartCf" = TRUE
                   WHERE "cartId" = $1 AND "cusId" = $2 AND "cartCf" = FALSE
                   RETURNING "cartId", "cartCf"`, // 💡 ลบ "orderDate" ออกจาก RETURNING ด้วย
            values: [cartId, memEmail], 
        });

        if (result.rowCount === 0) {
            return res.status(400).json({ 
                error: true, 
                message: "Cart confirmation failed. Cart may be already confirmed, not found, or not owned by this user." 
            });
        }

        return res.status(200).json({ 
            error: false, 
            message: `Cart ${cartId} confirmed successfully.`,
            confirmedCart: result.rows[0]
        });

    } catch (err) {
        console.error("Error in confirmCart:", err);
        return res.status(500).json({ 
            error: true, 
            message: err.message 
        });
    }
}

export async function getCartByCus(req, res) {
    console.log(`POST Cart By Customer is Requested`);
    
    if (!req.member || !req.member.memEmail) {
        return res.status(401).json({ error: true, message: "Unauthorized. Please log in." });
    }
    const customerIdentifier = req.member.memEmail; 

    try {
        const result = await database.query({
            text:` 	SELECT ROW_NUMBER() OVER (ORDER BY ct."cartId" DESC) AS row_number,
                            ct.*, SUM(ctd.qty) AS sqty, SUM(ctd.price*ctd.qty) AS sprice
                    FROM carts ct LEFT JOIN "cartDtl" ctd ON ct."cartId" = ctd."cartId"
                    WHERE ct."cusId"=$1 
                    AND ct."cartCf" = TRUE -- 💡 เพิ่มเงื่อนไข: ต้องเป็นตะกร้าที่ยืนยันแล้วเท่านั้น
                    GROUP BY ct."cartId"
                    ORDER BY ct."cartId" DESC` ,
            values:[customerIdentifier] 
        });
        
        console.log(`Customer ID=${customerIdentifier}. Found ${result.rows.length} carts.`);
        
        return res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error in getCartByCus:", err);
        return res.status(500).json({
            error: err.message
        });
    }
}

export async function delCartDtl(req, res) {
    console.log(`DELETE /cartdtl is requested`);
    if (!req.member || !req.member.memEmail) {
        return res.status(401).json({ error: true, message: "Authentication required." });
    }
    const customerIdentifier = req.member.memEmail; 
    
    const { cartId, pdId } = req.body;

    if (!cartId || !pdId) {
        return res.status(400).json({ error: true, message: "cartId and pdId are required." });
    }

    try {
        const cartResult = await database.query({
            text: `SELECT "cartId" FROM carts 
                   WHERE "cartId" = $1 AND "cusId" = $2 AND "cartCf" = FALSE`,
            values: [cartId, customerIdentifier],
        });

        if (cartResult.rowCount === 0) {
            return res.status(404).json({ error: true, message: "Active cart not found, or cart is confirmed and cannot be modified." });
        }
        const delResult = await database.query({
            text: `DELETE FROM "cartDtl" WHERE "cartId" = $1 AND "pdId" = $2`,
            values: [cartId, pdId],
        });

        if (delResult.rowCount === 0) {
            return res.status(404).json({ error: true, message: "Product detail not found in cart." });
        }

        return res.status(200).json({ error: false, message: `Product ${pdId} removed from cart ${cartId}.` });

    } catch (err) {
        console.error("Error in delCartDtl:", err);
        return res.status(500).json({ error: true, message: err.message });
    }
}

export async function delCart(req, res) {
    console.log(`DELETE /cart is requested`);
    if (!req.member || !req.member.memEmail) {
        return res.status(401).json({ error: true, message: "Authentication required." });
    }
    const customerIdentifier = req.member.memEmail; 
    
    const { cartId } = req.body; 

    if (!cartId) {
        return res.status(400).json({ error: true, message: "cartId is required." });
    }

    try {
        const cartResult = await database.query({
            text: `SELECT "cartId" FROM carts 
                   WHERE "cartId" = $1 AND "cusId" = $2 AND "cartCf" = FALSE`,
            values: [cartId, customerIdentifier],
        });

        if (cartResult.rowCount === 0) {
            return res.status(404).json({ error: true, message: "Active cart not found, or cart is confirmed and cannot be deleted." });
        }

        await database.query({
            text: `DELETE FROM "cartDtl" WHERE "cartId" = $1`,
            values: [cartId],
        });

        const delResult = await database.query({
            text: `DELETE FROM carts WHERE "cartId" = $1`,
            values: [cartId],
        });
        
        if (delResult.rowCount === 0) {
            return res.status(500).json({ error: true, message: "Failed to delete cart header." });
        }

        return res.status(200).json({ error: false, message: `Cart ${cartId} and its details have been fully deleted.` });

    } catch (err) {
        console.error("Error in delCart:", err);
        return res.status(500).json({ error: true, message: err.message });
    }
}

export async function getCartByEmail(req, res) {
    console.log(`POST Get Cart By Email (Admin) is Requested`);
    
    if (!req.member || !req.member.memEmail) {
        return res.status(401).json({ error: true, message: "Authentication required." });
    }

    const targetEmail = req.body.targetEmail; 

    if (!targetEmail) {
        return res.status(400).json({ error: true, message: "Target customer email is required." });
    }

    try {
        const result = await database.query({
            text:` 	SELECT ROW_NUMBER() OVER (ORDER BY ct."cartId" DESC) AS row_number,
                            ct.*, SUM(ctd.qty) AS sqty, SUM(ctd.price*ctd.qty) AS sprice
                    FROM carts ct LEFT JOIN "cartDtl" ctd ON ct."cartId" = ctd."cartId"
                    WHERE ct."cusId"=$1 
                    AND ct."cartCf" = TRUE -- ดูเฉพาะรายการที่ยืนยันแล้ว
                    GROUP BY ct."cartId"
                    ORDER BY ct."cartId" DESC` ,
            values:[targetEmail]
        });
        
        console.log(`Admin viewing history for: ${targetEmail}. Found ${result.rows.length} carts.`);
        
        return res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error in getCartByEmail:", err);
        return res.status(500).json({
            error: err.message
        });
    }
}

export const updateQtyDtl = async (req, res) => {
    const { cartId, pdId } = req.params; 
    const { qty: newQty } = req.body; 

    if (!newQty || isNaN(newQty) || newQty < 1) {
        return res.status(400).json({ message: 'Invalid quantity provided.' });
    }
    const updateSql = `
        UPDATE "cartDtl" 
        SET "qty" = $1 
        WHERE "cartId" = $2 AND "pdId" = $3;
        `;

    try {
        const result = await database.query({
        text: updateSql,
        values: [newQty, cartId, pdId]
    });

    const updatedRowCount = result.rowCount; 

    if (updatedRowCount === 0) {
        return res.status(404).json({ message: 'Cart item not found or quantity is the same.' });
    }

    res.status(200).json({ message: 'Quantity updated successfully.' });

    } catch (error) {
        console.error("Database update error:", error);
        res.status(500).json({ message: 'Internal server error while updating quantity.' });
    }
};

export async function getCartHistory(req, res) {
    if (!req.member || !req.member.memEmail) {
        return res.status(401).json({ error: true, message: "Authentication required." });
    }
    const { memEmail } = req.member; 

    console.log(`GET /carts/history for user ${memEmail} is Requested`);
    
    try {
        const strQry = `
            SELECT 
                c."cartId",
                COUNT(cd."pdId") AS "itemCount",
                SUM(cd.qty * p."pdPrice") AS "totalPrice"
            FROM carts c
            JOIN "cartDtl" cd ON c."cartId" = cd."cartId"
            JOIN products p ON cd."pdId" = p."pdId"
            WHERE c."cusId" = $1 AND c."cartCf" = true
            GROUP BY c."cartId"
            ORDER BY c."cartId" DESC; -- เรียงตาม cartId แทน
        `;
        
        const result = await database.query(strQry, [memEmail]);
        
        return res.status(200).json(result.rows);

    } catch(err) {
        console.error("Error in getCartHistory:", err);
        return res.status(500).json({
            message: 'An error occurred while fetching order history.',
            error: err.message
        });
    }
}

export async function getAllConfirmedOrders(req, res) {
    console.log(`GET /admin/orders (All History) is Requested by Admin`);
    
    try {
        const strQry = `
            SELECT 
                c."cartId",
                c."cusId" AS "memEmail", -- 💡 Alias "cusId" เป็น "memEmail"
                COUNT(cd."pdId") AS "itemCount",
                SUM(cd.qty * p."pdPrice") AS "totalPrice"
            FROM carts c
            JOIN "cartDtl" cd ON c."cartId" = cd."cartId"
            JOIN products p ON cd."pdId" = p."pdId"
            WHERE c."cartCf" = true
            GROUP BY c."cartId", c."cusId"
            ORDER BY c."cartId" DESC;
        `;
        
        const result = await database.query(strQry);
        
        return res.status(200).json(result.rows);

    } catch(err) {
        console.error("Error in getAllConfirmedOrders:", err);
        return res.status(500).json({
            message: 'An error occurred while fetching all order history.',
            error: err.message
        });
    }
}
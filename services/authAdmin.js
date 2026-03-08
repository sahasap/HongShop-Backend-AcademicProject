import jwt from 'jsonwebtoken';

export const isAdmin = (req, res, next) => {
    if (req.member && req.member.dutyId === 'admin') {
        next();
    } else {
        return res.status(403).json({ message: 'Forbidden: Admin access required.' });
    }
};

export async function authenticateToken(req, res, next) {
    console.log(`Middleware: authenticateToken is running`);
    const token = req.cookies ? req.cookies.token : null; 
    
    if (!token) {
        return res.status(401).json({ message: 'Authorization token not found.', login: false });
    }

    try {
        const secret_key = process.env.SECRET_KEY;
        const member = jwt.verify(token, secret_key);
        req.member = member; 
        next(); 

    } catch(err) {
        console.error("JWT Verification Error:", err.message);
        return res.status(403).json({ 
            message: `Invalid or expired token. Access denied.`, 
            login: false 
        });
    }
}

export const verifyToken = (req, res, next) => {
    const token = req.cookies.jwt_token;

    if (!token) {
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET); 
        req.member = decoded;
        
        next();
    } catch (err) {
        console.error("JWT Verification failed:", err.message);
        res.clearCookie('jwt_token'); 
        req.member = null; 
        next();
    }
};
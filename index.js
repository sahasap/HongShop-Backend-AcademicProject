import express from "express"
import bodyParser from "body-parser"
import dotenv from 'dotenv'
import cors from "cors"
import cookieParser from "cookie-parser"
import productRoute from "./routes/productRoute.js"
import memberRoute from "./routes/memberRoute.js"
import cartRoute from "./routes/cartRoute.js"
import swaggerUI from "swagger-ui-express"
import yaml from "yaml"
import fs from "fs"

dotenv.config()
const app = express()
const port = process.env.PORT

app.use(bodyParser.json())
app.use("/img_mem",express.static("img_mem"))
app.use('/img_pd', express.static('img_pd'))
app.use(cors({
    origin:['http://localhost:5173','http://127.0.0.1:5173'],
    methods:['GET','POST','PUT','DELETE'],
    credentials:true
}))
app.use('/api', productRoute);
app.use(cookieParser()) 
app.use(productRoute)
app.use(memberRoute)
app.use(cartRoute)

const swaggerfile = fs.readFileSync('services/swagger.yaml','utf-8')
const swaggerDoc = yaml.parse(swaggerfile)
app.use('/api-docs',swaggerUI.serve,swaggerUI.setup(swaggerDoc))

app.listen(port,()=>{
    console.log(`Server running on port ${port}`)
})


const express = require("express")
const cors = require("cors")
const mongoose = require("mongoose")
const dotenv = require("dotenv").config()

const app = express()
app.use(cors())
app.use(express.json({limit: "10mb"}))

const PORT = process.env.PORT || 8080
//mongodb connection
console.log(process.env.MONGODB_URL)
mongoose.set('strictQuery', false)
mongoose.connect(process.env.MONGODB_URL)
.then(()=>console.log("Connect to Database"))
.catch((err)=>console.log(err))

//schema
const userSchema = mongoose.Schema({
    firstName: String,
    lastName: String,
    email: {
        type : String,
        unique: true,
    },
    password: String,
    confirmPassword: String,
    image: String,
})

//
const userModel = mongoose.model("user", userSchema)

//api
app.get("/", (req,res)=>{
    res.send("Server is running")
})
// app.post("/signup", async (req, res)=>{
//     console.log(req.body)
//     const [email] = req.body
//     userModel.findOne({email : email}, (err, result)=>{
//         console.log(result)
//         console.log(err);
//         if(result){
//             res.send({message : "Email id is alreadt register"})
//         }
//         else {
//             const data = userModel(req.body)
//             const save = data.save()
//             res.send({message : "Successfully sign up"})
//         }
//     })
// })
app.post("/signup", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).send({ message: "Email is required" });
        }

        const result = await userModel.findOne({ email: email });
        
        if (result) {
            return res.status(400).send({ message: "Email is already registered", alert: false });
        } else {
            const newUser = new userModel(req.body);
            await newUser.save();
            return res.status(200).send({ message: "Successfully signed up", alert : true });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).send({ message: "An error occurred during signup" });
    }
});


app.listen(PORT, ()=>console.log("Server is running at port : "+ PORT))

const express = require("express");
const cors = require("cors");
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dpftp.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

app.get("/", (req, res) => {
    res.send("Hello From Doctors Portal Server.")
});

app.listen(port, () => {
    console.log("Doctors Portal running on port:", port);
})
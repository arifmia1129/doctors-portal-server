const express = require("express");
const cors = require("cors");
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dpftp.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db("doctorsPortal").collection("service");
        const bookingCollection = client.db("doctorsPortal").collection("booking");

        app.get("/service", async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);
        });

        app.get("/available", async (req, res) => {
            const date = req.query.date;
            const services = await serviceCollection.find().toArray();
            const query = { date }
            const bookingServices = await bookingCollection.find(query).toArray();

            services.forEach(service => {
                const bookings = bookingServices.filter(book => book.treatment === service.name);
                const booked = bookings.map(b => b.time);
                const available = service.slots.filter(s => !booked.includes(s));
                service.slots = available;
            })

            res.send(services);
        })

        app.post("/booking", async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patientEmail: booking.patientEmail };
            const exists = await bookingCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, date: exists.date, time: exists.time });
            }
            const result = await bookingCollection.insertOne(booking);
            res.send({ success: true, result });
        })

        app.get("/booking", async (req, res) => {
            const patientEmail = req.query.email;
            const query = { patientEmail };
            const appointments = await bookingCollection.find(query).toArray();
            res.send(appointments);
        })

    }
    finally {

    }
}

run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("Hello From Doctors Portal Server.")
});

app.listen(port, () => {
    console.log("Doctors Portal running on port:", port);
})
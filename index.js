const express = require("express");
const cors = require("cors");
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const nodemailer = require('nodemailer');
const sgTransport = require('nodemailer-sendgrid-transport');
const stripe = require("stripe")(process.env.STRIPE_KEY);

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dpftp.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: "Un-authorization access!" })
    }
    const token = authHeader.split(" ")[1];

    jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: "Forbidden access!" })
        }
        req.decoded = decoded;
        next();
    })
}


const options = {
    auth: {
        api_key: process.env.EMAIL_SENDER_KEY
    }
}

const emailSenderClient = nodemailer.createTransport(sgTransport(options));

const appointmentEmailSender = (booking) => {
    const { patientEmail, patientName, date, time, treatment, contact } = booking;
    const email = {
        from: process.env.EMAIL_SENDER,
        to: patientEmail,
        subject: `Your "${treatment}" appointment is confirmed on ${date}, ${time}`,
        text: `Your "${treatment}" appointment is confirmed on ${date}, ${time}`,
        html: `
        <div>
                <h2>Assalamu Alaikum Dear Sir/Mam ${patientName}</h2>,
                <h1>We have receive your appointment.</h1>
                <h3>Your appointment details is :</h3>
                <ul>
                    <li>Appointment for: ${treatment}</li>
                    <li>Patient: ${patientName}</li>
                    <li>Email: ${patientEmail}</li>
                    <li>Contact No: ${contact}</li>
                    <li>Date: ${date}</li>
                    <li>Time slot: ${time}</li>
                </ul>
                <h2>Thanks for your appointment.</h2>
                <h2>Stay with us!</h2>
                <h2>Happy Health Service</h2>

                <br />
                <br />
                <br />
                <a href="https://doctors-portal-cfb7f.web.app/">About us!</a>
                <br />
                <h1>Doctors Portal Technical Team</h1>
            </div>
        `
    };

    emailSenderClient.sendMail(email, function (err, info) {
        if (err) {
            console.log(err);
        }
        else {
            console.log('Message sent: ', info);
        }
    });
}
const paymentEmailSender = (payment) => {
    const {
        appointmentId,
        appointmentFor,
        patientName,
        patientEmail,
        tnxId,
        date,
        time,
        price
    } = payment;
    const email = {
        from: process.env.EMAIL_SENDER,
        to: patientEmail,
        subject: `Your payment received for "${appointmentFor}" on ${date} at ${time}`,
        text: `Your payment received for "${appointmentFor}" on ${date} at ${time}`,
        html: `
        <div>
                <h2>Assalamu Alaikum Dear Sir/Mam ${patientName}</h2>,
                <h1>We have receive your payment for ${appointmentFor}.</h1>
                <h3>Your payment details is :</h3>
                <ul>
                    <li>Appointment id: ${appointmentId}</li>
                    <li>Appointment for: ${appointmentFor}</li>
                    <li>Patient: ${patientName}</li>
                    <li>Email: ${patientEmail}</li>
                    <li>Date: ${date}</li>
                    <li>Time slot: ${time}</li>
                    <li>Price: ${price}</li>
                    <li>Tnx id: ${tnxId}</li>
                </ul>
                <h2>Thanks for your appointment payment.</h2>
                <h2>Stay with us!</h2>
                <h2>Happy Health Service!</h2>

                <br />
                <br />
                <br />
                <a href="https://doctors-portal-cfb7f.web.app/">About us!</a>
                <br />
                <h1>Doctors Portal Finance Team!</h1>
            </div>
        `
    };

    emailSenderClient.sendMail(email, function (err, info) {
        if (err) {
            console.log(err);
        }
        else {
            console.log('Message sent: ', info);
        }
    });
}

async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db("doctorsPortal").collection("service");
        const bookingCollection = client.db("doctorsPortal").collection("booking");
        const userCollection = client.db("doctorsPortal").collection("user");
        const doctorCollection = client.db("doctorsPortal").collection("doctor");
        const paymentCollection = client.db("doctorsPortal").collection("payment");


        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const user = await userCollection.findOne({ email: requester });
            if (user.role === "admin") {
                next();
            }
            else {
                res.status(403).send("Forbidden access!");
            }
        }

        app.post("/create-payment-intent", async (req, res) => {
            const treatment = req.body;
            const price = treatment.price;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: price * 100,
                currency: "usd",
                payment_method_types: ["card"],
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })

        app.get("/service", async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query).project({ name: 1 });
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
            appointmentEmailSender(booking);
            res.send({ success: true, result });
        })
        //
        app.get("/booking", verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const patientEmail = req.query.email;
            const query = { patientEmail };
            if (decodedEmail === patientEmail) {
                const appointments = await bookingCollection.find(query).toArray();
                return res.send(appointments);
            }

            else {
                return res.status(403).send({ message: "Forbidden access!" })
            }

        })
        app.get("/booking/:id", verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await bookingCollection.findOne(query);
            res.send(result);
        })
        app.patch("/booking/:id", verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updateDoc = {
                $set: {
                    paid: true,
                    tnxId: payment.tnxId
                }
            }
            const result = await paymentCollection.insertOne(payment);
            const updateBooking = await bookingCollection.updateOne(filter, updateDoc);
            paymentEmailSender(payment);
            res.send({ result, updateBooking });
        })

        app.get("/user", verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        })
        app.get("/admin/:email", verifyJWT, async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email });
            const isAdmin = user.role === "admin";
            res.send({ isAdmin });
        })

        app.put("/user/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email };
            const updateDoc = {
                $set: { role: "admin" },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        })
        app.put("/user/:email", async (req, res) => {
            const email = req.params.email;
            const user = req.body;

            const filter = { email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email }, process.env.SECRET_KEY, {
                expiresIn: "1d"
            })
            res.send({ result, token });
        })

        app.post("/doctor", verifyJWT, verifyAdmin, async (req, res) => {
            const doctor = req.body;
            const result = await doctorCollection.insertOne(doctor);
            res.send(result);
        })
        app.get("/doctor", verifyJWT, verifyAdmin, async (req, res) => {
            const result = await doctorCollection.find().toArray();
            res.send(result);
        })

        app.delete("/doctor/:email", verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email };
            const result = await doctorCollection.deleteOne(filter);
            res.send(result);
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
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const crypto = require("crypto");

const generateTrackingId = () => {
  const prefix = "PRCL";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = crypto.randomBytes(3).toString("hex").toLocaleUpperCase();

  return `${prefix}-${date}-${random}`;
};

// MiddleWere
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@simple-crud-serv.sbd6kzc.mongodb.net/?appName=Simple-CRUD-Serv`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const db = client.db("zap_shift_db_2");
    const usersCollection = db.collection("users");
    const parcelsCollection = db.collection("parcels");
    const paymentsCollection = db.collection("payments");
    const ridersCollection = db.collection("riders");

    app.get('/users', async(req, res)=> {
      const cursor = usersCollection.find()
      const result = await cursor.toArray()
      res.send(result)
    })

    app.post("/users", async (req, res) => {
      const user = req.body;
      user.user_Role = "User";
      user.createdAt = new Date();

      const email = user.email;
      const isEmailExist = await usersCollection.findOne({ email });

      if (isEmailExist) {
        return res.send({ message: "Email Already Saved In Database" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.patch('/users/:id', async(req, res)=>{
      const id = req.params.id
      const updateRole = req.body
      const query = {_id: new ObjectId(id)}
      const changeRole = {
        $set:{user_Role:updateRole.user_Role}
      }

      const result = await usersCollection.updateOne(query, changeRole)
      res.send(result)
    })

    app.get("/parcels", async (req, res) => {
      const query = {};
      const { email } = req.query;

      if (email) {
        query.senderEmail = email;
      }

      const options = { sort: { createdAt: -1 } };

      const cursor = parcelsCollection.find(query, options);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/parcels", async (req, res) => {
      const parcel = req.body;
      parcel.createdAt = new Date();
      const result = await parcelsCollection.insertOne(parcel);
      res.send(result);
    });

    app.delete("/parcels/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const result = await parcelsCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/create-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      const amount = parseInt(paymentInfo.cost * 100);
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "USD",
              unit_amount: amount,
              product_data: {
                name: paymentInfo.parcelName,
              },
            },
            quantity: 1,
          },
        ],
        customer_email: paymentInfo.senderEmail,
        metadata: {
          parcelID: paymentInfo.parcelId,
          parcelName: paymentInfo.parcelName,
        },
        mode: "payment",
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
      });

      res.send({ url: session.url });
    });

    app.patch("/payment-success", async (req, res) => {
      const sessionId = req.query.session_id;
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      const transactionId = session.payment_intent;
      const query = { transactionId: transactionId };
      const ispaymentExist = await paymentsCollection.findOne(query);

      if (ispaymentExist) {
        return res.send({
          trackingId: ispaymentExist.trackingId,
          transactionId,
        });
      }

      if (session.payment_status === "paid") {
        const trackingIdGenerate = generateTrackingId();
        const id = session.metadata.parcelID;
        const query = { _id: new ObjectId(id) };
        const update = {
          $set: {
            paymentStatus: "paid",
            trackingId: trackingIdGenerate,
            transactionId: session.payment_intent,
          },
        };

        const result = await parcelsCollection.updateOne(query, update);

        const payment = {
          amount: session.amount_total / 100,
          currency: session.currency,
          customerEmail: session.customer_email,
          parcelId: session.metadata.parcelID,
          parcelName: session.metadata.parcelName,
          transactionId: session.payment_intent,
          paymentStatus: session.payment_status,
          paidAt: new Date(),
          trackingId: trackingIdGenerate,
        };

        if (session.payment_status === "paid") {
          const paymentResult = await paymentsCollection.insertOne(payment);

          return res.send({
            success: true,
            modifyparcel: result,
            trackingId: trackingIdGenerate,
            transactionId: session.payment_intent,
            paymentInfo: paymentResult,
          });
        }
      }
    });

    app.get("/parcel/:parcelId", async (req, res) => {
      const id = req.params.parcelId;
      const query = { _id: new ObjectId(id) };
      const result = await parcelsCollection.findOne(query);
      res.send(result);
    });

    app.get("/payments", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.senderEmail = email;
      }
      const option = { sort: { createdAt: -1 } };
      const cursor = parcelsCollection.find(query, option);
      const result = await cursor.toArray();

      res.send(result);
    });

    app.get('/riders', async(req,res)=>{
      const query = {status:"pending"}
      const cursor = ridersCollection.find(query)
      const result = await cursor.toArray()
      res.send(result)
    })

    app.patch('/riders/:id', async(req, res)=>{
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const updateInfo = req.body
      const update = {
        $set:{status: updateInfo.status}
      }
      const result = await ridersCollection.updateOne(query, update)
      res.send(result)
    })

    app.post("/riders", async (req, res) => {
      const ridersInfo = req.body;
      ridersInfo.status = "pending";
      ridersInfo.createtAt = new Date();

      const riderEmail = ridersInfo.riderEmail
      const isExist = await ridersCollection.findOne({riderEmail});
      if(isExist){
        return res.status(401).send({message: "You Are Already You have already sent the request"})
      }
      const result = await ridersCollection.insertOne(ridersInfo);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Zap-Shift-2 is Running....");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

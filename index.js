const dns = require("dns");
dns.setServers([
  "8.8.8.8",
  "1.1.1.1"
]);
const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// MiddleWere
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@simple-crud-serv.sbd6kzc.mongodb.net/?appName=Simple-CRUD-Serv`


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();

    const db = client.db("zap_shift_db_2")
    const parcelsCollection = db.collection('parcels')

    app.get('/parcels', async(req, res)=> {
      const query = {}
      const {email} = req.query

      if(email){
        query.senderEmail = email
      }

      const options = {sort:{createdAt: -1}}

      const cursor = parcelsCollection.find(query, options)
      const result = await cursor.toArray()
      res.send(result)
    })

    app.post('/parcels', async(req, res)=>{
      const parcel = req.body;
      parcel.createdAt = new Date();
      const result = await parcelsCollection.insertOne(parcel)
      res.send(result)
    })

    app.delete('/parcels/:id', async(req,res)=> {
      const id = req.params.id

      const query = {_id: new ObjectId(id)}
      const result = await parcelsCollection.deleteOne(query)
      res.send(result)
    })

    app.get('/parcel/:parcelId', async(req,res)=>{
      const id = req.params.parcelId
      const query = {_id: new ObjectId(id)}
      const result = await parcelsCollection.findOne(query)
      res.send(result)
    })

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
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

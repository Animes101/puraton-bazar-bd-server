const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const cors = require("cors");


app.use(express.json());
app.use(cors());
const PORT = 3000;


app.get('/', (req, res) => {
 
  res.send('Hello from Express Server!................');
});

const uri = `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@cluster0.26qzwj8.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});



async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    //products relate api

   const PuratonBazar = client.db('PuratonBazar');
const products = PuratonBazar.collection('products');

app.get('/products', async (req, res) => {
  try {
    const result = await products.find().toArray();
    res.status(200).json({ status: 'ok', data: result });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ status: 'error', message: 'Server problem' });
  }
});

app.get('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // ObjectId valid কিনা চেক করা
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ status: 'error', message: 'Invalid product ID' });
    }

    const query = { _id: new ObjectId(id) };

    // findOne() already returns a single document
    const result = await products.findOne(query);


    if (!result) {
      return res.status(404).json({ status: 'error', message: 'Product not found' });
    }

    res.status(200).json({ status: 'ok', data: result });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ status: 'error', message: 'Server problem' });
  }
});


//Cart Related api

const cartsCollection = PuratonBazar.collection('carts');

app.post('/cart', async (req, res) => {
  try {

    const cart=req.body;

    const result= await cartsCollection.insertOne(cart);


    if(result){

      res.status(200).json({ status: 'ok', data: result });

    }

  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ status: 'error', message: 'Server problem' });
  }
});


app.get('/cart', async (req, res) => {
  try {

    const email=req.query.email;

    const query={email:email}

    const result= await cartsCollection.find(query).toArray();


    if(result){

      res.status(200).json({ status: 'ok', data: result });

    }

  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ status: 'error', message: 'Server problem' });
  }
});

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
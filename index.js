const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");

app.use(express.json());
app.use(cors());
const PORT = 3000;

app.get("/", (req, res) => {
  res.send("Hello from Express Server!................");
});

const uri = `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@cluster0.26qzwj8.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    //jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(
       user,
        process.env.SECRITE_TOKEN,
        { expiresIn: "1h" }
      );

      res.json({token: token});
    });

    //middleware for verify jwt
    const verifyToken=(req,res,next)=>{

      const authorization=req.headers.authorization;

      if(!authorization){
        return res.status(401).send({error:true, message:'unauthorized access'})
      }
      const token=authorization.split(' ')[1];

                // verify a token symmetric
          jwt.verify(token, process.env.SECRITE_TOKEN, (err, decoded) =>{
            
            
            if(err){
              return res.status(401).send({error:true, message:'unauthorized access'})
            }
            req.decoded=decoded;
            next()

          });

    }

      //middleware for verify Admin
    const verifyAdmin= async (req, res, next)=> {


      const email=req.decoded.email; 

      const query={email:email}

      const user=await usersCollection.findOne(query);
      if(user?.role !== 'admin'){
        return res.status(403).send({error:true, message:'forbidden access'})
      }

      next();
    }

    //products relate api

    const PuratonBazar = client.db("PuratonBazar");
    const products = PuratonBazar.collection("products");

    app.get("/products", verifyToken , async (req, res) => {
      try {
        const result = await products.find().toArray();
        res.status(200).json({ status: "ok", data: result });
      } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ status: "error", message: "Server problem" });
      }
    });

    app.get("/products/:id", async (req, res) => {
      try {
        const { id } = req.params;

        // ObjectId valid কিনা চেক করা
        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .json({ status: "error", message: "Invalid product ID" });
        }

        const query = { _id: new ObjectId(id) };

        // findOne() already returns a single document
        const result = await products.findOne(query);

        if (!result) {
          return res
            .status(404)
            .json({ status: "error", message: "Product not found" });
        }

        res.status(200).json({ status: "ok", data: result });
      } catch (error) {
        console.error("Error fetching product:", error);
        res.status(500).json({ status: "error", message: "Server problem" });
      }
    });

     app.post("/products", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const newItem = req.body;

        const result= await products.insertOne(newItem);

        if(result.insertedId){

          res.status(200).json({ status: "ok", data: result })
        }

        

      } catch (error) {
        console.error("Error fetching product:", error);
        res.status(500).json({ status: "error", message: "Server problem" });
      }
    });

     app.patch("/Products/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const newItem=req.body;

        const query={_id: new ObjectId(id)}


       
        

        const updateDoc = {
          $set: { 
           
            category: newItem.category,
            name: newItem.name,
            brand: newItem.brand,
            price: newItem.price,
            condition: newItem.condition,
            description: newItem.description,
            images: [newItem?.images?.[0] || null, newItem?.images?.[1] || null],
            postedAt: newItem.postedAt,
       
          },
        };

        const result = await products.updateOne(query, updateDoc);
        
        if (result) {
          res.status(200).json({ status: "ok", data: result });
        }
      } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ status: "error", message: "Server problem" });
      }
    });

    //Cart Related api

    const cartsCollection = PuratonBazar.collection("carts");

    app.post("/cart", async (req, res) => {
      try {
        const cart = req.body;

        const result = await cartsCollection.insertOne(cart);

        if (result) {
          res.status(200).json({ status: "ok", data: result });
        }
      } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ status: "error", message: "Server problem" });
      }
    });

    app.get("/cart", async (req, res) => {
      try {
        const email = req.query.email;

        const query = { email: email };

        const result = await cartsCollection.find(query).toArray();

        if (result) {
          res.status(200).json({ status: "ok", data: result });
        }
      } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ status: "error", message: "Server problem" });
      }
    });

    app.delete("/cart/:id", async (req, res) => {
      try {
        const { id } = req.params;

        console.log(id);

        const query = { _id: new ObjectId(id) };

        const result = await cartsCollection.deleteOne(query);

        if (result) {
          res.status(200).json({ status: "ok", data: result });
        }
      } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ status: "error", message: "Server problem" });
      }
    });

    //Users related api
    const usersCollection = PuratonBazar.collection("users");
    app.post("/users", async  (req, res) => {
      try {
        const userInfo = req.body;

        const quey = { email: userInfo.email };

        const existingUser = await usersCollection.findOne(quey);

        if (existingUser) {
          return res
            .status(200)
            .json({ status: "no", data: "User already exists" });
        }

        const result = await usersCollection.insertOne(userInfo);

        if (result) {
          res.status(200).json({ status: "ok", data: result });
        }
      } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ status: "error", message: "Server problem" });
      }
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      try {
        const { email } = req.params;

        if(email !== req.decoded.email){
          return res.status(403).json({status:'forbidden access'})
        }
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        if (user?.role === "admin") {
          return res.status(200).json({ status: "ok", isAdmin: true });
        } else {
          return res.status(200).json({ status: "ok", isAdmin: false });
        }
      } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ status: "error", message: "Server problem" });
      }
    });

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      try {
      

       
        const result = await usersCollection.find().toArray();

        if (result) {
          res.status(200).json({ status: "ok", data: result });
        }
      } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ status: "error", message: "Server problem" });
      }
    });

    app.delete("/users/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const query = { _id: new ObjectId(id) };

        const result = await usersCollection.deleteOne(query);

        if (result) {
          res.status(200).json({ status: "ok", data: result });
        }
      } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ status: "error", message: "Server problem" });
      }
    });

    app.patch("/users/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const query = { _id: new ObjectId(id) };

        const updateDoc = {
          $set: { role: "admin" },
        };

        const result = await usersCollection.updateOne(query, updateDoc);

        if (result) {
          res.status(200).json({ status: "ok", data: result });
        }
      } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ status: "error", message: "Server problem" });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const SSLCommerzPayment = require("sslcommerz-lts");

app.use(express.json());
app.use(cors());
const PORT = 3000;

const store_id = "midla68ef5f2b0cf63";
const store_passwd = "midla68ef5f2b0cf63@ssl";
const is_live = false;

// app.get("/", (req, res) => {
//   res.send("Hello from Express Server!................");
// });

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
      const token = jwt.sign(user, process.env.SECRITE_TOKEN, {
        expiresIn: "1h",
      });

      res.json({ token: token });
    });

    //middleware for verify jwt
    const verifyToken = (req, res, next) => {
      const authorization = req.headers.authorization;

      if (!authorization) {
        return res
          .status(401)
          .send({ error: true, message: "unauthorized access" });
      }
      const token = authorization.split(" ")[1];

      // verify a token symmetric
      jwt.verify(token, process.env.SECRITE_TOKEN, (err, decoded) => {
        if (err) {
          return res
            .status(401)
            .send({ error: true, message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    //middleware for verify Admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;

      const query = { email: email };

      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }

      next();
    };

    //products relate api

    const PuratonBazar = client.db("PuratonBazar");
    const products = PuratonBazar.collection("products");

app.get("/products", async (req, res) => {
  try {
    let {
      page,
      limit,
      category,
      minPrice,
      maxPrice,
      search,
    } = req.query;

  

    // Convert numbers only if exists
    if (page) page = parseInt(page);
    if (limit) limit = parseInt(limit);
    if (minPrice) minPrice = parseInt(minPrice);
    if (maxPrice) maxPrice = parseInt(maxPrice);

    const filter = {};

    // CATEGORY FILTER
    if (category && category !== "ALL") {
      filter.category = category;
    }

   // price filter ONLY if both exist
    if (minPrice && maxPrice) {
      filter.price = {
        $gte: parseInt(minPrice),
        $lte: parseInt(maxPrice)
      };
    }
  
   // SEARCH FILTER ONLY IF search EXISTS
if (search && search.trim() !== "") {
  filter.$or = [
    { title: { $regex: search, $options: "i" } },
    { name: { $regex: search, $options: "i" } },
    { description: { $regex: search, $options: "i" } },
  ];
}

     // DB QUERY
    const data = await products
      .find(filter)
      .skip(page ? page * limit : 0)
      .limit(limit ? limit : 0)
      .toArray();

    const total_product = await products.countDocuments(filter);

    res.status(200).json({
      status: "ok",
      data,
      total_product,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ status: "error", message: "Server Problem" });
  }
});


   // get only best products
app.get("/best-product", async (req, res) => {
  try {
    // query: শুধু যাদের isBest:true
    const query = { isBest: true };

    const result = await products.find(query).toArray();

    res.status(200).json({
      status: "ok",
      bestProduct: result,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Latest Products
app.get("/latest-products", async (req, res) => {
  try {
    const result = await products
      .find({})
      .sort({ postedAt: -1 }) // newest first
      .limit(9)               // latest 10 product দেখাবে
      .toArray();

    res.status(200).json({
      status: "ok",
      latestProducts: result,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});


    app.delete("/products/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const { id } = req.params;
        const query = { _id: new ObjectId(id) };

        const result = await products.deleteOne(query);

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

        const result = await products.insertOne(newItem);

        if (result.insertedId) {
          res.status(200).json({ status: "ok", data: result });
        }
      } catch (error) {
        console.error("Error fetching product:", error);
        res.status(500).json({ status: "error", message: "Server problem" });
      }
    });

    app.patch("/Products/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const newItem = req.body;

        const query = { _id: new ObjectId(id) };

        const updateDoc = {
          $set: {
            category: newItem.category,
            name: newItem.name,
            brand: newItem.brand,
            price: newItem.price,
            condition: newItem.condition,
            description: newItem.description,
            images: [
              newItem?.images?.[0] || null,
              newItem?.images?.[1] || null,
            ],
            postedAt: newItem.postedAt,
            isBest:newItem.isBest
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

        const iteId = req.query.itemId;

        const query = { email: cart.email };
        const allCarts = await cartsCollection.find(query).toArray();

        if (allCarts.find((item) => item.itemId === iteId)) {
          return res.send({
            status: "error",
            message: "This Product alredy Add to Cart",
          });
        }

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
    app.post("/users", async (req, res) => {
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

        if (email !== req.decoded.email) {
          return res.status(403).json({ status: "forbidden access" });
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

    //payment getWay api

    const paymentCollection = PuratonBazar.collection("payment");

    app.post("/order", async (req, res) => {
      try {
        const order = req.body;

        console.log(order);

        // Create unique transaction ID
        const tran_id = "TXN_" + Date.now();

        const data = {
          total_amount: Number(order.price), // from client
          currency: "BDT",
          tran_id: tran_id,
          success_url: `http://localhost:3000/success/${tran_id}`,
          fail_url: `http://localhost:3000/fail/${tran_id}`,
          cancel_url: "http://localhost:3030/cancel",
          ipn_url: "http://localhost:3030/ipn",

          // Customer Info
          cus_name: order.name,
          cus_email: order.email,
          cus_add1: order.address,
          cus_add2: order.address,
          cus_city: "Dhaka",
          cus_state: "Dhaka",
          cus_postcode: "1000",
          cus_country: "Bangladesh",
          cus_phone: "01700000000",
          cus_fax: "01700000000",

          // Shipping Info
          shipping_method: "Courier",
          ship_name: order.name,
          ship_add1: order.address,
          ship_add2: order.address,
          ship_city: "Dhaka",
          ship_state: "Dhaka",
          ship_postcode: 1000,
          ship_country: "Bangladesh",

          // Product Info
          product_name: "Order Items",
          product_category: "Mixed",
          product_profile: "general",
        };

        // Initialize SSLCommerz
        const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
        sslcz.init(data).then(async (apiResponse) => {
          if (apiResponse?.GatewayPageURL) {
            res.send({
              url: apiResponse.GatewayPageURL,
            });

            const finalOrder = {
              ...order,
              tran_id,
              successStatus: false,
            };

            await paymentCollection.insertOne(finalOrder);

            const deleteQuery = {
              _id: { $in: order.id.map((id) => new ObjectId(id)) },
            };

            await cartsCollection.deleteMany(deleteQuery);
          } else {
            return res.status(400).send({
              message: "Payment session failed!",
            });
          }
        });
      } catch (err) {
        console.log(err);
        res.status(500).send({ error: err.message });
      }
    });

    app.post("/success/:tran_id", async (req, res) => {
      const tranId = req.params.tran_id;

      await paymentCollection.updateOne(
        { tran_id: tranId },
        { $set: { PaidStatus: true } }
      );

       // 🔥 Redirect to frontend success page
  res.redirect(`http://localhost:5173/payment-success?tran_id=${tranId}`);

     
    });

    app.post("/fail/:tran_id", async (req, res) => {
      const tranId = req.params.tran_id;

      res.redirect(`http://localhost:5173/payment-fail?tran_id=${tranId}`);
    });

    app.get("/paymentHistory/:email", async (req, res) => {
      try {
        const email = req.params.email;

        const query = { email: email };

        const result = await paymentCollection.find(query).toArray();

        res.status(200).json({ status: true, data: result });
      } catch (err) {
        res.status(500).json({ status: "fail", error: err });
      }
    });



app.patch("/payment-status/:_id", async (req, res) => {
  try {
    const _id = req.params._id;
    const query = { _id: new ObjectId(_id) };

    const updateDoc = {
      $set: { successStatus: true },
    };

    const result = await paymentCollection.updateOne(query, updateDoc);

    res.send({
      success: true,
      message: "successStatus updated to true",
      result,
    });

  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Error updating successStatus",
      error,
    });
  }
});

app.patch("/payment-cancel/:_id", async (req, res) => {
  try {
    const _id = req.params._id;
    const query = { _id: new ObjectId(_id) };

    const updateDoc = {
      $set: { successStatus: false },
    };

    const result = await paymentCollection.updateOne(query, updateDoc);

    res.send({
      success: true,
      message: "successStatus updated to false",
      result,
    });

  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Error updating successStatus",
      error,
    });
  }
});


    app.get("/payment-all", verifyToken, verifyAdmin, async (req, res) => {
  try {
    let { page = 0, limit = 10 } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    const skip = page * limit;

    const result = await paymentCollection
      .find()
      .skip(skip)
      .limit(limit)
      .toArray();

    const totalPayment = await paymentCollection.countDocuments();

    res.status(200).json({
      status: true,
      data: result,
      totalPayment,
    });
  } catch (err) {
    res.status(500).json({ status: "fail", error: err });
  }
});

      //dashboard state api

      //user order products state

      app.get("/dashboard-state/:email", async (req, res) => {
        
      const email = req.params.email;

      const result= await paymentCollection.aggregate([
        { $match: { email: email } },
        {
           $unwind: "$orderName"

         },
         {
          $lookup:{
            from:"products",
            localField:"orderName",
            foreignField:"name",
            as:"productDetails"
          }
         },
         {
          $unwind:"$productDetails"
         },
         {
          $group: {
              _id: "$productDetails.category",
              quentity: { $sum: 1 },
              totalPrice: { $sum: "$productDetails.price" },
            },
         },
         {
          $project:{
            catagory:"$_id",
            quentity:1,
            totalPrice:1,
            _id:0
          }
         }
       

      ]).toArray();

      res.send(result)
      
     
      
    });

    app.get('/user-state/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const query = { email };

    // total order count
    const totalOrder = await paymentCollection.countDocuments(query);

    // total amount
    const total_amount = await paymentCollection.aggregate([
      { $match: { email } },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: "$price" },
        },
      },
    ]).toArray();

    res.status(200).json({
      totalOrder,
      totalSpent: total_amount[0]?.totalSpent || 0, // <- BEST FIX
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
});
      //admin state api

    app.get("/state", async (req, res) => {
      const users = await usersCollection.estimatedDocumentCount();
      const order = await paymentCollection.estimatedDocumentCount();
      const allProduct = await products.estimatedDocumentCount();

      // Aggregate must use await!
      const result = await paymentCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: "$price" },
            },
          },
        ])
        .toArray();

      const revenue = result.length > 0 ? result[0].totalRevenue : 0;

      res.send({
        users,
        order,
        allProduct,
        revenue,
      });
    });

    app.get("/orderState", async (req, res) => {
      const result = await paymentCollection
        .aggregate([
          {
            $unwind: "$orderName",
          },
          {
            $lookup: {
              from: "products",
              localField: "orderName",
              foreignField: "name",
              as: "menuItems",
            },
          },
          {
            $unwind: "$menuItems",
          },
          {
            $group: {
              _id: "$menuItems.category",
              quentity: { $sum: 1 },
              totalPrice: { $sum: "$menuItems.price" },
            },
          },
          {
            $project: {
              _id: 0,
              category: "$_id",
              quentity: 1,
              totalPrice: 1,
            },
          },
        ])
        .toArray();

      res.send(result);
    });

    app.listen(3000, () => console.log("Server running on port 3000"));
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

// ⬇️ Express, MongoDB, JWT, SSLCommerz Import
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const SSLCommerzPayment = require("sslcommerz-lts");

// ⬇️ Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: ['https://puratonbazar.netlify.app', 'http://localhost:5173'],
  credentials: true,
}));
const PORT = parseInt(process.env.PORT) || 3000;

app.get("/", (req, res) => {
  res.send("Puraton Bazar Server is Running");
});

// ⬇️ SSLCommerz Credentials
const store_id = "midla68ef5f2b0cf63";
const store_passwd = "midla68ef5f2b0cf63@ssl";
const is_live = false;

// ⬇️ MongoDB Connection String
const uri = `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@cluster0.26qzwj8.mongodb.net/?appName=Cluster0`;

// ⬇️ Mongo Client Initialize
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// ⬇️ Main Server Function
async function run() {
  try {
    // await client.connect(); // MongoDB Connect

    /* -------------------------------------------
                JWT Authentication
    ------------------------------------------- */

    // ⬇️ Create JWT Token
    app.post("/jwt", async (req, res) => {
      const user = req.body;

      const token = jwt.sign(user, process.env.SECRITE_TOKEN, {
        expiresIn: "1h",
      });

      res.json({ token });
    });

    // ⬇️ Middleware: Verify JWT Token
    const verifyToken = (req, res, next) => {
      const authorization = req.headers.authorization;

      if (!authorization) {
        return res.status(401).send({ error: true, message: "Unauthorized" });
      }

      const token = authorization.split(" ")[1];

      jwt.verify(token, process.env.SECRITE_TOKEN, (err, decoded) => {
        if (err) {
          return res.status(401).send({ error: true, message: "Unauthorized" });
        }

        req.decoded = decoded;
        next();
      });
    };

    // ⬇️ Middleware: Verify Admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const user = await usersCollection.findOne({ email });

      if (user?.role !== "admin") {
        return res.status(403).send({ error: true, message: "Forbidden" });
      }

      next();
    };

    /* -------------------------------------------
                Database Collections
    ------------------------------------------- */
    const PuratonBazar = client.db("PuratonBazar");
    const products = PuratonBazar.collection("products");
    const cartsCollection = PuratonBazar.collection("carts");
    const usersCollection = PuratonBazar.collection("users");
    const paymentCollection = PuratonBazar.collection("payment");

    /* -------------------------------------------
                PRODUCTS API
    ------------------------------------------- */

    // ⬇️ Get All Products with Pagination + Filters + Search
    app.get("/products", async (req, res) => {
      try {
        let { page, limit, category, minPrice, maxPrice, search } = req.query;

        if (page) page = parseInt(page);
        if (limit) limit = parseInt(limit);
        if (minPrice) minPrice = parseInt(minPrice);
        if (maxPrice) maxPrice = parseInt(maxPrice);

        const filter = {};

        // Category filter
        if (category && category !== "ALL") filter.category = category;

        // Price filter
        if (minPrice && maxPrice) {
          filter.price = { $gte: minPrice, $lte: maxPrice };
        }

        // Search filter
        if (search?.trim()) {
          filter.$or = [
            { title: { $regex: search, $options: "i" } },
            { name: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
          ];
        }

        // Fetch Products
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
        res.status(500).json({ status: "error", message: "Server Problem" });
      }
    });

    // ⬇️ Get Best Products
    app.get("/best-product", async (req, res) => {
      try {
        const result = await products.find({ isBest: true }).toArray();
        res.status(200).json({ status: "ok", bestProduct: result });
      } catch (error) {
        res.status(500).json({ status: "error", message: error.message });
      }
    });

    // ⬇️ Get Latest Products
    app.get("/latest-products", async (req, res) => {
      try {
        const result = await products
          .find({})
          .sort({ postedAt: -1 })
          .limit(9)
          .toArray();

        res.status(200).json({ status: "ok", latestProducts: result });
      } catch (error) {
        res.status(500).json({ status: "error", message: error.message });
      }
    });

    // ⬇️ Delete a Product (Admin only)
    app.delete("/products/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const { id } = req.params;

        const result = await products.deleteOne({ _id: new ObjectId(id) });

        res.status(200).json({ status: "ok", data: result });
      } catch (error) {
        res.status(500).json({ status: "error", message: "Server problem" });
      }
    });

    // ⬇️ Get Single Product by ID
    app.get("/products/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid product ID" });
        }

        const result = await products.findOne({ _id: new ObjectId(id) });

        if (!result)
          return res.status(404).json({ message: "Product not found" });

        res.status(200).json({ status: "ok", data: result });
      } catch (error) {
        res.status(500).json({ status: "error", message: "Server problem" });
      }
    });

    // ⬇️ Create New Product (Admin only)
    app.post("/products", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const result = await products.insertOne(req.body);
        res.status(200).json({ status: "ok", data: result });
      } catch (error) {
        res.status(500).json({ status: "error", message: "Server problem" });
      }
    });

    // ⬇️ Update Product
    app.patch("/Products/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const newItem = req.body;

        const updateDoc = {
          $set: {
            ...newItem,
            images: [
              newItem?.images?.[0] || null,
              newItem?.images?.[1] || null,
            ],
          },
        };

        const result = await products.updateOne(
          { _id: new ObjectId(id) },
          updateDoc
        );

        res.status(200).json({ status: "ok", data: result });
      } catch (error) {
        res.status(500).json({ message: "Server problem" });
      }
    });

    /* -------------------------------------------
                CART API
    ------------------------------------------- */

    // ⬇️ Add to Cart
    app.post("/cart",verifyToken, async (req, res) => {
      try {
        const { email, itemId } = req.body;

        const exists = await cartsCollection.findOne({ email, itemId });

        if (exists) {
          return res.send({
            status: "error",
            message: "Product already added",
          });
        }

        const result = await cartsCollection.insertOne(req.body);

        res.status(200).json({ status: "ok", data: result });
      } catch (error) {
        res.status(500).json({ message: "Server problem" });
      }
    });

    // ⬇️ Get Cart Data
    app.get("/cart", verifyToken, async (req, res) => {
      try {
        const result = await cartsCollection
          .find({ email: req.query.email })
          .toArray();

        res.status(200).json({ status: "ok", data: result });
      } catch {
        res.status(500).json({ message: "Server problem" });
      }
    });

    // ⬇️ Delete Cart Item
    app.delete("/cart/:id", verifyToken, async (req, res) => {
      try {
        const result = await cartsCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });

        res.status(200).json({ status: "ok", data: result });
      } catch {
        res.status(500).json({ message: "Server problem" });
      }
    });

    /* -------------------------------------------
                USERS API
    ------------------------------------------- */

    // ⬇️ Create New User
    app.post("/users", async (req, res) => {
      try {
        const exists = await usersCollection.findOne({
          email: req.body.email,
        });

        if (exists)
          return res.json({ status: "no", data: "User already exists" });

        const result = await usersCollection.insertOne(req.body);

        res.status(200).json({ status: "ok", data: result });
      } catch {
        res.status(500).json({ message: "Server problem" });
      }
    });

    // ⬇️ Check if Admin
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      try {
        if (req.params.email !== req.decoded.email)
          return res.status(403).json({ message: "Forbidden" });

        const user = await usersCollection.findOne({
          email: req.params.email,
        });

        res.status(200).json({ isAdmin: user?.role === "admin" });
      } catch {
        res.status(500).json({ message: "Server problem" });
      }
    });

    // ⬇️ Get All Users
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 0;
        const limit = parseInt(req.query.limit) || 10;

        const users = await usersCollection
          .find()
          .skip(page * limit)
          .limit(limit)
          .toArray();

        const totalUsers = await usersCollection.countDocuments();

        res.status(200).json({ status: "ok", data: users, totalUsers });
      } catch {
        res.status(500).json({ message: "Server problem" });
      }
    });

    // ⬇️ Delete User
    app.delete("/users/:id",verifyToken, verifyAdmin, async (req, res) => {
      try {
        const result = await usersCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });

        res.status(200).json({ status: "ok", data: result });
      } catch {
        res.status(500).json({ message: "Server problem" });
      }
    });

    // ⬇️ Make Admin
    app.patch("/make-admin/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { role: "admin" } }
        );

        res.status(200).json({ status: "ok", data: result });
      } catch {
        res.status(500).json({ message: "Server problem" });
      }
    });

    // ⬇️ Make User
    app.patch("/make-user/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { role: "user" } }
        );

        res.status(200).json({ status: "ok", data: result });
      } catch {
        res.status(500).json({ message: "Server problem" });
      }
    });

    /* -------------------------------------------
                PAYMENT API (SSLCommerz)
    ------------------------------------------- */

    // ⬇️ Create Order (Payment Initialization)
    app.post("/order", verifyToken, async (req, res) => {
      try {
        const order = req.body;

        const tran_id = "TXN_" + Date.now(); // Unique transaction ID

        // ⬇️ Payment Data For SSLCommerz
        const data = {
          total_amount: Number(order.price),
          currency: "BDT",
          tran_id: tran_id,
          success_url: `https://puratonbazarserver.vercel.app/success/${tran_id}`,
          fail_url: `https://puratonbazarserver.vercel.app/fail/${tran_id}`,
          cancel_url: "http://localhost:3030/cancel",
          ipn_url: "http://localhost:3030/ipn",

          // Customer Info
          cus_name: order.name,
          cus_email: order.email,
          cus_add1: order?.address || "N/A",
          cus_city: "Dhaka",
          cus_country: "Bangladesh",
          cus_phone: "01700000000",

          // Shipping Info
          ship_name: order.name,
          ship_add1: order?.address || "N/A",

          // Product Info
          product_name: "Order Items",
          product_category: "Mixed",
          product_profile: "general",
           // ✅ Required Field
            shipping_method: "NO",
        };


        const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);

        // ⬇️ Start Payment Session
        sslcz.init(data).then(async (apiResponse) => {

          if (apiResponse?.GatewayPageURL) {

         

            res.send({ url: apiResponse.GatewayPageURL });

            await paymentCollection.insertOne({
              ...order,
              tran_id,
              successStatus: false,
            });

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
        res.status(500).send({ error: err.message });
      }
    });

    // ⬇️ Payment Success
    app.post("/success/:tran_id", async (req, res) => {
      const tranId = req.params.tran_id;

      await paymentCollection.updateOne(
        { tran_id: tranId },
        { $set: { PaidStatus: true } }
      );

      // Redirect to React Frontend
      res.redirect(`https://puratonbazar.netlify.app/payment-success?tran_id=${tranId}`);
    });

    // ⬇️ Payment Failed
    app.post("/fail/:tran_id", async (req, res) => {
      const tranId = req.params.tran_id;

      res.redirect(`http://localhost:5173/payment-fail?tran_id=${tranId}`);
    });

    /* -------------------------------------------
                PAYMENT HISTORY API
    ------------------------------------------- */

    // ⬇️ User Payment History with Pagination
    app.get("/paymentHistory/:email", verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        const skip = parseInt(req.query.skip) || 0;
        const limit = parseInt(req.query.limit) || 10;

        const query = { email };

        const result = await paymentCollection
          .find(query)
          .skip(skip * limit)
          .limit(limit)
          .toArray();

        const totalPayment = await paymentCollection.countDocuments(query);

        res.status(200).json({ status: true, data: result, totalPayment });
      } catch (err) {
        res.status(500).json({ status: "fail", error: err });
      }
    });

    // ⬇️ Update Payment Status (Success)
    app.patch("/payment-status/:_id", verifyToken,verifyAdmin, async (req, res) => {
      try {
        const id = req.params._id;

        const result = await paymentCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { successStatus: true } }
        );

        res.send({
          success: true,
          message: "Payment successStatus updated",
          result,
        });
      } catch (error) {
        res.status(500).send({ success: false, error });
      }
    });

    // ⬇️ Cancel Payment Status
    app.patch("/payment-cancel/:_id", verifyToken,verifyAdmin, async (req, res) => {
      try {
        const id = req.params._id;

        const result = await paymentCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { successStatus: false } }
        );

        res.send({
          success: true,
          message: "Payment canceled",
          result,
        });
      } catch {
        res.status(500).send({ success: false, message: "Error" });
      }
    });

    // ⬇️ Admin: All Payments List
    app.get("/payment-all", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const page = parseInt(req.query.page) || 0;
        const limit = parseInt(req.query.limit) || 10;

        const result = await paymentCollection
          .find()
          .skip(page * limit)
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

    /* -------------------------------------------
                USER DASHBOARD STATE
    ------------------------------------------- */

    // ⬇️ User category-wise purchase stats
    app.get("/dashboard-state/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      const result = await paymentCollection
        .aggregate([
          { $match: { email } },
          { $unwind: "$orderName" },
          {
            $lookup: {
              from: "products",
              localField: "orderName",
              foreignField: "name",
              as: "productDetails",
            },
          },
          { $unwind: "$productDetails" },
          {
            $group: {
              _id: "$productDetails.category",
              quentity: { $sum: 1 },
              totalPrice: { $sum: "$productDetails.price" },
            },
          },
          {
            $project: {
              _id: 0,
              catagory: "$_id",
              quentity: 1,
              totalPrice: 1,
            },
          },
        ])
        .toArray();

      res.send(result);
    });

    // ⬇️ User Total Order + Total Amount
    app.get("/user-state/:email", verifyToken, async (req, res) => {
      try {
        const email = req.params.email;

        const totalOrder = await paymentCollection.countDocuments({ email });

        const total_amount = await paymentCollection
          .aggregate([
            { $match: { email } },
            {
              $group: {
                _id: null,
                totalSpent: { $sum: "$price" },
              },
            },
          ])
          .toArray();

        res.json({
          totalOrder,
          totalSpent: total_amount[0]?.totalSpent || 0,
        });
      } catch {
        res.status(500).json({ error: "Server error" });
      }
    });

    /* -------------------------------------------
                ADMIN STATE API
    ------------------------------------------- */

    // ⬇️ Admin Dashboard (Users, Orders, Products, Revenue)
    app.get("/state", verifyToken, verifyAdmin, async (req, res) => {
      const users = await usersCollection.estimatedDocumentCount();
      const order = await paymentCollection.estimatedDocumentCount();
      const allProduct = await products.estimatedDocumentCount();

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

    // ⬇️ Category-wise Order State (Admin)
    app.get("/orderState", verifyToken, verifyAdmin, async (req, res) => {
      const result = await paymentCollection
        .aggregate([
          { $unwind: "$orderName" },
          {
            $lookup: {
              from: "products",
              localField: "orderName",
              foreignField: "name",
              as: "menuItems",
            },
          },
          { $unwind: "$menuItems" },
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

    /* -------------------------------------------
                START SERVER
    ------------------------------------------- */

    // app.listen(3000, () => console.log("Server running on port 3000"));

    // await client.db("admin").command({ ping: 1 });
    // console.log("Connected to MongoDB!");

  } finally {
  }
}

run().catch(console.dir);

module.exports = app;

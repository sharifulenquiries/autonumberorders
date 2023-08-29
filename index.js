const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const WooCommerceAPI = require("woocommerce-api");

const app = express();
const port = process.env.PORT || 8000;

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Server Working");
});

// Create a new instance of the WooCommerceAPI with your credentials
const WooCommerce = new WooCommerceAPI({
  url: "https://fyrosefood.com",
  consumerKey: "ck_57ab7cc3264cad5b45d33b7d9ac83204890f5810",
  consumerSecret: "cs_37a3ef9c10067cdca9298ac4cabc1aee2f5443ed",
  wpAPI: true,
  version: "wc/v3",
});

const productList = [
  {
    id: 2058,
    price: 600,
  },
  {
    id: 2054,
    price: 800,
  },
  {
    id: 2049,
    price: 500,
  },
  {
    id: 2055,
    price: 400,
  },
  {
    id: 424,
    price: 300,
  },
  {
    id: 2051,
    price: 1200,
  },
];
// CRUD operations
async function run() {
  try {
    const client = new MongoClient(
      "mongodb+srv://sharifulenquiries:YS8RusGPx3xJNED7@cluster0.rpgoz1l.mongodb.net/?retryWrites=true&w=majority"
    );
    const database = await client.db("testdb");

    // Calling collections
    const msgss = await database.collection("orders");

    // Add services
    app.get("/api/:data", async (req, res) => {
      const createdAt = new Date();

      const str = req.params.data;
      // Remove all "+"
      let cleanedStr = str.replace(/\+/g, " ");

      // Extracting Phone Number
      const phoneNumberRegex = /from (\d+)/i;
      const phoneNumberMatch = cleanedStr.match(phoneNumberRegex);
      const phoneNumber = phoneNumberMatch ? phoneNumberMatch[1] : null;

      // Extracting Transaction ID
      const trxIDRegex = /TrxID (\w+)/;
      const trxIDMatch = cleanedStr.match(trxIDRegex);
      const trxID = trxIDMatch ? trxIDMatch[1] : null;

      // Extracting Received Payment
      const receivedPaymentRegex = /received payment Tk (\d+\.\d+)/i;
      const receivedPaymentRegex2 = /received payment Tk (\d+\,\d+)/i;
      const receivedPaymentMatch = cleanedStr.match(receivedPaymentRegex);

      let receivedPayment = receivedPaymentMatch
        ? receivedPaymentMatch[1]
        : cleanedStr.match(receivedPaymentRegex2)[1].replace(",", "");

      const result = await msgss.insertOne({
        phoneNumber,
        trxID,
        receivedPayment: parseInt(receivedPayment),
        createdAt,
      });

      const productPrice = 600; // Assuming the product price is 600
      const calculatedQuantity = Math.floor(
        parseInt(receivedPayment) / productPrice
      );

      const params = req.params.text;
      // Define the order data
      const orderData = {
        payment_method: "bkash",
        payment_method_title: "bKash",
        set_paid: true,
        transaction_id: trxID,
        billing: {
          first_name: trxID + " " + phoneNumber,
          email: "unknown@unknown.com",
          phone: phoneNumber,
        },
        line_items: [
          {
            product_id: 2058, // ID of the product
            quantity: calculatedQuantity,
          },
        ],
        meta_data: [
          {
            key: "Transaction ID",
            value: trxID,
          },
        ],
      };

      // Create the order
      WooCommerce.post("orders", orderData, (err, data, response) => {
        if (err) {
          console.log(err);
          return res.status(500).json({ error: "Failed to create order" });
        }

        return res
          .status(200)
          .json({ message: "Order created successfully", order: data });
      });
    });

    app.get("/api:data", async (req, res) => {
      const createdAt = new Date();

      const str = req.params.data;
      // Remove all "+"
      let cleanedStr = str.replace(/\+/g, " ");

      // Extracting Phone Number
      const phoneNumberRegex = /from (\d+)/i;
      const phoneNumberMatch = cleanedStr.match(phoneNumberRegex);
      const phoneNumber = phoneNumberMatch ? phoneNumberMatch[1] : null;

      // Extracting Transaction ID
      const trxIDRegex = /TrxID (\w+)/;
      const trxIDMatch = cleanedStr.match(trxIDRegex);
      const trxID = trxIDMatch ? trxIDMatch[1] : null;

      // Extracting Received Payment
      const receivedPaymentRegex = /received payment Tk (\d+\.\d+)/i;
      const receivedPaymentRegex2 = /received payment Tk (\d+\,\d+)/i;
      const receivedPaymentMatch = cleanedStr.match(receivedPaymentRegex);

      let receivedPayment = receivedPaymentMatch
        ? receivedPaymentMatch[1]
        : cleanedStr.match(receivedPaymentRegex2)[1].replace(",", "");

      const result = await msgss.insertOne({
        phoneNumber,
        trxID,
        receivedPayment: parseInt(receivedPayment),
        createdAt,
      });

      // calculate closest product price from productList

      let produdct_id = 0;
      let productPrice = 0;
      let calculatedQuantity = 0;

      productList.forEach((item) => {
        // if proudct price modulas recvie is 0 then it is a valid price
        if (parseInt(receivedPayment) % item.price === 0) {
          produdct_id = item.id;
          productPrice = item.price;
          calculatedQuantity = parseInt(receivedPayment) / item.price;
          return;
        } else {
          // if proudct price modulas recvie is not 0 then it is a invalid price
          // so we need to find the closest price
          const closestPrice = Math.min.apply(
            null,
            productList.map((item) => {
              return Math.abs(item.price - parseInt(receivedPayment));
            })
          );
          const closestProduct = productList.find((item) => {
            return (
              Math.abs(item.price - parseInt(receivedPayment)) === closestPrice
            );
          });
          produdct_id = closestProduct.id;
          productPrice = closestProduct.price;
          calculatedQuantity = Math.floor(
            parseInt(receivedPayment) / closestProduct.price
          );
        }
      });

      const params = req.params.text;
      // Define the order data
      const orderData = {
        payment_method: "bkash",
        payment_method_title: "bKash",
        set_paid: true,
        transaction_id: trxID,
        billing: {
          first_name: trxID + " " + phoneNumber,
          email: "unknown@unknown.com",
          phone: phoneNumber,
        },
        line_items: [
          {
            product_id:  produdct_id, // ID of the product
            quantity: calculatedQuantity,
          },
        ],
        meta_data: [
          {
            key: "Transaction ID",
            value: trxID,
          },
        ],
      };

      // Create the order
      WooCommerce.post("orders", orderData, (err, data, response) => {
        if (err) {
          console.log(err);
          return res.status(500).json({ error: "Failed to create order" });
        }

        return res
          .status(200)
          .json({ message: "Order created successfully", order: data });
      });
    });

    // get all invalid numbers  characters length less than 11
    app.get("/delete", async (req, res) => {
      const result = await msgss.deleteMany({
        $and: [
          { phoneNumber: { $exists: true } }, // Check if phoneNumber field exists
          { $expr: { $gt: [{ $strLenCP: "$phoneNumber" }, 11] } },
        ],
      });

      res.status(200).json({ data: result });
    });

    // get single number transactions

    app.get("/number/:id", async (req, res) => {
      const id = req.params.id;
      const result = await msgss
        .find({ phoneNumber: id })
        .sort({ createdAt: -1 })
        .toArray();
      const sum = await msgss.aggregate([
        {
          $match: {
            phoneNumber: id,
          },
        },
        {
          $group: {
            _id: "$phoneNumber",
            Received: { $sum: "$receivedPayment" },
            Sent: { $sum: "$sentPayment" },
            transactionsTimes: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            phoneNumber: "$_id",
          },
        },
      ]);

      res.status(200).json({ list: result, sum: sum });
    });

    app.get("/numbers", async (req, res) => {
      //?pagination[current]=1&pagination[pageSize]=10&column[title]=Sent Amount&column[dataIndex]=Sent&column[sorter]=true&column[width]=20%&order=ascend&field=Sent
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.pageSize) || 10;
      const skip = (page - 1) * pageSize;
      const limit = pageSize;

      const total = await msgss
        .aggregate([
          {
            $group: {
              _id: "$phoneNumber",
              Received: { $sum: "$receivedPayment" },
              Sent: { $sum: "$sentPayment" },
              transactionsTimes: { $sum: 1 },
            },
          },
          {
            $project: {
              _id: 0,
              phoneNumber: "$_id",
            },
          },
        ])
        .toArray();

      const pages = Math.ceil(total.length / pageSize);
      //sort
      const sort = req.query.order || "ascend";
      const field = req.query.field || "Sent";
      const sortObj = {};

      sortObj[field] = sort === "ascend" ? 1 : -1;

      // default sort
      sortObj["createdAt"] = -1;

      //filter
      const filter = req.query.filter || "";
      const filterObj = {};
      filterObj[field] = { $regex: filter, $options: "i" };

      const orders = await msgss
        .aggregate([
          {
            $group: {
              _id: "$phoneNumber",
              Received: { $sum: "$receivedPayment" },
              Sent: { $sum: "$sentPayment" },
              transactionsTimes: { $sum: 1 },
              createdAt: { $last: "$createdAt" },
            },
          },
          {
            $project: {
              _id: 0,
              phoneNumber: "$_id",
              createdAt: 1,
              Received: 1,
              Sent: 1,
              transactionsTimes: 1,
              TotalSentAndReceived: { $sum: ["$Received", "$Sent"] },
            },
          },
          { $sort: sortObj },
          { $skip: skip },
          { $limit: limit },
        ])
        .toArray();

      res.status(200).json({
        data: orders,
        page,
        pageSize,
        pages,
        total: total.length,
        skip,
        limit,
      });
    });

    // add multiple numbers without woocommerce
    app.post("/add", async (req, res) => {
      const data = req.body;
      // add date to each object
      data.forEach((item) => {
        item.createdAt = new Date();
      });

      const result = await msgss.insertMany(data);

      res.status(200).json({ data: result });
    });

    //   update all  received amount 0
  } finally {
  }
}

run().catch((error) => console.log(error));

app.listen(port, () => {
  console.log(`server listen on port ${port}`);
});

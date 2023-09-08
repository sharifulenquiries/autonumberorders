const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const WooCommerceAPI = require("woocommerce-api");
const axios = require("axios");

const app = express();
const port = process.env.PORT || 8000;

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Server Working");
});

// Create a new instance of the WooCommerceAPI with your credentials
const WooCommerce = new WooCommerceAPI({
  url: "https://hostmsn.com",
  consumerKey: "ck_786fa0b155e6ba15579ca8997829fc0a81063eb0",
  consumerSecret: "cs_483f23aa650611797a259d15bf0d658ec531239d",
  wpAPI: true,
  version: "wc/v3",
});

// CRUD operations
async function run() {
  try {
    const client = new MongoClient(
      "mongodb+srv://blogkawsar:DyUHLUUmnkEMlKTI@cluster0.zwupuzd.mongodb.net/?retryWrites=true&w=majority"
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
            product_id: 628, // ID of the product
            quantity: parseInt(receivedPayment),
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
          // { $expr: { $lt: [{ $strLenCP: "$phoneNumber" }, 11] }  check if phoneNumber length is less than 11 or greater than 11
          {
            $expr: {
              $or: [
                { $lt: [{ $strLenCP: "$phoneNumber" }, 11] },
                { $gt: [{ $strLenCP: "$phoneNumber" }, 11] },
              ],
            },
          },
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
      sortObj["createdAt"] = 1;

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
      try {
        const data = req.body;

        const newData = [];
        data.forEach((element) => {
          if (element.phoneNumber && element.phoneNumber.length === 11) {
            element.createdAt = new Date();
            newData.push(element);
          }
        });

        const promises = newData.map(async (item) => {
          const phoneNumber = item.phoneNumber;
          const sentPayment = item.sentPayment;
          const trxID = item.trxID;
          if (!trxID || trxID == "not sent") return;
          const response = await axios.get(
            `https://sms.amaexbd.com/services/send.php?key=2bd2aac3c879b38c4769bfd108ca9b0fc568a874&number=${phoneNumber}&message=${sentPayment}TK+(+TRXID+${trxID}+)+Withdraw+Request+Sofol+Vave+Submit+Hyeche.+%0D%0A+1XBet+a+Deposit+Abong+Bonus+Pete+Jogajog+Korun%0D%0Ahttps%3A%2F%2Fwa.me%2F%2B8801987352371%0D%0A&option=2&type=sms&useRandomDevice=1&prioritize=0`
          );
          console.log(response.data);
        });

        await Promise.all(promises);

        const result = await msgss.insertMany(newData); // Assuming msgss is defined

        res.status(200).json({ data: result });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "An error occurred." });
      }
    });

    //   update all  received amount 0
  } finally {
  }
}

run().catch((error) => console.log(error));

app.listen(port, () => {
  console.log(`server listen on port ${port}`);
});

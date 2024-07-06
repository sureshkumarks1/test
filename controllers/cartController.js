const mongoose = require("mongoose");
const { User } = require("../models/userModel");
const { Product } = require("../models/productModel");
const profileCollection = require("../models/addressModel.js");
const cartCollection = require("../models/cartModel.js");
const ObjectId = require("mongodb").ObjectId;
require("dotenv").config();

const orderCollection = require("../models/orderModel.js");

async function grandTotal(req) {
  try {
    let grandTotal = 0;
    let userCartData = await cartCollection
      .find({ userId: req.session.user_id })
      .populate("productId");
    if (!userCartData) {
      grandTotal = 0;
    } else {
      for (const eachitem of userCartData) {
        grandTotal += eachitem.productId.price * eachitem.productQuantity;
        await cartCollection.updateOne(
          { _id: eachitem._id },
          {
            $set: {
              totalCostPerProduct:
                eachitem.productId.price * eachitem.productQuantity,
            },
          }
        );
      }
    }

    userCartData = await cartCollection
      .find({ userId: req.session.user_id })
      .populate("productId");

    req.session.grandTotal = grandTotal;

    return JSON.parse(JSON.stringify(userCartData));
    // return obj;
  } catch (error) {
    console.log(error);
  }
}
const cart = async (req, res) => {
  try {
    let userCartData = await grandTotal(req);

    //console.log(userCartData);

    res.render("cart", {
      signIn: req.session.signIn,
      user: req.body.user,
      name: req.body.user,
      currentUser: req.session.currentUser,
      userCartData,
      grandTotal: req.session.grandTotal,
    });
  } catch (error) {
    console.error("Error in cart:", error);
    // res.status(500).send("Internal Server Error");
    // res.redirect('/loginpage')
  }
};

const addToCart = async (req, res) => {
  // console.log("the product is : ", req.body.id);

  const pid = req.body.id;

  // console.log(req.session.user_id);

  try {
    let existingProduct = await cartCollection.findOne({
      userId: req.session.user_id,
      productId: pid,
    });

    if (existingProduct) {
      await cartCollection.updateOne(
        { _id: existingProduct._id },
        { $inc: { productQuantity: 1 } }
      );
    } else {
      // console.log("i am from insert to cart", pid);
      await cartCollection.create({
        userId: req.session.user_id,
        productId: pid,
        productQuantity: 1,
        currentUser: req.session.currentUser,
        user: req.session.uname,
      });
    }

    //res.redirect("/cart");
    res.status(200).json({ success: true });
  } catch (error) {
    console.log(error);
  }
};

const deleteFromCart = async (req, res) => {
  try {
    let cartProduct = await cartCollection.findOneAndDelete({
      _id: req.params.id,
    });
    
    await grandTotal(req);
    res.json({
      success: true,
    });
  } catch (error) {
    console.error(error);
  }
};
const decQty = async (req, res) => {
  try {
    let cartProduct = await cartCollection
      .findOne({ _id: req.params.id })
      .populate("productId");
    if (cartProduct.productQuantity > 1) {
      --cartProduct.productQuantity;
      cartProduct.totalCostPerProduct =
        cartProduct.productQuantity * cartProduct.productId.price;
    }

    cartProduct = await cartProduct.save();
    await grandTotal(req);
    res.json({
      success: true,
      cartProduct,
      grandTotal: req.session.grandTotal,
      currentUser: req.session.currentUser,
      user: req.body.user,
    });
  } catch (error) {
    console.error(error);
  }
};
const incQty = async (req, res) => {
  try {
    let cartProduct = await cartCollection
      .findOne({ _id: req.params.id })
      .populate("productId");

    if (cartProduct.productQuantity < cartProduct.productId.stock) {
      ++cartProduct.productQuantity;
      cartProduct.totalCostPerProduct =
        cartProduct.productQuantity * cartProduct.productId.price;
    } else {
      res.json({ message: "Limit Exceeded" });
    }

    cartProduct = await cartProduct.save();

    await grandTotal(req);
    res.json({
      success: true,
      cartProduct,
      grandTotal: req.session.grandTotal,
      currentUser: req.session.currentUser,
      user: req.body.user,
    });
  } catch (error) {
    console.error(error);
  }
};

const checkoutPage = async (req, res) => {
  // console.log(req.params.id);

  try {
    let cartData = await cartCollection
      .find({ userId: req.session.user_id, productId: req.params.id })
      .populate("productId");
    let addressData = await profileCollection.find({
      userId: req.session.user_id,
    });

    if (addressData.length > 0) {
      let userCartData = await grandTotal(req);

      res.render("checkoutPage", {
        signIn: req.session.signIn,
        user: req.body.user,
        name: req.body.user,
        currentUser: req.session.currentUser,
        couponTotal: req.session?.couponTotal
          ? req.session?.couponTotal
          : req.session.grandTotal,
        grandTotal: req.session.grandTotal,
        userCartData,
        cartData,
        addressData: req.session.addressData,
        addressData,
      });
    } else {
      req.session.addressPageFrom = "cart";
      // res.render("checkoutPage");
    }
  } catch (error) {
    res.redirect("/cart");
  }
};

const verifyPayment = (req, res) => {
  // console.log(req.body);

  const { rzp, oid } = req.body;

  const toBeHash = oid + "|" + rzp.razorpay_payment_id;

  // console.log("To be convert to hash==> ", toBeHash);

  const { createHmac } = require("crypto");

  const secret = process.env.RAZOR_KEY_SECRET;
  // console.log("To secret key ==> ", secret);
  const hash = createHmac("sha256", secret).update(toBeHash).digest("hex");

  // console.log(hash);

  if (rzp.razorpay_signature == hash) {
    // console.log("hi i am from hash verification section true");
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
};

const orderPlaced = async (req, res) => {
  try {
    //incase of COD

    /*await orderCollection.updateOne(
      { _id: req.session.currentOrder._id },
      {
        $set: {
          paymentId: "generatedAtDelivery",
          paymentType: "COD",
        },
      }
    );*/

    res.send({ success: true });
  } catch (error) {
    console.error(error);
  }
};

const cartCount = (req, res) => {
  return new Promise(async (resolve, reject) => {
    let cartItems = await cartCollection
      .find({ userId: req.session.user_id })
      .countDocuments();
    // console.log(cartItems);
    resolve(cartItems);
  });
};

async function createOrder(req) {
  const { address, payment, total } = req.body;

  // console.log(req.body);

  const dataObj = {
    userId: req.session.user_id,
    orderNumber: (await orderCollection.countDocuments()) + 1,
    orderDate: new Date(),
    addressChosen: new ObjectId(address),
    cartData: await grandTotal(req),
    grandTotalCost: total,
    // grandTotalCost: req.session.grandTotal,
    paymentType: payment,
  };

  const odresult = await orderCollection
    .create(dataObj)
    .then((data) => {
      return data;
    })
    .catch((err) => {
      next(err);
    });
  //delete product from cart since the order is placed
  await cartCollection.deleteMany({ userId: req.session.user_id });
  return odresult;
}

const orderPlacedEnd = async (req, res, next) => {
  // console.log(req.body);

  try {
    const { address, payment } = req.body;

    // let cartData = await cartCollection
    //   .find({ userId: req.session.user_id })
    //   .populate("productId");

    console.log(payment);

    if (payment == "COD") {
      const orderResult = await createOrder(req)
        .then((data) => {
          res.json({ success: true, data: data });
        })
        .catch((err) => next(err));
    }

    if (payment == "RP") {
      const orderResult = await createOrder(req);

      const totAmt = orderResult.grandTotalCost * 100;
      const Razorpay = require("razorpay");
      const instance = new Razorpay({
        key_id: process.env.RAZOR_KEY_ID,
        key_secret: process.env.RAZOR_KEY_SECRET,
      });
      const options = {
        amount: parseInt(totAmt), // amount in the smallest currency unit
        currency: "INR",
        receipt: orderResult._id.toString(),
      };
      instance.orders.create(options, function (err, order) {
        if (err) {
          next(err);
        }
        // console.log("The return ", order);

        res.json({
          success: true,
          ord_id: orderResult._id.toString(),
          oid: order.id,
          totalAmount: parseInt(totAmt),
          order: order,
        });
      });
    }

    // console.log(dataObj);
    // console.log(odresult);
    // req.session.currentOrder = await orderCollection.create({
    //   userId: req.session.user_id,
    //   orderNumber: (await orderCollection.countDocuments()) + 1,
    //   orderDate: new Date(),
    //   addressChosen: ObjectId(req.params.id),
    //   cartData: await grandTotal(req),
    //   grandTotalCost: req.session.grandTotal,
    //   paymentType: req.params.pm
    // });
    /*
  for (const item of cartData) {
    item.productId.productStock -= item.productQuantity; // we use for reducing Qyantity
    item.productId.stockSold += 1; //stocjSolf ++
    await item.productId.save();
  }
*/
    // let orderData = await orderCollection.findOne({
    //   _id: req.session.currentOrder._id,
    // });
    /*
  if (orderData.paymentType == "toBeChosen") {
    orderData.paymentType = "COD";
    orderData.save();
  }
  
  let x = await cartCollection
    .findByIdAndUpdate({ _id: req.session.currentOrder._id })
    .populate("productId");*/
  } catch (err) {
    next(err);
  }
};

const endOrderPage = (req, res, next) => {
  const { oid } = req.params;

  res.render("orderPlaced", {
    signIn: req.session.signIn,
    user: req.session.user,
    name: req.session.user,
    ordId: oid,
  });
};

module.exports = {
  cart,
  addToCart,
  deleteFromCart,
  decQty,
  incQty,
  checkoutPage,
  orderPlaced,
  orderPlacedEnd,
  verifyPayment,
  endOrderPage,
};

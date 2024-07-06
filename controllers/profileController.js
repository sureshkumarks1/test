const bcrypt = require("bcrypt");
const { User } = require("../models/userModel");
const addressCollection = require("../models/addressModel");
const orderCollection = require("../models/orderModel");
const walletCollection = require("../models/walletModel");
const cartCollection = require("../models/cartModel");
const formatDate = require("../services/formatDateHelper");
const { checkUser } = require("../helper/checkUser");

module.exports = {
  myWishList: (req, res) => {
    res.render("wishlist", { name: req.session?.name });
  },
  accountPage: async (req, res, next) => {
    try {
      let userData = await User.find({
        _id: req.session.user_id,
      });

      const addressData = await addressCollection.find({
        userId: req.session?.user_id,
      });

      res.render("profile", {
        currentUser: req.session?.currentUser,
        name: req.session?.name,
        userData,
        addressData,
        userId: req.session?.user_id,
      });
    } catch (error) {
      next(error);
    }
  },

  myAddress: async (req, res) => {
    try {
      const addressData = await addressCollection.find({
        userId: req.session.user_id,
      });
      res.render("users/myAddress", {
        currentUser: req.session.currentUser,
        addressData,
      });
    } catch (error) {
      console.error(error);
    }
  },

  singleAddress: async (req, res) => {
    try {
      const addressData = await addressCollection.find({
        _id: req.params.id,
        userId: req.session.user_id,
      });
      res.json({ data: addressData });
      // console.log(addressData);
    } catch (error) {
      console.error(error);
    }
  },

  addAddressPost: async (req, res) => {
    //console.log(req.body);

    try {
      const address = {
        userId: req.session.user_id,
        addressTitle: req.body.addressTitle,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        addressLine1: req.body.addressLine1,
        addressLine2: req.body.addressLine2,
        phone: req.body.phone,
        state: req.body.state,
      };

      const result = await addressCollection.insertMany([address]);
      if (!result) res.send({ success: false });
      else res.send({ success: true });
    } catch (error) {
      console.error(error);
    }
  },

  editAddressPost: async (req, res) => {
    try {
      const address = {
        addressTitle: req.body.addressTitle,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        addressLine1: req.body.addressLine1,
        addressLine2: req.body.addressLine2,
        phone: req.body.phone,
      };

      await addressCollection.updateOne({ _id: req.body.id }, address);

      res.send({ success: true });
    } catch (error) {
      console.error(error);
    }
  },

  deleteAddress: async (req, res) => {
    try {
      const result = await addressCollection.deleteOne({ _id: req.params.id });
      // const result = true;
      if (!result) res.send({ success: false });
      else res.send({ success: true });
    } catch (error) {
      console.log(error);
    }
  },

  getPassword: async (req, res) => {
    try {
      //console.log(req.body.password);

      const cpassword = await User.findOne({
        _id: req.session.user_id,
      }).select("password");

      // console.log(req.session.currentUser);

      const compareCurrentPass = bcrypt.compareSync(
        req.body.password,
        cpassword.password
      );

      //console.log(compareCurrentPass);

      res.json({ success: compareCurrentPass });
    } catch (error) {
      console.error(error);
    }
  },

  changePassword: async (req, res, next) => {
    try {
      if (!req.session.name) {
        return new Error("No Logined User");
      }
      const cpassword = await User.findOne({
        _id: req.session.user_id,
      }).select("password");

      res.render("changePassword", {
        currentPassword: cpassword,
        currentUser: req.session.currentUser,
        name: req.session.currentUser.name,
      });
    } catch (error) {
      next(error);
    }
  },

  changePasswordPatch: async (req, res) => {
    if (!req.session.name) {
      return new Error("No Logined User");
    }
    const cpassword = await User.findOne({
      _id: req.body.userId,
    }).select("password");
    // console.log("The current password", cpassword);

    try {
      const compareCurrentPass = bcrypt.compareSync(
        req.body.password,
        cpassword.password
      );

      if (compareCurrentPass) {
        const encryptedNewPassword = bcrypt.hashSync(req.body.password, 10);
        await User.updateOne(
          { _id: req.session.user_id },
          { $set: { password: encryptedNewPassword } }
        );
        req.session.currentPassword = await User.find({
          _id: req.session.user_id,
        });
        res.json({ success: true });
      } else {
        req.session.invalidCurrentPassword = true;
        res.json({ success: false, message: "password not correct" });
      }
    } catch (error) {
      console.error(error);
    }
  },

  chgresetpass: async (req, res) => {
    try {
      const encryptedNewPassword = bcrypt.hashSync(req.body.password, 10);
      await User.updateOne(
        { email: req.session.email },
        { $set: { password: encryptedNewPassword } }
      );

      res.json({ success: true });
    } catch (error) {
      console.error(error);
    }
  },
  orderHistory: async (req, res) => {
    try {
      if (!req.session.name) {
        return new Error("No Logined User");
      }
      let orderData = await orderCollection
        .find({
          userId: req.session.user_id,
        })
        .sort({ orderDate: -1 });
      // orderData = orderData.filter(
      //   (order) => order.paymentType !== "toBeChosen"
      // );

      orderData = orderData.map((ordata) => {
        ordata.orderDateFormatted = formatDate(ordata.orderDate);
        //console.log("orderStatus : ", ordata.orderStatus);
        if (ordata.orderStatus == "Placed") {
          ordata.paymentType = "Pending";
        }
        return ordata;
      });

      res.render("orderHistory", {
        currentUser: req.session.currentUser,
        name: req.session?.currentUser?.name,
        orderData,
      });
    } catch (error) {
      console.error(error);
    }
  },
  orderStatus: async (req, res) => {
    try {
      if (!req.session.name) {
        return new Error("No Logined User");
      }
      let orderData = await orderCollection
        .findOne({ _id: req.params.id })
        .populate("addressChosen");
      let isCancelled = orderData.orderStatus == "Cancelled" ? true : false;
      let isReturn = orderData.orderStatus == "Return" ? true : false;
      res.render("users/orderStatus", {
        currentUser: req.session.currentUser,
        orderData,
        isCancelled,
        isReturn,
      });
    } catch (error) {
      console.error(error);
    }
  },

  cancelOrder: async (req, res) => {
    try {
      if (!req.session.name) {
        return new Error("No Logined User");
      }
      /*const result = await orderCollection.findByIdAndUpdate(
        { _id: req.params.id },
        { $set: { orderStatus: "Cancelled",  } }
      );*/

      let orderData = await orderCollection.findOne({ _id: req.params.id });
      /*
      if (orderData.paymentStatus != "Pending") {
        let walletTransaction = {
          transactionDate: new Date(),
          transactionAmount: orderData.grandTotalCost,
          transactionType: "Refund from returned Order",
        };

        const wallet = await walletCollection.findOneAndUpdate(
          { userId: orderData.userId },
          {
            $inc: { walletBalance: orderData.grandTotalCost },
            $push: { walletTransaction },
          }
        );
      }

      */

      console.log(orderData.cartData);
      orderData.cartData.map((item) => {
        item.productId._id.stock += item.productQuantity;
      });

      //reducing from stock qty
      // cartData.map(async (v) => {
      //   v.productId.productStock += v.productQuantity;
      //   await v.productId.save();
      //   return v;
      // });

      res.send({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  },

  showOrderDetailsPage: async (req, res, next) => {
    try {
      if (!req.session.name) {
        return new Error("No Logined User");
      }
      const name = req.session.name;
      let orderData = await orderCollection
        .find({
          _id: req.params.id,
          userId: req.session.user_id,
        })
        .populate("addressChosen");

      const products = orderData[0].cartData;
      res.render("orderDetails", {
        name: name,
        data: orderData,
        products: products,
      });
    } catch (error) {
      next(error);
    }
  },

  getOrderDetails: async (req, res, next) => {
    try {
      if (!req.session.name) {
        return new Error("No Logined User");
      }
      let orderData = await orderCollection
        .find({
          _id: req.params.id,
          userId: req.session.user_id,
        })
        .populate("addressChosen");
      res.send({ data: orderData });
      //console.log(orderData);
    } catch (error) {
      next(error);
    }
  },

  loadWallet: async (req, res, next) => {
    try {
      if (!req.session.name) {
        return new Error("No Logined User");
      }

      let data = await walletCollection.find({
        _id: req.params.id,
        userId: req.session.user_id,
      });

      if (!data.length) {
        data = null;
      }

      res.render("wallet", { name: req.session?.name, data: data });
    } catch (error) {
      next(error);
    }
  },
};

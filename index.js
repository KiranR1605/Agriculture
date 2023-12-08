require("dotenv").config();
const express = require("express");

const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const bodyParser = require("body-parser");
const ejs = require("ejs");
const session = require("express-session");
const mongoose = require("mongoose");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const { log } = require("console");


const stripe = require("stripe")(process.env.SECRET_KEY);

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: "HACKKKERERRERE",
    saveUninitialized: false,
    resave: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

const dbUrl = `mongodb+srv://Aditya:${process.env.MONG_PASS}@cluster0.oidwt4d.mongodb.net/?retryWrites=true&w=majority`;
mongoose
  .connect(dbUrl, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    log("connected to database");
  })
  .catch((err) => {
    console.log(err);
  });

const auctionSchema = new mongoose.Schema({
  product: String,
  amount: Number,
  from: String,
  to: String,
});

const userSchema = new mongoose.Schema({
  name: String,
  username: String,
  email: String,
  address: String,
  wallet: Number,
  phone: Number,
  participatingCurrently:Boolean,
  aadhar: Number,
  transactions: [auctionSchema],
});

userSchema.plugin(passportLocalMongoose);

const User = new mongoose.model("User", userSchema);
const Auction = new mongoose.model("Auction", auctionSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(async function (id, done) {
  const user = await User.findById(id);
  done(null, user);
});

// Ongoing auctions

let auctions = [];

setInterval(async () => {
  for (var i = 0; i < auctions.length; i++) {
    if (auctions[i].time-- === 0) {
      if (auctions[i].buyerUsn) {
        var trans = new Auction({
          product: auctions[i].product,
          from: auctions[i].sellerUsn,
          amount: auctions[i].bidAmount,
          to: auctions[i].buyerUsn,
        });
        trans.save();
        await User.updateOne(
          { username: auctions[i].sellerUsn },
          {
            $addToSet: {
              transactions: trans,
            },
            $inc: {
              wallet: auctions[i].bidAmount,
            },
          }
        );
        await User.updateOne(
          { username: auctions[i].buyerUsn },
          {
            $addToSet: {
              transactions: trans,
            },
            $inc: {
              wallet: -auctions[i].bidAmount,
            },
          }
        );
      }
      auctions.splice(i, 1);
      io.sockets.emit("updateAuctions", {
        auctions: auctions,
      });
      io.to(String(i)).emit("auctionCompleted");
    } else {
      io.to(String(i)).emit("timer", { time: auctions[i].time });
    }
  }
}, 1000);

// //////////////////////////////////////////////////////////////////////////////////////////////////////////////////

app.get("/wallet", (req, res) => {
  res.render("checkout", {
    key: process.env.PUBLISHABLE_KEY,
  });
});

const YOUR_DOMAIN = 'https://agriculture-auctions-and-sales.onrender.com';

app.post('/create-checkout-session', async (req, res) => {
  log(req.user.id)
  const amount = Number(req.body.amount)
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        // Provide the exact Price ID (for example, pr_1234) of the product you want to sell
        price_data:{
          product_data:{
            name:"wallet-topup"
          },
          currency:"INR",
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    client_reference_id:req.user.id,
    success_url: `${YOUR_DOMAIN}/success`,
    cancel_url: `${YOUR_DOMAIN}/cancel`,
  });

  res.redirect(303, session.url);
});

app.route("/success").get((req,res)=>{
  res.render("success")
})


const endpointSecret = "whsec_amms8ig7J7OIYx9Z8JdI9qovkRho9IIw";

app.post('/webhook', express.raw({type: 'application/json'}), async (request, response) => {
  const sig = request.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
  } catch (err) {
    response.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }
  
  if(event.type == 'checkout.session.completed'){
    var uid = event.data.object.client_reference_id;
    log(uid)
    log(event.data.object.amount_total)
    await User.updateOne({_id:uid},{
      $inc:{
        wallet:event.data.object.amount_total
      }
    })
  }
  response.send();
});


//        //////////////////////////////////////////////////////////////////////////////////////////////////

app.route("/").get((req, res) => {
  res.render("home");
});

app
  .route("/login")
  .get((req, res) => {
    if (req.isAuthenticated()) {
      res.redirect("/user");
    } else {
      res.render("login");
    }
  })
  .post(function (req, res) {
    const username = req.body.username;
    const password = req.body.password;
    const user = new User({ username, password });

    req.logIn(user, function (err) {
      if (err) {
        res.redirect("/login")
      } else {
        passport.authenticate("local")(req, res, function (err) {
          if (err) {
            log("invalid credentials");
          } else {
            res.redirect("/user");
          }
        });
      }
    });
  });

app.route("/user").get(async (req, res) => {
  if (req.isAuthenticated()) {
    res.render("customer", { user: req.user, auctions: auctions });
  }
});

app
  .route("/createauction")
  .get((req, res) => {
    res.render("auction");
  })
  .post((req, res) => {
    let currentDate = new Date();
    let time =
      currentDate.getHours() +
      ":" +
      currentDate.getMinutes() +
      ":" +
      currentDate.getSeconds();
    const { product, baseprice } = req.body;
    const intBasePrice = Number(baseprice);
    auctions.push({
      sellerUsn: req.user.username,
      product,
      baseprice: intBasePrice,
      startTime: time,
      time: req.body.duration*3600,
      bidAmount: 0,
      buyerUsn: 0,
    });
    log(auctions);
    io.sockets.emit("updateAuctions", { auctions: auctions, user: req.user });
    res.redirect("/user");
  });

app
  .route("/signup")
  .get((req, res) => {
    res.render("signup");
  })
  .post((req, res) => {
    const {
      name,
      username,
      phone,
      aadhar,
      address,
      email,
      password,
      repassword,
    } = req.body;
    if (password === repassword) {
      User.register(
        { username, name, phone, aadhar, address, email, wallet: 0 },
        password,
        function (err, user) {
          if (err) {
            log(err);
            res.redirect("/signup");
          } else {
            passport.authenticate("local")(req, res, function (err) {
              if (!err) {
                res.redirect("/user");
              } else {
                log("invalid credentials");
              }
            });
          }
        }
      );
    }
  });

app
  .route("/enterauction/:params")
  .get((req, res) => {
    const roomId = String(req.params.params);
    const index = Number(roomId);
    io.sockets.on("connection", (socket) => {
      socket.join(roomId);
    });
    res.render("bidding", {
      roomId: roomId,
      bidamount: auctions[index].bidAmount,
      bidder: auctions[index].buyerUsn,
      owner: auctions[index].sellerUsn,
    });
  })
  .post((req, res) => {
    const roomId = Number(req.params.params);
    const iAmount = Number(req.body.bidamount);
    if (iAmount > auctions[roomId].bidAmount && iAmount < req.user.wallet) {
      auctions[roomId].buyerUsn = req.user.username;
      auctions[roomId].bidAmount = iAmount;
    }
    res.redirect("/enterauction/" + String(roomId));
  });

app.route("/history").get((req, res) => {
  res.render("history", { user: req.user });
});

app.route("/logout").get((req, res) => {
  req.logout(() => {
    res.redirect("/");
  });
});

http.listen("3000", () => {
  try {
    console.log("Server started at port 3000");
  } catch (err) {
    console.log(err);
  }
});

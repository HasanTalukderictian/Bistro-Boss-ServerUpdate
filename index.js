const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe  = require('stripe')(process.env.PAYMENT_SCRCET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
const nodemailer = require("nodemailer");
const mg = require('nodemailer-mailgun-transport');




// middleware 
app.use(cors());
app.use(express.json())


// send email confirmation email use nodemailer -------------
const sendConfirmationEmail = payment => {
  transporter.sendMail({
    from: "hasantalukdercou@gmail.com", // verified sender email
    to: "hasantalukdercou@gmail.com", // recipient email
    subject: "Your Order is Confirmed, Enjoy the Food!!", // Subject line
    text: "Hello world!", // plain text body
    html: `<div>
    <h2>Your Payment is Confirmed</h2>
    <p> Your Payment Id ${payment.transactionId}</p>
     </div>`, // html body
  }, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  })
 
}

// let transporter = nodemailer.createTransport({
//   host: 'smtp.sendgrid.net',
//   port: 587,
//   auth: {
//       user: "apikey",
//       pass: process.env.SENDGRID_API_KEY
//   }
// })

const auth = {
  auth: {
    api_key: process.env.EMAIL_PRIVATE_KEY,
    domain:  process.env.EMAIL_DOMAIN,
  }
}

const transporter = nodemailer.createTransport(mg(auth));

// verify Jwt token Create Middle Ware

const verifyJwt =(req, res, next) =>{
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  // bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}


console.log(process.env.DB_PASS);


const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@ac-5qjcvgw-shard-00-00.vtmwivk.mongodb.net:27017,ac-5qjcvgw-shard-00-01.vtmwivk.mongodb.net:27017,ac-5qjcvgw-shard-00-02.vtmwivk.mongodb.net:27017/?ssl=true&replicaSet=atlas-abkiiv-shard-0&authSource=admin&retryWrites=true&w=majority`

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
    // Send a ping to confirm a successful connection
    const usersCollection = client.db("bistroDB").collection("users");
    const menuCollection = client.db("bistroDB").collection("menu");
    const reviewsCollection = client.db("bistroDB").collection("reviews");
    const cartCollection = client.db("bistroDB").collection("carts");
    const paymentCollection = client.db("bistroDB").collection("payments");
    

 app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

      res.send({ token })
    })


    // Warning: use verifyJWT before using verifyAdmin
    const verifyAdmin = async(req, res,next) =>{
      const email = req.decoded.email;
      const query = {email:email};
      const user = await usersCollection.findOne(query);
     if(user?.role !=='admin'){
      return res.status(403).send({error: true, message:'forbidden message'})
     }
     next();
    }

   /**
    * 0. do not show the links to those who should not see the links
    * 1. use Jwt token: verifyToken 
    * 2. use admin verify middleware
    */



    // get all users api

    app.get('/users', verifyJwt, verifyAdmin, async(req, res) =>{
      const result = await usersCollection.find().toArray()
      res.send(result);
    })

    //update for specfic Id 
    app.patch('/users/admin/:id', async(req, res)=>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);

    })
    
  





   // menu related Apis 
    app.get('/menu', async(req, res)=>{
        const result = await menuCollection.find().toArray();
        res.send(result);
    })

    app.post('/menu', async(req, res) =>{
      const newItem = req.body;
      const result = await menuCollection.insertOne(newItem);
      res.send(result);
    })

  

    app.delete('/menu/:id', verifyJwt, verifyAdmin, async(req, res) =>{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)}
        const result = await menuCollection.deleteOne(query);
        res.send(result);
    })

    // review related Apis
    app.post('/users', verifyJwt, verifyAdmin, async(req, res)=>{
      const users = req.body;
      const query = {email: users.email}
      const existingUser = await usersCollection.findOne(query);
    
      if(existingUser){
         return res.send({ message:'Users Already Exists'})
      }
     

      const result = await usersCollection.insertOne(users)
      res.send(result);
    })


    app.get('/reviews', async(req, res)=>{
        const result = await reviewsCollection.find().toArray();
        res.send(result);
    })
    
    // cart collection apis 

    app.get('/carts', verifyJwt, async (req, res) =>{
      const email = req.query.email;
      
      if(!email){
        res.send([]);
      }
       
      const decodedEmail = req.decoded.email;
      if(email !== decodedEmail){
        res.status(403).send({ error: true, message: 'forbidden Access'});
      }

      const query = {email:email}
      const result = await cartCollection.find(query).toArray()
      res.send(result);
    });


    app.post('/carts', async(req, res) =>{
      const item = req.body;
      console.log(item);
      const result = await cartCollection.insertOne(item);
      res.send(result);
    })

    // delete item 
    app.delete('/carts/:id', async(req, res) =>{
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    })
   


    // check user for admin 
    // security layer : verifyJWT
    //email same
    //check admin

    app.get('/users/admin/:email', verifyJwt, async(req, res) =>{
      const email = req.params.email;

      if(req.decoded.email !== email){
        res.send({admin : false})
      }

      const query ={email: email}
      const user = await usersCollection.findOne(query);
      const result = {admin :user?.role ==='admin'}
      res.send(result);
    })

    // create payment intent 
    app.post('/create-payment-intent', verifyJwt, async(req, res) =>{
        const {price} = req.body;
        const amount  = parseInt(price*100);
        // console.log(price, amount);
        const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']

        });
        res.send({
            clientSecret:paymentIntent.client_secret
        })
    })
    

    //payment related api 
    app.post('/payments', verifyJwt, async(req, res) =>{  
         const payment = req.body;
         const InsertResult = await paymentCollection.insertOne(payment);
         const query = { _id: { $in: payment.cartItems.map( id => new ObjectId(id) )}}
         const deleteResult = await cartCollection.deleteMany(query);
          

         // send an email formconfirming paymnet

         sendConfirmationEmail(payment);

         res.send({InsertResult, deleteResult});

        })

    // 
    // app.get('/admin', async(req, res) =>{
    //   const loggedusers = await usersCollection.estimatedDocumentCount();
    //   const products = await menuCollection.estimatedDocumentCount();
    //   const orders = await paymentCollection.estimatedDocumentCount();
    //   res.send({
    //     loggedusers,
    //     products,
    //     orders
    //   })
    // })     
    app.get('/admin-stats', verifyJwt, verifyAdmin, async (req, res) => {
      const users = await usersCollection.estimatedDocumentCount();
      const products = await menuCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();
      const payments = await paymentCollection.find().toArray();

      //
      const revenue = payments.reduce( ( sum, payment) => sum + payment.price, 0)
      const totalRevenue =  parseFloat(revenue).toFixed(2)

      res.send({
        totalRevenue,
        users,
        products,
        orders
      })
    })

    app.get('/order-stats', verifyJwt,verifyAdmin, async(req, res) =>{
      const pipeline = [
        {
          $lookup: {
            from: 'menu',
            localField: 'menuItems',
            foreignField: '_id',
            as: 'menuItemsData'
          }
        },
        {
          $unwind: '$menuItemsData'
        },
        {
          $group: {
            _id: '$menuItemsData.category',
            count: { $sum: 1 },
            total: { $sum: '$menuItemsData.price' }
          }
        },
        {
          $project: {
            category: '$_id',
            count: 1,
            total: { $round: ['$total', 2] },
            _id: 0
          }
        }
      ];

      const result = await paymentCollection.aggregate(pipeline).toArray()
      res.send(result)

    })

   


    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res)=>{
    res.send("Bistro -Boss_ Server is Running")
})


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
  })

  /**
   * ----------------------------------
   *           NAMING CONVENTION 
   * -----------------------------------
   * users : userCollection
   * app.get('/users')
   * app.get('/users:id')
   * app.get('/users')
   * app.patch('/users/:id')
   * app.put('/users/:id')
   * app.delete('/users/:id')
   */






const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const app = express();

const port = process.env.PORT || 5001;
require('dotenv').config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.0lr5e3w.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const db = client.db('sapiensDB');
    const usersCollection = db.collection('users');

    app.post('/users', async (req, res) => {
      const user = req.body;
      user.role = 'user';
      user.isPremium = false;
      user.createdAt = new Date();

      const email = user.email;
      const userExists = await usersCollection.findOne({ email });
      if (userExists) {
        return res.status(400).send({ message: 'user already exists' });
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    //get one user by email
    app.get('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    //get one user by email
    app.get('/users/email/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    //get all users
    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    //user isPremium check
    app.get('/users/:email/premium', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      res.send({ isPremium: user?.isPremium || false });
    });

    //user role check
    app.get('/users/:email/role', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      res.send({ role: user?.role || 'user' });
    });

    //payment related api
    app.post('/create-checkout-session', async (req, res) => {
      try {
        const userInfo = req.body;

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          mode: 'payment',
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: 'Sapiens.io Premium Membership',
                },
                unit_amount: 1200,
              },
              quantity: 1,
            },
          ],
          customer_email: userInfo.email,

          success_url: `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.SITE_DOMAIN}/payment-cancel`,
          metadata: {
            userId: userInfo.userId,
          },
        });

        res.json({ url: session.url });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.patch('/payment-success', async (req, res) => {
      const { session_id } = req.body;
      const session = await stripe.checkout.sessions.retrieve(session_id);
      const userId = session.metadata.userId;
      const query = { _id: new ObjectId(userId) };
      const user = await usersCollection.findOne(query);
      if (user && !user.isPremium) {
        await usersCollection.updateOne(query, { $set: { isPremium: true } });
        res.json({ success: true });
      } else {
        res.json({ success: false });
      }
    });
  } finally {
  }
  // Send a ping to confirm a successful connection
  await client.db('admin').command({ ping: 1 });
  console.log('Pinged your deployment. You successfully connected to MongoDB!');
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Zap Shift server is runing!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

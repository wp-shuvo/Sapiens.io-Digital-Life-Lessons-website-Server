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
    const lessonsCollection = db.collection('lessons');
    const commentsCollection = db.collection('comments');
    const reportsCollection = db.collection('lessonReports');

    //post user api

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
    app.get('/users/email/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    app.get('/users', async (req, res) => {
      const result = await usersCollection
        .aggregate([
          {
            $lookup: {
              from: 'lessons',
              localField: 'email',
              foreignField: 'authorEmail',
              as: 'userLessons',
            },
          },
          {
            $addFields: {
              lessonCount: { $size: '$userLessons' },
            },
          },
          {
            $project: {
              userLessons: 0,
            },
          },
        ])
        .toArray();

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

    //update user role
    app.patch('/admin/users/:id/role', async (req, res) => {
      const id = req.params.id;
      const role = req.body.role;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: role,
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    //delete user
    app.delete('/admin/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    //API for lesson api
    //post lesson api
    app.post('/lessons', async (req, res) => {
      const lesson = {
        ...req.body,
        isFeatured: false,
        isReviewed: false,
      };
      const lessonsCollection = db.collection('lessons');
      const result = await lessonsCollection.insertOne(lesson);
      res.send(result);
    });

    // Get all lessons with premium  (email)
    app.get('/lessons', async (req, res) => {
      try {
        const userEmail = req.query.userId;
        let isPremium = false;

        if (userEmail) {
          const user = await usersCollection.findOne({ email: userEmail });
          isPremium = user?.isPremium || false;
        }

        const lessons = await lessonsCollection.find({}).toArray();

        const filteredLessons = lessons.map(lesson => {
          if (lesson.accessLevel === 'Premium' && !isPremium) {
            return {
              ...lesson,
              locked: true,
              description: '',
              image: '',
            };
          }
          return { ...lesson, locked: false };
        });

        res.send(filteredLessons);
      } catch (error) {
        res.send({ error: 'Failed to fetch lessons' });
      }
    });

    app.get('/admin/lessons', async (req, res) => {
      try {
        const lessons = await lessonsCollection
          .aggregate([
            {
              $addFields: {
                lessonIdStr: { $toString: '$_id' },
              },
            },
            {
              $lookup: {
                from: 'lessonReports',
                localField: 'lessonIdStr',
                foreignField: 'lessonId',
                as: 'reports',
              },
            },
            {
              $addFields: {
                reportCount: { $size: '$reports' },
              },
            },
            {
              $project: {
                reports: 0,
                lessonIdStr: 0,
              },
            },
          ])
          .toArray();

        res.send(lessons);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Failed to fetch lessons' });
      }
    });

    //featured lessons

    app.get('/lessons/featured', async (req, res) => {
      const query = { isFeatured: true, privacy: 'Public' };
      const result = await lessonsCollection
        .find(query)
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    //get one lesson by id
    app.get('/lessons/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await lessonsCollection.findOne(query);
      res.send(result);
    });

    //get lesson by author email recent posts first
    app.get('/lessons/author/:email', async (req, res) => {
      const email = req.params.email;
      const query = { authorEmail: email };
      const result = await lessonsCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    //get related lessons api
    app.get('/lessons/related/:id', async (req, res) => {
      const lesson = await lessonsCollection.findOne({
        _id: new ObjectId(req.params.id),
      });

      const related = await lessonsCollection
        .find({
          _id: { $ne: lesson._id },
          $or: [
            { category: lesson.category },
            { emotionalTone: lesson.emotionalTone },
          ],
        })
        .limit(6)
        .toArray();

      res.send(related);
    });

    //comments api
    app.post('/comments', async (req, res) => {
      const comment = {
        ...req.body,
        createdAt: new Date(),
      };
      const result = await commentsCollection.insertOne(comment);
      res.send(result);
    });

    //get comments by lessonId
    app.get('/comments/:lessonId', async (req, res) => {
      const result = await commentsCollection
        .find({ lessonId: req.params.lessonId })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    //save lesson

    app.post('/lessons/save', async (req, res) => {
      const { lessonId, userEmail } = req.body;
      const user = await usersCollection.findOne({ email: userEmail });
      if (!user) {
        return res.status(404).send({ error: 'User not found' });
      }
      const updatedUser = await usersCollection.updateOne(
        { email: userEmail },
        { $addToSet: { savedLessons: lessonId } }
      );
      res.send(updatedUser);
    });

    //get save lessons by user email
    app.get('/lessons/save/:email', async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email });

      if (!user || !user.savedLessons || user.savedLessons.length === 0) {
        return res.send([]);
      }

      const lessonObjectIds = user.savedLessons.map(id => new ObjectId(id));

      const savedLessons = await lessonsCollection
        .find({ _id: { $in: lessonObjectIds } })
        .toArray();

      res.send(savedLessons);
    });

    //update lesson

    app.patch('/lessons/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          ...req.body,
        },
      };
      const result = await lessonsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    //remove lesson
    app.delete('/lessons/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await lessonsCollection.deleteOne(query);
      res.send(result);
    });

    //remove save one lesson
    app.delete('/lessons/save', async (req, res) => {
      const { lessonId, userEmail } = req.body;
      const user = await usersCollection.findOne({ email: userEmail });
      if (!user) {
        return res.send({ error: 'User not found' });
      }
      const updatedUser = await usersCollection.updateOne(
        { email: userEmail },
        { $pull: { savedLessons: lessonId } }
      );
      res.send(updatedUser);
    });

    //report lesson api
    app.post('/lessons/report', async (req, res) => {
      const report = {
        ...req.body,
        createdAt: new Date(),
      };
      await reportsCollection.insertOne(report);
      res.send({ success: true });
    });

    //get report by lessonId
    app.get('/lessons/report/:lessonId', async (req, res) => {
      const result = await reportsCollection
        .find({ lessonId: req.params.lessonId })
        .toArray();
      res.send(result);
    });

    // get only reported lessons (admin)
    app.get('/admin/reported-lessons', async (req, res) => {
      try {
        const lessons = await lessonsCollection
          .aggregate([
            {
              $addFields: {
                lessonIdStr: { $toString: '$_id' },
              },
            },
            {
              $lookup: {
                from: 'lessonReports',
                localField: 'lessonIdStr',
                foreignField: 'lessonId',
                as: 'reports',
              },
            },
            {
              $addFields: {
                reportCount: { $size: '$reports' },
              },
            },
            {
              $match: {
                reportCount: { $gt: 0 },
              },
            },
            {
              $project: {
                reports: 0,
                lessonIdStr: 0,
              },
            },
          ])
          .toArray();

        res.send(lessons);
      } catch (err) {
        res.send({ error: 'Failed to load reported lessons' });
      }
    });

    // get all reports of a lesson
    app.get('/admin/reported-lessons/:id', async (req, res) => {
      const lessonId = req.params.id;
      const result = await reportsCollection.find({ lessonId }).toArray();
      res.send(result);
    });

    // ignore reports
    app.delete('/admin/reported-lessons/:id/ignore', async (req, res) => {
      const lessonId = req.params.id;
      const result = await reportsCollection.deleteMany({ lessonId });
      res.send(result);
    });

    // Admin overview

    app.get('/admin/overview', async (req, res) => {
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [
          todayNewLessonsAgg,
          mostActiveContributors,
          lessonGrowth,
          userGrowth,
        ] = await Promise.all([
          lessonsCollection
            .aggregate([
              {
                $addFields: {
                  created: { $toDate: '$createdAt' },
                },
              },
              {
                $match: {
                  created: { $gte: todayStart },
                },
              },
              {
                $count: 'total',
              },
            ])
            .toArray(),

          // active users
          usersCollection
            .aggregate([
              {
                $lookup: {
                  from: 'lessons',
                  localField: 'email',
                  foreignField: 'authorEmail',
                  as: 'lessons',
                },
              },
              {
                $addFields: {
                  lessonCount: { $size: '$lessons' },
                },
              },
              { $sort: { lessonCount: -1 } },
              { $limit: 5 },
              {
                $project: {
                  displayName: 1,
                  email: 1,
                  photoURL: 1,
                  lessonCount: 1,
                },
              },
            ])
            .toArray(),

          // Lesson growth
          lessonsCollection
            .aggregate([
              { $match: { createdAt: { $exists: true } } },
              {
                $addFields: {
                  day: {
                    $dateToString: {
                      format: '%Y-%m-%d',
                      date: { $toDate: '$createdAt' },
                    },
                  },
                },
              },
              { $group: { _id: '$day', total: { $sum: 1 } } },
              { $sort: { _id: 1 } },
            ])
            .toArray(),

          // User growth
          usersCollection
            .aggregate([
              { $match: { createdAt: { $exists: true } } },
              {
                $addFields: {
                  day: {
                    $dateToString: {
                      format: '%Y-%m-%d',
                      date: { $toDate: '$createdAt' },
                    },
                  },
                },
              },
              { $group: { _id: '$day', total: { $sum: 1 } } },
              { $sort: { _id: 1 } },
            ])
            .toArray(),
        ]);

        const todayNewLessons = todayNewLessonsAgg[0]?.total || 0;

        res.send({
          todayNewLessons,
          mostActiveContributors,
          graphs: {
            lessonGrowth,
            userGrowth,
          },
        });
      } catch (err) {
        console.error(err);
        res.send({ error: 'Failed to load admin analytics' });
      }
    });

    app.get('/dashboard/activity', async (req, res) => {
      const { email } = req.query;

      if (!email) {
        return res.status(400).send({ error: 'Email is required' });
      }

      try {
        const data = await lessonsCollection
          .aggregate([
            { $match: { authorEmail: email, createdAt: { $exists: true } } },

            {
              $addFields: {
                created: { $toDate: '$createdAt' },
              },
            },

            {
              $addFields: {
                week: { $isoWeek: '$created' },
                year: { $year: '$created' },
              },
            },

            {
              $group: {
                _id: { year: '$year', week: '$week' },
                total: { $sum: 1 },
              },
            },

            { $sort: { '_id.year': 1, '_id.week': 1 } },
          ])
          .toArray();

        res.send(data);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Failed to load activity data' });
      }
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
  res.send('Sapiens.io - life lesson server is runing!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

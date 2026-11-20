const express = require('express')
const path = require('path')
const { MongoClient } = require('mongodb')

// Load environment variables from .env
require('dotenv').config({ path: path.join(__dirname, '.env') })

const app = express()
const port = process.env.PORT || 3002

// Enable CORS for all origins and methods
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

// Parse JSON request bodies
app.use(express.json())

// Logger middleware to log incoming requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`)
  next()
})

// In-memory cart storage: { cartId: { lessonId: quantity } }
const carts = {}

// MongoDB connection
const client = new MongoClient(process.env.MONGODB_URI)
let lessonsCollection
let ordersCollection

// Connect to MongoDB Atlas with auto-retry
async function connectDB() {
  try {
    await client.connect()
    const db = client.db('aftaclass_DB')
    lessonsCollection = db.collection('lessons')
    ordersCollection = db.collection('orders')
    console.log('Connected to MongoDB Atlas (aftaclass_DB: lessons, orders)')
  } catch (err) {
    console.error('Failed to connect to MongoDB Atlas, retrying in 5 seconds:', err.message)
    setTimeout(connectDB, 5000)
  }
}
connectDB()

// Helper to get cart items with their full lesson details
async function getCartItems(cartId) {
  const cart = carts[cartId] || {}
  const lessons = await lessonsCollection.find({}).toArray()
  return lessons
    .filter((lesson) => cart[lesson.id])
    .map((lesson) => ({ ...lesson, quantity: cart[lesson.id] }))
}

// ---------------------------------------------
// LESSONS ROUTES (Full CRUD: GET, POST, PUT, DELETE)
// ---------------------------------------------

// 1. GET /api/lessons - Get all lessons
app.get('/api/lessons', async (req, res) => {
  if (!lessonsCollection) {
    return res.status(503).json({ error: 'Database is connecting, please refresh in a moment.' })
  }
  try {
    const lessons = await lessonsCollection.find({}).sort({ id: 1 }).toArray()
    res.json(lessons)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 2. GET /api/lessons/:id - Get a single lesson by ID
app.get('/api/lessons/:id', async (req, res) => {
  if (!lessonsCollection) {
    return res.status(503).json({ error: 'Database is connecting, please refresh in a moment.' })
  }
  try {
    const lessonId = Number(req.params.id)
    const lesson = await lessonsCollection.findOne({ id: lessonId })
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found.' })
    }
    res.json(lesson)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 3. POST /api/lessons - Add a new lesson
app.post('/api/lessons', async (req, res) => {
  if (!lessonsCollection) {
    return res.status(503).json({ error: 'Database is connecting, please refresh in a moment.' })
  }
  try {
    const { title, subject, location, price, availableSeats, imageUrl, description, instructor, duration } = req.body

    if (!title || price === undefined) {
      return res.status(400).json({ error: 'Title and price are required.' })
    }

    // Auto-generate integer id if not supplied
    let id = Number(req.body.id)
    if (!id) {
      const highestLesson = await lessonsCollection.find().sort({ id: -1 }).limit(1).toArray()
      id = highestLesson.length > 0 && highestLesson[0].id ? highestLesson[0].id + 1 : 1
    }

    const newLesson = {
      id,
      title,
      subject: subject || '',
      location: location || '',
      price: Number(price),
      availableSeats: Number(availableSeats) || 5,
      imageUrl: imageUrl || '',
      description: description || '',
      instructor: instructor || '',
      duration: duration || '8 weeks'
    }

    await lessonsCollection.insertOne(newLesson)
    res.status(201).json({ message: 'Lesson added successfully.', lesson: newLesson })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 4. PUT /api/lessons/:id - Update an existing lesson
app.put('/api/lessons/:id', async (req, res) => {
  if (!lessonsCollection) {
    return res.status(503).json({ error: 'Database is connecting, please refresh in a moment.' })
  }
  try {
    const lessonId = Number(req.params.id)
    const updateData = { ...req.body }
    delete updateData._id // Prevent modifying MongoDB internal _id

    if (updateData.id !== undefined) updateData.id = Number(updateData.id)
    if (updateData.price !== undefined) updateData.price = Number(updateData.price)
    if (updateData.availableSeats !== undefined) updateData.availableSeats = Number(updateData.availableSeats)

    const result = await lessonsCollection.updateOne(
      { id: lessonId },
      { $set: updateData }
    )

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Lesson not found.' })
    }

    const updatedLesson = await lessonsCollection.findOne({ id: lessonId })
    res.json({ message: 'Lesson updated successfully.', lesson: updatedLesson })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 5. DELETE /api/lessons/:id - Delete a lesson
app.delete('/api/lessons/:id', async (req, res) => {
  if (!lessonsCollection) {
    return res.status(503).json({ error: 'Database is connecting, please refresh in a moment.' })
  }
  try {
    const lessonId = Number(req.params.id)
    const result = await lessonsCollection.deleteOne({ id: lessonId })

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Lesson not found.' })
    }

    res.json({ message: 'Lesson deleted successfully.' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ---------------------------------------------
// CART ROUTES
// ---------------------------------------------

// GET /api/cart/:cartId - Get items in a cart
app.get('/api/cart/:cartId', async (req, res) => {
  if (!lessonsCollection) {
    return res.status(503).json({ error: 'Database is connecting, please refresh in a moment.' })
  }
  try {
    const items = await getCartItems(req.params.cartId)
    res.json({ items })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/cart/:cartId/items - Add a lesson seat to a cart
app.post('/api/cart/:cartId/items', async (req, res) => {
  if (!lessonsCollection) {
    return res.status(503).json({ error: 'Database is connecting, please refresh in a moment.' })
  }
  try {
    const cartId = req.params.cartId
    const lessonId = Number(req.body.lessonId)

    const lesson = await lessonsCollection.findOne({ id: lessonId })
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found.' })
    }

    if (!carts[cartId]) {
      carts[cartId] = {}
    }

    const currentQty = carts[cartId][lessonId] || 0
    if (currentQty >= lesson.availableSeats) {
      return res.status(409).json({ error: 'This lesson is fully booked.' })
    }

    carts[cartId][lessonId] = currentQty + 1

    const items = await getCartItems(cartId)
    res.status(201).json({ items })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// DELETE /api/cart/:cartId/items/:lessonId - Remove a lesson seat from a cart
app.delete('/api/cart/:cartId/items/:lessonId', async (req, res) => {
  if (!lessonsCollection) {
    return res.status(503).json({ error: 'Database is connecting, please refresh in a moment.' })
  }
  try {
    const cartId = req.params.cartId
    const lessonId = Number(req.params.lessonId)

    if (carts[cartId] && carts[cartId][lessonId]) {
      carts[cartId][lessonId] -= 1
      if (carts[cartId][lessonId] <= 0) {
        delete carts[cartId][lessonId]
      }
    }

    const items = await getCartItems(cartId)
    res.json({ items })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ---------------------------------------------
// CHECKOUT & ORDERS ROUTES
// ---------------------------------------------

// POST /api/checkout/:cartId - Checkout cart and save order to database
app.post('/api/checkout/:cartId', async (req, res) => {
  if (!lessonsCollection || !ordersCollection) {
    return res.status(503).json({ error: 'Database is connecting, please refresh in a moment.' })
  }
  try {
    const cartId = req.params.cartId
    const userName = (req.body.name || req.body.userName || '').trim()
    const userPhone = String(req.body.phone || req.body.number || req.body.userPhone || '').trim()
    const userEmail = (req.body.email || req.body.userEmail || '').trim()
    const cart = carts[cartId]

    // 1. Validate Name
    if (!userName) {
      return res.status(400).json({ error: 'Please enter your name.' })
    }

    // 2. Validate Phone (numbers only)
    if (!userPhone) {
      return res.status(400).json({ error: 'Please enter your phone number.' })
    }
    if (!/^\d+$/.test(userPhone)) {
      return res.status(400).json({ error: 'Phone number must only contain numbers.' })
    }

    // 3. Validate Cart
    if (!cart || Object.keys(cart).length === 0) {
      return res.status(400).json({ error: 'Your cart is empty.' })
    }

    const lessons = await lessonsCollection.find({}).toArray()
    const bookedLessons = []

    // Check seat availability for each item in the cart
    for (const lesson of lessons) {
      const quantity = cart[lesson.id]
      if (quantity) {
        if (lesson.availableSeats < quantity) {
          return res.status(409).json({
            error: `There are not enough seats left for ${lesson.title}.`
          })
        }
        bookedLessons.push({
          ...lesson,
          quantity,
          remainingSeats: lesson.availableSeats - quantity
        })
      }
    }

    // Deduct booked seats in MongoDB
    for (const item of bookedLessons) {
      await lessonsCollection.updateOne(
        { id: item.id },
        { $inc: { availableSeats: -item.quantity } }
      )
    }

    // Save order document to the orders collection in MongoDB
    const orderDoc = {
      name: userName,
      phone: userPhone,
      email: userEmail || null,
      lessons: bookedLessons.map((l) => ({
        id: l.id,
        title: l.title,
        price: l.price,
        quantity: l.quantity
      })),
      totalSeats: bookedLessons.reduce((sum, l) => sum + l.quantity, 0),
      totalPrice: bookedLessons.reduce((sum, l) => sum + l.price * l.quantity, 0),
      createdAt: new Date()
    }

    const orderResult = await ordersCollection.insertOne(orderDoc)

    // Clear user cart
    delete carts[cartId]

    res.json({
      message: 'Your lessons have been booked successfully.',
      userName,
      orderId: orderResult.insertedId,
      order: orderDoc,
      lessons: bookedLessons
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/orders - View all orders stored in the database
app.get('/api/orders', async (req, res) => {
  if (!ordersCollection) {
    return res.status(503).json({ error: 'Database is connecting, please refresh in a moment.' })
  }
  try {
    const orders = await ordersCollection.find({}).sort({ createdAt: -1 }).toArray()
    res.json(orders)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/orders - Add an order directly
app.post('/api/orders', async (req, res) => {
  if (!ordersCollection) {
    return res.status(503).json({ error: 'Database is connecting, please refresh in a moment.' })
  }
  try {
    const name = (req.body.name || req.body.userName || '').trim()
    const phone = String(req.body.phone || req.body.number || req.body.userPhone || '').trim()
    const email = (req.body.email || req.body.userEmail || '').trim()
    const lessonIds = req.body.lessonIds || []
    const space = Number(req.body.space) || 1

    if (!name) {
      return res.status(400).json({ error: 'Please enter your name.' })
    }
    if (!phone) {
      return res.status(400).json({ error: 'Please enter your phone number.' })
    }
    if (!/^\d+$/.test(phone)) {
      return res.status(400).json({ error: 'Phone number must only contain numbers.' })
    }

    const orderDoc = {
      name,
      phone,
      email: email || null,
      lessonIds,
      space,
      createdAt: new Date()
    }

    const result = await ordersCollection.insertOne(orderDoc)
    res.status(201).json({ message: 'Order created successfully.', orderId: result.insertedId, order: orderDoc })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Start server listening immediately
app.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})

module.exports = app

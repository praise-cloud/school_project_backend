const express = require('express')
const path = require('path')
const fs = require('fs')
const { MongoClient } = require('mongodb')

// Load environment variables from .env
require('dotenv').config({ path: path.join(__dirname, '.env') })

const app = express()
const port = process.env.PORT || 3002

// Enable CORS for all origins, methods, and headers
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

// 1. Logger Middleware (Outputs all requests to console with timestamp)
app.use((req, res, next) => {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${req.method} ${req.url}`)
  next()
})

// 2. Static File Middleware for Lesson Images (with 404 error if missing)
app.use('/images', (req, res, next) => {
  const imagePath = path.join(__dirname, 'images', req.url)
  fs.access(imagePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).json({ error: 'Image file does not exist.' })
    }
    res.sendFile(imagePath)
  })
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

// -------------------------------------------------------------
// LESSONS ROUTES (Full CRUD: GET, POST, PUT, DELETE)
// Supports both /lessons and /api/lessons
// -------------------------------------------------------------

// GET all lessons (with optional ?search= parameter)
async function handleGetLessons(req, res) {
  if (!lessonsCollection) {
    return res.status(503).json({ error: 'Database is connecting, please refresh in a moment.' })
  }
  try {
    const searchQuery = (req.query.search || req.query.q || '').trim()

    if (searchQuery) {
      const regex = new RegExp(searchQuery, 'i')
      const numQuery = Number(searchQuery)
      const filter = {
        $or: [
          { title: { $regex: regex } },
          { subject: { $regex: regex } },
          { location: { $regex: regex } },
          { description: { $regex: regex } },
          { instructor: { $regex: regex } }
        ]
      }
      if (!isNaN(numQuery)) {
        filter.$or.push({ price: numQuery }, { availableSeats: numQuery })
      }
      const results = await lessonsCollection.find(filter).sort({ id: 1 }).toArray()
      return res.json(results)
    }

    const lessons = await lessonsCollection.find({}).sort({ id: 1 }).toArray()
    res.json(lessons)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
app.get('/lessons', handleGetLessons)
app.get('/api/lessons', handleGetLessons)

// GET single lesson by ID
async function handleGetLessonById(req, res) {
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
}
app.get('/lessons/:id', handleGetLessonById)
app.get('/api/lessons/:id', handleGetLessonById)

// POST create and add a new lesson
async function handleCreateLesson(req, res) {
  if (!lessonsCollection) {
    return res.status(503).json({ error: 'Database is connecting, please refresh in a moment.' })
  }
  try {
    const { title, subject, location, price, availableSeats, imageUrl, description, instructor, duration } = req.body

    if (!title || price === undefined) {
      return res.status(400).json({ error: 'Title and price are required.' })
    }

    let id = Number(req.body.id)
    if (!id) {
      const highest = await lessonsCollection.find().sort({ id: -1 }).limit(1).toArray()
      id = highest.length > 0 && highest[0].id ? highest[0].id + 1 : 1
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
}
app.post('/lessons', handleCreateLesson)
app.post('/api/lessons', handleCreateLesson)

// PUT update any attribute in a lesson (e.g. availableSeats)
async function handleUpdateLesson(req, res) {
  if (!lessonsCollection) {
    return res.status(503).json({ error: 'Database is connecting, please refresh in a moment.' })
  }
  try {
    const lessonId = Number(req.params.id)
    const updateData = { ...req.body }
    delete updateData._id

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

    const updated = await lessonsCollection.findOne({ id: lessonId })
    res.json({ message: 'Lesson updated successfully.', lesson: updated })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
app.put('/lessons/:id', handleUpdateLesson)
app.put('/api/lessons/:id', handleUpdateLesson)

// DELETE remove a lesson by ID
async function handleDeleteLesson(req, res) {
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
}
app.delete('/lessons/:id', handleDeleteLesson)
app.delete('/api/lessons/:id', handleDeleteLesson)

// -------------------------------------------------------------
// CHALLENGE ROUTES: Search & Enrolment
// -------------------------------------------------------------

// Challenge 1: GET /search?q=... (Backend search across multiple attributes)
async function handleSearch(req, res) {
  if (!lessonsCollection) {
    return res.status(503).json({ error: 'Database is connecting, please refresh in a moment.' })
  }
  try {
    const query = (req.query.q || req.query.query || req.query.search || '').trim()
    if (!query) {
      const allLessons = await lessonsCollection.find({}).sort({ id: 1 }).toArray()
      return res.json(allLessons)
    }

    const regex = new RegExp(query, 'i')
    const numQuery = Number(query)
    const filter = {
      $or: [
        { title: { $regex: regex } },
        { subject: { $regex: regex } },
        { location: { $regex: regex } },
        { description: { $regex: regex } },
        { instructor: { $regex: regex } }
      ]
    }
    if (!isNaN(numQuery)) {
      filter.$or.push({ price: numQuery }, { availableSeats: numQuery })
    }

    const results = await lessonsCollection.find(filter).sort({ id: 1 }).toArray()
    res.json(results)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
app.get('/search', handleSearch)
app.get('/api/search', handleSearch)

// Challenge 2: GET /enrolment/:lessonid (Returns purchased slots count)
async function handleEnrolment(req, res) {
  if (!ordersCollection || !lessonsCollection) {
    return res.status(503).json({ error: 'Database is connecting, please refresh in a moment.' })
  }
  try {
    const lessonId = Number(req.params.lessonid)
    const lesson = await lessonsCollection.findOne({ id: lessonId })
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found.' })
    }

    // Find all orders that bought spaces for this lesson
    const orders = await ordersCollection.find({ 'lessons.id': lessonId }).toArray()
    let enrolment = 0
    for (const order of orders) {
      if (Array.isArray(order.lessons)) {
        for (const item of order.lessons) {
          if (item.id === lessonId) {
            enrolment += (Number(item.quantity) || 1)
          }
        }
      }
    }

    res.json({
      lessonId,
      lessonTitle: lesson.title,
      enrolment,
      availableSeats: lesson.availableSeats
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
app.get('/enrolment/:lessonid', handleEnrolment)
app.get('/api/enrolment/:lessonid', handleEnrolment)

// -------------------------------------------------------------
// ORDERS ROUTES: POST & GET
// -------------------------------------------------------------

// GET all orders from the 'orders' collection
async function handleGetOrders(req, res) {
  if (!ordersCollection) {
    return res.status(503).json({ error: 'Database is connecting, please refresh in a moment.' })
  }
  try {
    const orders = await ordersCollection.find({}).sort({ createdAt: -1 }).toArray()
    res.json(orders)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
app.get('/orders', handleGetOrders)
app.get('/api/orders', handleGetOrders)

// POST save a new order to the 'orders' collection
async function handleCreateOrder(req, res) {
  if (!ordersCollection) {
    return res.status(503).json({ error: 'Database is connecting, please refresh in a moment.' })
  }
  try {
    const name = (req.body.name || req.body.userName || '').trim()
    const phone = String(req.body.phone || req.body.number || req.body.userPhone || '').trim()
    const email = (req.body.email || req.body.userEmail || '').trim()
    const lessons = req.body.lessons || req.body.cartItems || []
    const lessonIds = req.body.lessonIds || lessons.map((l) => l.id)
    const space = Number(req.body.space || req.body.totalSeats) || lessons.reduce((sum, l) => sum + (l.quantity || 1), 0) || 1
    const totalPrice = Number(req.body.totalPrice) || lessons.reduce((sum, l) => sum + (l.price || 0) * (l.quantity || 1), 0)

    // Validation: Name must be letters and spaces only
    if (!name || !/^[a-zA-Z\s]+$/.test(name)) {
      return res.status(400).json({ error: 'Name is required and must contain letters only.' })
    }

    // Validation: Phone must be numbers only
    if (!phone || !/^\d+$/.test(phone)) {
      return res.status(400).json({ error: 'Phone number is required and must contain numbers only.' })
    }

    const orderDoc = {
      name,
      phone,
      email: email || null,
      lessonIds,
      lessons,
      space,
      totalPrice,
      createdAt: new Date()
    }

    const result = await ordersCollection.insertOne(orderDoc)
    res.status(201).json({
      message: 'Order placed successfully.',
      orderId: result.insertedId,
      order: orderDoc
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
app.post('/orders', handleCreateOrder)
app.post('/api/orders', handleCreateOrder)

// -------------------------------------------------------------
// CART & CHECKOUT ROUTES
// -------------------------------------------------------------

// GET cart items
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

// POST add seat to cart
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

// DELETE remove seat from cart
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

// POST checkout cart
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

    // Validate Name (letters only)
    if (!userName || !/^[a-zA-Z\s]+$/.test(userName)) {
      return res.status(400).json({ error: 'Name is required and must contain letters only.' })
    }

    // Validate Phone (numbers only)
    if (!userPhone || !/^\d+$/.test(userPhone)) {
      return res.status(400).json({ error: 'Phone number is required and must contain numbers only.' })
    }

    // Validate Cart
    if (!cart || Object.keys(cart).length === 0) {
      return res.status(400).json({ error: 'Your cart is empty.' })
    }

    const lessons = await lessonsCollection.find({}).toArray()
    const bookedLessons = []

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

    // Deduct seats in database
    for (const item of bookedLessons) {
      await lessonsCollection.updateOne(
        { id: item.id },
        { $inc: { availableSeats: -item.quantity } }
      )
    }

    // Save order document to MongoDB
    const orderDoc = {
      name: userName,
      phone: userPhone,
      email: userEmail || null,
      lessonIds: bookedLessons.map((l) => l.id),
      lessons: bookedLessons.map((l) => ({
        id: l.id,
        title: l.title,
        price: l.price,
        quantity: l.quantity
      })),
      space: bookedLessons.reduce((sum, l) => sum + l.quantity, 0),
      totalPrice: bookedLessons.reduce((sum, l) => sum + l.price * l.quantity, 0),
      createdAt: new Date()
    }

    const orderResult = await ordersCollection.insertOne(orderDoc)
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

// Start server listening
app.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})

module.exports = app

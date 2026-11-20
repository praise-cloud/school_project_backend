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

// Helper to get cart items with their full lesson details
async function getCartItems(cartId) {
  const cart = carts[cartId] || {}
  const lessons = await lessonsCollection.find({}).toArray()
  return lessons
    .filter((lesson) => cart[lesson.id])
    .map((lesson) => ({ ...lesson, quantity: cart[lesson.id] }))
}

// 1. Get all lessons
app.get('/api/lessons', async (req, res) => {
  if (!lessonsCollection) {
    return res.status(503).json({ error: 'Database is not connected.' })
  }
  try {
    const lessons = await lessonsCollection.find({}).sort({ id: 1 }).toArray()
    res.json(lessons)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 2. Get items in a cart
app.get('/api/cart/:cartId', async (req, res) => {
  if (!lessonsCollection) {
    return res.status(503).json({ error: 'Database is not connected.' })
  }
  try {
    const items = await getCartItems(req.params.cartId)
    res.json({ items })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 3. Add a lesson seat to a cart
app.post('/api/cart/:cartId/items', async (req, res) => {
  if (!lessonsCollection) {
    return res.status(503).json({ error: 'Database is not connected.' })
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

// 4. Remove a lesson seat from a cart
app.delete('/api/cart/:cartId/items/:lessonId', async (req, res) => {
  if (!lessonsCollection) {
    return res.status(503).json({ error: 'Database is not connected.' })
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

// 5. Checkout cart
app.post('/api/checkout/:cartId', async (req, res) => {
  if (!lessonsCollection) {
    return res.status(503).json({ error: 'Database is not connected.' })
  }
  try {
    const cartId = req.params.cartId
    const userName = (req.body.userName || '').trim()
    const cart = carts[cartId]

    if (!userName) {
      return res.status(400).json({ error: 'Please enter your name.' })
    }

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

    // Clear user cart
    delete carts[cartId]

    res.json({
      message: 'Your lessons have been booked successfully.',
      userName,
      lessons: bookedLessons
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Connect to MongoDB Atlas
client.connect()
  .then(() => {
    lessonsCollection = client.db('AftaClass').collection('lessons')
    console.log('Connected to MongoDB Atlas')
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB Atlas:', err)
  })

// Start server listening immediately so Render stays active
app.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})

module.exports = app

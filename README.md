# AftaClass

AftaClass is a full-stack class-booking app for discovering and booking after-school lessons. Students and parents can browse a lesson catalogue, filter and sort classes, add seats to a cart, and check out.

## Project overview

The app has two parts:

- **Frontend — Vue 3:** The app in [`frontend/`](frontend/) displays lessons and handles search, subject and price filters, sorting, cart quantities, and the booking flow. It calls the backend with the browser's `fetch` API.
- **Backend — Node.js and Express:** The app in [`backend/`](backend/) serves the frontend and provides the REST API. It uses MongoDB's native Node.js driver to read lesson data and update available seats.
- **Database — MongoDB Atlas:** The `AftaClass.lessons` collection stores the lessons and their remaining seat counts.

```text
Browser (Vue) ── fetch / REST API ──> Express on Render ── MongoDB driver ──> MongoDB Atlas
```

### Main features

- Ten sample lessons with a subject, location, price, instructor, image, and five initial seats each.
- Search and filter lessons by subject and price; sort by subject, location, price, or remaining seats in either direction.
- Add multiple seats for a lesson while seats remain. The cart shows quantities and totals; removing a seat returns it to the cart's available count.
- Checkout checks availability again and subtracts the requested quantities from MongoDB.

## Repository layout

```text
frontend/          Vue application (HTML, CSS, JavaScript)
backend/           Express API and MongoDB connection
  index.js         Server, API routes, and cart/checkout behavior
  lessons.json     Ten lesson records for MongoDB
  README.md        Backend setup, API, and Render deployment details
```

## Run locally

Requirements: Node.js, npm, and a MongoDB Atlas connection string.

1. Create `backend/.env` and set your Atlas URI:

   ```env
   MONGODB_URI=your_mongodb_atlas_connection_string
   ```

2. Install dependencies and start the development server:

   ```powershell
   cd backend
   npm ci
   npm run dev
   ```

3. Open [http://127.0.0.1:3002](http://127.0.0.1:3002). The backend serves the Vue app and API from the same origin. Do not open `frontend/index.html` directly from the file system.

Use `npm start` to run the backend without the development file watcher. The server listens on the `PORT` environment variable when provided, or port `3002` locally.

Never commit `.env` or share its connection string. See [`backend/README.md`](backend/README.md) for MongoDB setup and import instructions.

## API summary

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/lessons` | Return all lessons and current seat counts. |
| `GET` | `/api/cart/:cartId` | Return the cart and its lesson quantities. |
| `POST` | `/api/cart/:cartId/items` | Add one seat using `{ "lessonId": 1 }`. |
| `DELETE` | `/api/cart/:cartId/items/:lessonId` | Remove one seat for that lesson. |
| `POST` | `/api/checkout/:cartId` | Book cart quantities using `{ "userName": "Alex" }`. |

The frontend is configured to contact the Render backend at [`https://school-project-backend-xlih.onrender.com`](https://school-project-backend-xlih.onrender.com). Once the Web Service is running, its lessons endpoint is [`/api/lessons`](https://school-project-backend-xlih.onrender.com/api/lessons).

## Data and current limitations

The seed data is in [`backend/lessons.json`](backend/lessons.json). Import it into `AftaClass.lessons` after replacing the existing lesson records; importing without replacement can create duplicate lessons. The app reads lesson data from Atlas and does not automatically seed the database.

Cart contents are kept in backend memory, so a backend restart clears active carts. Checkout updates lesson availability, but this version does not save orders as documents in a separate MongoDB collection.

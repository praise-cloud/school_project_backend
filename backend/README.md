# AftaClass Backend

The Node.js and Express REST API for AftaClass lives in this directory. It reads lesson data from MongoDB Atlas and updates available seats when a cart is checked out. The repository-root npm scripts install and start this backend for Render.

The Vue frontend is maintained separately at [praise-cloud/school_project_frontend](https://github.com/praise-cloud/school_project_frontend) and is published with GitHub Pages at <https://praise-cloud.github.io/school_project_frontend/>. The frontend calls this backend at <https://school-project-backend-1.onrender.com>.

## Architecture

```text
Vue frontend (GitHub Pages) ── fetch / REST API ──> Express (Render) ── MongoDB driver ──> MongoDB Atlas
```

The `aftaclass_DB.lessons` collection stores the lessons and their remaining seats. The ten initial lesson records are in [`lessons.json`](lessons.json). Cart contents are kept in server memory, so a backend restart clears active carts. Checkout subtracts requested quantities from lesson availability; this version does not save orders as documents.

## Run locally

Requirements: Node.js, npm, and a MongoDB Atlas connection string.

1. Create `backend/.env` with:

   ```env
   MONGODB_URI=your_mongodb_atlas_connection_string
   ```

2. Install dependencies and start the backend:

   ```powershell
   npm ci
   npm run dev
   ```

3. Check `http://127.0.0.1:3002/api/lessons` for the lesson JSON. To run the separate frontend locally, use VS Code Live Server on port 5500 or 5501.

Never commit `.env` or share its connection string.

## MongoDB lesson data

The backend expects the ten lesson documents from `lessons.json` in `aftaclass_DB.lessons`. Replace the existing lesson records before importing so the records are not duplicated. `mongoimport` does not read `.env` automatically; in PowerShell, set the variable for the command:

```powershell
$env:MONGODB_URI = "your_mongodb_atlas_connection_string"
mongoimport --uri $env:MONGODB_URI --db aftaclass_DB --collection lessons --file backend/lessons.json --jsonArray
```

## Render deployment

Deploy this repository as a Render **Web Service**. In Render settings, set **Root Directory** to `backend`. Set the build command to `npm ci`, the start command to `npm start`, and add `MONGODB_URI` in the Render environment settings. Render supplies `PORT`.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/lessons` or `/api/lessons` | Return all lessons and current seat counts (supports `?search=...`). |
| `GET` | `/lessons/:id` or `/api/lessons/:id` | Return a single lesson by ID. |
| `POST` | `/lessons` or `/api/lessons` | Create and add a new lesson document. |
| `PUT` | `/lessons/:id` or `/api/lessons/:id` | Update an existing lesson (price, availableSeats, title, etc.). |
| `DELETE` | `/lessons/:id` or `/api/lessons/:id` | Delete a lesson by ID. |
| `GET` | `/search?q=...` or `/api/search?q=...` | **[Challenge]** Multi-attribute search across title, subject, location, etc. |
| `GET` | `/enrolment/:lessonid` | **[Challenge]** Return total booked enrolment count for a lesson. |
| `GET` | `/images/:filename` | **[Middleware]** Return lesson image or 404 error if file does not exist. |
| `GET` | `/orders` or `/api/orders` | Return all orders stored in the `orders` collection. |
| `POST` | `/orders` or `/api/orders` | Save an order directly to the `orders` collection. |
| `GET` | `/api/cart/:cartId` | Return the cart items and lesson quantities. |
| `POST` | `/api/cart/:cartId/items` | Add one seat to cart using `{ "lessonId": 1 }`. |
| `DELETE` | `/api/cart/:cartId/items/:lessonId` | Remove one seat for that lesson from cart. |
| `POST` | `/api/checkout/:cartId` | Book cart quantities and save order to `orders` collection. |

## AI-use acknowledgment

GitHub Copilot was used as an assistive tool to review the existing code, help implement selected frontend and backend changes, and draft project documentation. I am responsible for understanding and explaining the submitted work. Make sure this note matches your actual use and complete the coursework's required GenAI-use declaration.

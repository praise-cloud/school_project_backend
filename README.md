# AftaClass Backend

This repository contains the Node.js and Express REST API for AftaClass. It reads lesson data from MongoDB Atlas and updates available seats when a cart is checked out.

The Vue frontend is maintained separately at [praise-cloud/school_project_frontend](https://github.com/praise-cloud/school_project_frontend) and is published with GitHub Pages at <https://praise-cloud.github.io/school_project_frontend/>. The frontend calls this backend at <https://school-project-backend-xlih.onrender.com>.

## Architecture

```text
Vue frontend (GitHub Pages) ── fetch / REST API ──> Express (Render) ── MongoDB driver ──> MongoDB Atlas
```

The `AftaClass.lessons` collection stores the lessons and their remaining seats. The ten initial lesson records are in [`backend/lessons.json`](backend/lessons.json). Cart contents are kept in server memory, so a backend restart clears active carts. Checkout subtracts requested quantities from lesson availability; this version does not save orders as documents.

## Run locally

Requirements: Node.js, npm, and a MongoDB Atlas connection string.

1. Create `backend/.env` with:

   ```env
   MONGODB_URI=your_mongodb_atlas_connection_string
   ```

2. Install dependencies and start the backend:

   ```powershell
   cd backend
   npm ci
   npm run dev
   ```

3. Check `http://127.0.0.1:3002/api/lessons` for the lesson JSON. To run the separate frontend locally, use VS Code Live Server on port 5500 or 5501.

Never commit `.env` or share its connection string. See [`backend/README.md`](backend/README.md) for seed-data import and API details.

## Render deployment

Deploy this repository's backend folder as a Render **Web Service** with root directory `backend`, build command `npm ci`, and start command `npm start`. Set `MONGODB_URI` in Render's environment settings; Render provides `PORT`.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/lessons` | Return lessons and current seat counts. |
| `GET` | `/api/cart/:cartId` | Return the cart and lesson quantities. |
| `POST` | `/api/cart/:cartId/items` | Add one seat using `{ "lessonId": 1 }`. |
| `DELETE` | `/api/cart/:cartId/items/:lessonId` | Remove one seat for that lesson. |
| `POST` | `/api/checkout/:cartId` | Book cart quantities using `{ "userName": "Alex" }`. |

## AI-use acknowledgment

GitHub Copilot was used as an assistive tool to review the existing code, help implement selected frontend and backend changes, and draft project documentation. I am responsible for understanding and explaining the submitted work. Make sure this note matches your actual use and complete the coursework's required GenAI-use declaration.

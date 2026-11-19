# AftaClass backend

Run the API from this directory with `npm start`. AftaClass uses port 3002 by default to avoid conflicts with other local apps on ports 3000 and 3001. Check the API at **http://127.0.0.1:3002/api/lessons**. The Vue frontend is maintained in the separate [school_project_frontend repository](https://github.com/praise-cloud/school_project_frontend).

For local frontend development, clone the frontend repository separately and use VS Code Live Server on its `index.html` with port 5500 or 5501. The frontend calls the local backend at port 3002 from these origins.

To use another backend port, set the `PORT` environment variable when starting the server and update the local API URL in the frontend repository.

## Render deployment

Deploy this backend as a **Web Service**, not a Static Site. In Render, set the root directory to `backend` (relative to the repository, without a leading slash), the build command to `npm ci`, and the start command to `npm start`. Do not set a publish directory; Web Services run the Node.js process rather than publishing a folder of static files.

Add `MONGODB_URI` as a Render environment variable using your MongoDB Atlas connection string. Render supplies `PORT` automatically, and the server listens on that port. After deployment, the lessons endpoint is available at `https://<your-service>.onrender.com/api/lessons`.

## MongoDB setup

Create a `.env` file in the backend directory and set `MONGODB_URI` to your MongoDB Atlas connection string. The `.env` file is loaded by the backend and is ignored by Git; do not commit your connection string. On Render, set the URI in the service's environment settings. The backend connects to the `AftaClass` database and reads lesson records from the `lessons` collection on startup. The database name is selected by the backend, so it does not need to be included in the URI.

`lessons.json` contains 10 lesson records, including a `location` and an `imageUrl` for each lesson, as a JSON array ready for MongoDB import. Replace the existing documents in `AftaClass.lessons` before importing updated records; importing again without replacing them will add duplicates. `mongoimport` does not load `.env` automatically, so set the URI in the terminal first. From the `backend` directory, run:

```sh
export MONGODB_URI="your MongoDB connection string"
mongoimport --uri "$MONGODB_URI" --db AftaClass --collection lessons --file lessons.json --jsonArray
```

In PowerShell:

```powershell
$env:MONGODB_URI = "your MongoDB connection string"
mongoimport --uri $env:MONGODB_URI --db AftaClass --collection lessons --file lessons.json --jsonArray
```

Start the backend from this directory with `npm start`. It will not start if the connection string is missing or MongoDB cannot be reached; check the terminal error and your Atlas network access and database user settings.

To confirm lessons are reachable, open `http://127.0.0.1:3002/api/lessons`; it should return a JSON array.

## API

- `GET /api/lessons` — list lessons with their current `availableSeats`.
- `GET /api/cart/:cartId` — read a cart as `{ "items": [...] }`.
- `POST /api/cart/:cartId/items` — add one seat for a lesson using `{ "lessonId": 1 }`. Repeat the request to add more seats, up to the lesson's available spaces.
- `DELETE /api/cart/:cartId/items/:lessonId` — remove one seat for that lesson from the cart.
- `POST /api/checkout/:cartId` — book the quantities in the cart using `{ "userName": "Alex" }`. On success, returns each booked lesson's `quantity` and `remainingSeats`, then empties the cart.

Carts currently live in server memory. Lesson data is read from MongoDB, and successful bookings subtract the requested quantities from `availableSeats` in the `lessons` collection. Import the updated `lessons.json` into Atlas with replacement enabled to load all 10 lessons.

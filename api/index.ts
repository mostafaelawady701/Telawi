import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";

// Global Store (Will reset on Vercel cold starts, but better than 404s)
const store: Record<string, Record<string, any>> = {
  rooms: {},
  users: {},
  recordings: {},
  rounds: {}
};

const app = express();
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  path: "/socket.io/",
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// API Routes
app.get("/api/data/:collection", (req, res) => {
  res.json(store[req.params.collection] || {});
});

app.get("/api/data/:collection/:id", (req, res) => {
  res.json(store[req.params.collection]?.[req.params.id] || null);
});

app.post("/api/data/:collection", (req, res) => {
  const coll = req.params.collection;
  const id = Math.random().toString(36).substr(2, 9);
  const data = { ...req.body, id, createdAt: Date.now() };
  if (!store[coll]) store[coll] = {};
  store[coll][id] = data;
  io.emit(`data-changed:${coll}`, { type: 'added', id, data });
  res.json(data);
});

app.put("/api/data/:collection/:id", (req, res) => {
  const { collection, id } = req.params;
  if (store[collection]?.[id]) {
    store[collection][id] = { ...store[collection][id], ...req.body };
    io.emit(`data-changed:${collection}`, { type: 'updated', id, data: store[collection][id] });
    res.json(store[collection][id]);
  } else {
    res.status(404).json({ error: "Not found" });
  }
});

app.delete("/api/data/:collection/:id", (req, res) => {
  const { collection, id } = req.params;
  if (store[collection]?.[id]) {
    delete store[collection][id];
    io.emit(`data-changed:${collection}`, { type: 'deleted', id });
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Not found" });
  }
});

// For Vercel, we export the app
export default app;

// For Local development
if (process.env.NODE_ENV !== "production" && import.meta.url.includes(path.basename(import.meta.url))) {
  const PORT = 3000;
  httpServer.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

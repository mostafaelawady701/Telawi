import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

// --- Global Data Store ---
// In a real app, this would be a database or file. For now, it's in-memory.
const store: Record<string, Record<string, any>> = {
  rooms: {},
  users: {},
  recordings: {},
  rounds: {}
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(express.json()); // Support JSON bodies

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;
  const roomEmptyTimers = new Map<string, NodeJS.Timeout>();

  // --- API Routes for Mock Firestore ---
  app.get("/api/data/:collection", (req, res) => {
    const coll = req.params.collection;
    res.json(store[coll] || {});
  });

  app.get("/api/data/:collection/:id", (req, res) => {
    const { collection, id } = req.params;
    res.json(store[collection]?.[id] || null);
  });

  app.post("/api/data/:collection", (req, res) => {
    const coll = req.params.collection;
    const id = Math.random().toString(36).substr(2, 9);
    const data = { ...req.body, id, createdAt: Date.now() };
    if (!store[coll]) store[coll] = {};
    store[coll][id] = data;

    // Notify all clients of the change
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

  // --- Socket.io Logic ---
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", (roomId, userId) => {
      socket.join(roomId);
      socket.data.roomId = roomId;
      console.log(`User ${userId} joined room ${roomId}`);

      if (roomEmptyTimers.has(roomId)) {
        clearTimeout(roomEmptyTimers.get(roomId)!);
        roomEmptyTimers.delete(roomId);
      }

      socket.to(roomId).emit("user-connected", userId);
    });

    socket.on("offer", (payload) => io.to(payload.target).emit("offer", payload));
    socket.on("answer", (payload) => io.to(payload.target).emit("answer", payload));
    socket.on("ice-candidate", (payload) => io.to(payload.target).emit("ice-candidate", payload));
    socket.on("request-connection", (payload) => socket.to(payload.roomId).emit("request-connection", payload.userId));
    socket.on("toggle-live", (roomId, isLive) => io.to(roomId).emit("live-status-changed", isLive));

    socket.on("disconnect", () => {
      const roomId = socket.data.roomId;
      if (roomId) {
        const room = io.sockets.adapter.rooms.get(roomId);
        const roomSize = room ? room.size : 0;
        if (roomSize === 0) {
          const timer = setTimeout(() => {
            delete store.rooms[roomId];
            io.emit(`data-changed:rooms`, { type: 'deleted', id: roomId });
            roomEmptyTimers.delete(roomId);
          }, 30000);
          roomEmptyTimers.set(roomId, timer);
        }
      }
    });
  });

  // --- Vite / Static Assets ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

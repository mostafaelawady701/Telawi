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

  // --- Socket.io Rate Limiting ---
  const socketRateLimits = new Map<string, { count: number, lastReset: number }>();
  const SOCKET_RATE_LIMIT_WINDOW = 60000;
  const SOCKET_MAX_MESSAGES = 300;

  const checkSocketRateLimit = (socketId: string) => {
    const now = Date.now();
    let record = socketRateLimits.get(socketId);
    if (!record || now - record.lastReset > SOCKET_RATE_LIMIT_WINDOW) {
      record = { count: 1, lastReset: now };
    } else {
      record.count++;
    }
    socketRateLimits.set(socketId, record);
    return record.count <= SOCKET_MAX_MESSAGES;
  };

  // --- Socket.io Logic ---
  io.on("connection", (socket) => {
    console.log(`[${new Date().toISOString()}] Socket connected: ${socket.id}`);

    // Heartbeat ping/pong for connection health
    socket.on("ping", () => {
      socket.emit("pong", { timestamp: Date.now() });
    });

    const withValidation = (eventName: string, handler: (...args: any[]) => void) => {
      return (...args: any[]) => {
        if (!checkSocketRateLimit(socket.id)) {
           console.warn(`[!] Rate limit exceeded for socket ${socket.id}`);
           return;
        }
        try {
          handler(...args);
        } catch (e) {
          console.error(`Error in event ${eventName}:`, e);
        }
      };
    };

    socket.on("join-room", withValidation("join-room", (roomId: string, userId: string) => {
      if (!roomId || typeof roomId !== 'string' || !userId || typeof userId !== 'string') {
        console.warn("Invalid payload for join-room");
        return;
      }

      // Room Capacity Enforcement check (Max 10 per WebRTC limits)
      const room = io.sockets.adapter.rooms.get(roomId);
      if (room && room.size >= 10) {
        socket.emit("room-full");
        console.log(`[${new Date().toISOString()}] User ${userId} rejected: Room ${roomId} is full`);
        return;
      }

      socket.join(roomId);
      socket.data.roomId = roomId;
      console.log(`[${new Date().toISOString()}] User ${userId} joined room ${roomId}`);

      if (roomEmptyTimers.has(roomId)) {
        clearTimeout(roomEmptyTimers.get(roomId)!);
        roomEmptyTimers.delete(roomId);
      }

      socket.to(roomId).emit("user-connected", userId);
    }));

    socket.on("offer", withValidation("offer", (payload: any) => {
       if (payload && payload.target && typeof payload.target === 'string') {
         io.to(payload.target).emit("offer", payload);
       }
    }));
    socket.on("answer", withValidation("answer", (payload: any) => {
       if (payload && payload.target && typeof payload.target === 'string') {
         io.to(payload.target).emit("answer", payload);
       }
    }));
    socket.on("ice-candidate", withValidation("ice-candidate", (payload: any) => {
       if (payload && payload.target && typeof payload.target === 'string') {
         io.to(payload.target).emit("ice-candidate", payload);
       }
    }));
    socket.on("request-connection", withValidation("request-connection", (payload: any) => {
       if (payload && payload.roomId && typeof payload.roomId === 'string') {
         socket.to(payload.roomId).emit("request-connection", payload.userId);
       }
    }));
    socket.on("toggle-live", withValidation("toggle-live", (roomId: string, isLive: boolean) => {
       if (typeof roomId === 'string' && typeof isLive === 'boolean') {
         io.to(roomId).emit("live-status-changed", isLive);
       }
    }));

    socket.on("disconnect", () => {
      console.log(`[${new Date().toISOString()}] Socket disconnected: ${socket.id}`);
      socketRateLimits.delete(socket.id); // Clean up tracking
      
      const roomId = socket.data.roomId;
      if (roomId) {
        const room = io.sockets.adapter.rooms.get(roomId);
        const roomSize = room ? room.size : 0;
        
        if (roomSize === 0) {
          const timer = setTimeout(() => {
            // Verify room is still empty before deleting data
            const currentRoom = io.sockets.adapter.rooms.get(roomId);
            if (!currentRoom || currentRoom.size === 0) {
              if (store.rooms[roomId]) {
                delete store.rooms[roomId];
                io.emit(`data-changed:rooms`, { type: 'deleted', id: roomId });
              }
            }
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

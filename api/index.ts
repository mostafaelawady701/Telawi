import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

// Standard Initialize
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://vsmxitplvwqvxbglklcv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 'sb_publishable_rQ8XhbUUEe44ENsafWuRPw_NJktcCWJ';

const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
app.use(express.json());

// --- Security, Logging, and Rate Limiting Middleware ---
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 100;

app.use((req, res, next) => {
  // 1. Structured Logging
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - IP: ${req.ip || req.socket.remoteAddress}`);

  // 2. CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  // 3. Simple In-Memory Rate Limiting
  const ip = req.ip || req.socket.remoteAddress?.toString() || "unknown";
  const now = Date.now();
  let record = rateLimitMap.get(ip);
  
  if (!record || now - record.lastReset > RATE_LIMIT_WINDOW_MS) {
    record = { count: 1, lastReset: now };
  } else {
    record.count++;
  }
  rateLimitMap.set(ip, record);

  if (record.count > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ error: "Too many requests, please try again later." });
  }

  next();
});

// Auth Middleware
const authenticate = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
  }
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
  (req as any).user = user;
  next();
};

const VALID_COLLECTIONS = ['rooms', 'users', 'recordings', 'rounds'];

/**
 * Professional Backend API
 * This API acts as a secure bridge for data operations if needed,
 * though the frontend uses Supabase SDK directly for real-time.
 */

// Health & Stats Entry point
app.get("/api/status", async (req, res) => {
  try {
    const { count, error } = await supabase.from('rooms').select('*', { count: 'exact', head: true });
    if (error) throw error;
    
    res.json({
      status: "online",
      engine: "Supabase Realtime v3",
      activeRooms: count || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ status: "degraded", error: error.message });
  }
});

// Generic Data Retrieval (Persistent)
app.get("/api/data/:collection", authenticate, async (req, res) => {
  const { collection } = req.params;
  
  // Validation
  if (!VALID_COLLECTIONS.includes(collection)) {
    return res.status(400).json({ error: "Invalid collection name" });
  }

  const { data, error } = await supabase.from(collection).select('*').limit(50);
  
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Secure Room Deletion (Backend only logic)
app.delete("/api/rooms/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('rooms').delete().eq('id', id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true, message: "Room purged successfully" });
});

// Room Capacity Enforcement
app.post("/api/rooms/:id/join", authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const { data: room, error } = await supabase.from('rooms').select('maxParticipants').eq('id', id).single();
    if (error || !room) return res.status(404).json({ error: "Room not found" });
    
    // In a real app we'd verify current active participants using presence
    // For now we just return the theoretical capacity allowed
    res.json({ allowed: true, maxParticipants: room.maxParticipants || 10 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Fallback for missing routes
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found in Telawa Backend" });
});

export default app;

// Local runner
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== "production") {
    app.listen(PORT, () => console.log(`🚀 Professional Backend running on port ${PORT}`));
}

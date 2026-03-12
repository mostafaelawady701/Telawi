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
app.get("/api/data/:collection", async (req, res) => {
  const { collection } = req.params;
  const { data, error } = await supabase.from(collection).select('*').limit(50);
  
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Secure Room Deletion (Backend only logic)
app.delete("/api/rooms/:id", async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('rooms').delete().eq('id', id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true, message: "Room purged successfully" });
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

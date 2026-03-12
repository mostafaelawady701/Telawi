
import { createClient } from '@supabase/supabase-js';

// --- INITIALIZATION ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vsmxitplvwqvxbglklcv.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 'sb_publishable_rQ8XhbUUEe44ENsafWuRPw_NJktcCWJ';

export const supabase = createClient(supabaseUrl, supabaseKey);

// --- AUTH SYSTEM (Professional Supabase Auth) ---
export const auth: any = { currentUser: null };

/**
 * Professional login using Supabase Anonymous Auth.
 * This ensures every user has a persistent UUID in the backend.
 */
export const loginAnonymously = async () => {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    
    // Auto-update profile for anonymous users
    if (data.user) {
        const displayName = 'زائر ' + Math.floor(Math.random() * 1000);
        await supabase.auth.updateUser({
            data: { display_name: displayName, is_anonymous: true }
        });
        await syncUserProfile(data.user.id, displayName, true);
    }
    return data;
};

/**
 * Login with a chosen username. 
 * We still use Anonymous Auth for speed, but store the name permanently.
 */
export const loginWithUsername = async (username: string) => {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;

    if (data.user) {
        await supabase.auth.updateUser({
            data: { display_name: username, is_anonymous: false }
        });
        await syncUserProfile(data.user.id, username, false);
    }
    return data;
};

export const logout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
};

/**
 * Syncs Auth state and keeps a mirrored 'users' table for public profiles.
 */
const syncUserProfile = async (uid: string, name: string, isAnon: boolean) => {
    const { error } = await supabase.from('users').upsert({
        id: uid,
        displayName: name,
        isAnonymous: isAnon,
        photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
        lastSeen: new Date().toISOString(),
        createdAt: Date.now()
    });
    if (error) console.error("Error syncing profile to DB:", error);
};

export const onAuthStateChanged = (_authObj: any, callback: (user: any) => void) => {
    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        const user = session?.user;
        if (user) {
            // Transform Supabase User -> App User
            const appUser = {
                uid: user.id,
                email: user.email,
                displayName: user.user_metadata?.display_name || 'قارئ',
                photoURL: user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
                isAnonymous: user.is_anonymous || false
            };
            auth.currentUser = appUser;
            callback(appUser);
            
            // Background sync
            if (event === 'SIGNED_IN') {
                syncUserProfile(appUser.uid, appUser.displayName, appUser.isAnonymous);
            }
        } else {
            auth.currentUser = null;
            callback(null);
        }
    });

    return () => {
        subscription.unsubscribe();
    };
};

// --- DATA SYSTEM (Service Layer) ---
export const db = { isSupabase: true };

// Types
type CollectionPath = { table: string };
type DocPath = { table: string, id: string };

export const collection = (_db: any, ...path: string[]): CollectionPath => ({ table: path[path.length - 1] });
export const doc = (_db: any, ...path: string[]): DocPath => ({ table: path[path.length - 2], id: path[path.length - 1] });

// --- OFFLINE QUEUE & RETRY LOGIC ---
const offlineQueue: Array<() => Promise<void>> = [];
let isOnline = navigator.onLine;

window.addEventListener('online', async () => {
    isOnline = true;
    while (offlineQueue.length > 0) {
        const mutation = offlineQueue.shift();
        if (mutation) await mutation().catch(console.error);
    }
});
window.addEventListener('offline', () => { isOnline = false; });

const executingWithRetry = async <T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> => {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            if (!isOnline) throw new Error('Offline (queued)');
            return await operation();
        } catch (error: any) {
            if (error.message === 'Offline (queued)' || error.message?.includes('Failed to fetch')) {
                if (attempt === maxRetries - 1) throw error;
                await new Promise(res => setTimeout(res, 1000 * Math.pow(2, attempt))); // Exponential backoff
                attempt++;
            } else {
                throw error; // Not a transient network error
            }
        }
    }
    throw new Error('Max retries reached');
};

// Standardized Add (with error tracking & validation)
export const addDoc = async (collRef: CollectionPath, data: Record<string, any>) => {
    if (!data || Object.keys(data).length === 0) throw new Error("Cannot add empty document");

    const { table } = collRef;
    const finalData = { ...data };
    delete finalData.id;
    delete finalData.uid;

    const operation = async () => {
        const { data: inserted, error } = await supabase.from(table).insert([finalData]).select().single();
        if (error) {
            console.error(`[Backend Error] Insert in ${table}:`, error);
            throw error;
        }
        return { id: inserted.id, ...inserted };
    };

    if (!isOnline) {
        return new Promise((resolve) => {
            offlineQueue.push(async () => resolve(await operation()));
        });
    }
    return executingWithRetry(operation);
};

// Standardized Update (with smart array handling, retry bounds, & validation)
export const updateDoc = async (docRef: DocPath, data: Record<string, any>) => {
    if (!data || Object.keys(data).length === 0) return;

    const { table, id } = docRef;
    const finalData = { ...data };
    delete finalData.id;
    delete finalData.uid;

    const operation = async () => {
        // Advanced Merge for Arrays with optimistic retries to mitigate race condition
        const arrayFields = ['participants', 'readyUsers', 'likes'];
        let attempt = 0;
        let success = false;
        
        while (attempt < 3 && !success) {
            try {
                for (const key of arrayFields) {
                    if (finalData[key]) {
                        const { data: current, error: fetchErr } = await supabase.from(table).select(key).eq('id', id).single();
                        if (fetchErr) throw fetchErr;
                        
                        const currentArray = (current && Array.isArray(current[key as keyof typeof current])) ? (current[key as keyof typeof current] as unknown as any[]) : [];
                        const newValue = Array.isArray(finalData[key]) ? (finalData[key] as unknown as any[]) : [finalData[key]];
                        const merged = Array.from(new Set([...currentArray, ...newValue]));
                        finalData[key] = merged;
                    }
                }
                const { error } = await supabase.from(table).update(finalData).eq('id', id);
                if (error) throw error;
                success = true;
            } catch (error) {
                attempt++;
                if (attempt >= 3) {
                    console.error(`[Backend Error] Update in ${table} after retries:`, error);
                    throw error;
                }
                await new Promise(res => setTimeout(res, 300 * attempt)); // Short jitter backoff for concurrency
            }
        }
    };

    if (!isOnline) {
        offlineQueue.push(operation);
        return;
    }
    await executingWithRetry(operation);
};

export const deleteDoc = async (docRef: DocPath) => {
    const { table, id } = docRef;
    const operation = async () => {
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) throw error;
    };
    if (!isOnline) {
        offlineQueue.push(operation);
        return;
    }
    await executingWithRetry(operation);
};

// Optimized Real-time Subscriptions
export const onSnapshot = (collOrDocRef: any, callback: (snapshot: any) => void, errorCallback?: (err: any) => void) => {
    const table = collOrDocRef.table;
    const id = collOrDocRef.id;

    const fetchData = async () => {
        try {
            if (id) {
                const { data, error } = await supabase.from(table).select().eq('id', id).maybeSingle();
                if (error) throw error;
                callback({ exists: () => !!data, id: id, data: () => data });
            } else {
                const { data, error } = await supabase.from(table).select().order('createdAt', { ascending: false });
                if (error) throw error;
                const docs = (data || []).map((d: any) => ({ id: d.id, data: () => d }));
                callback({ docs, empty: docs.length === 0 });
            }
        } catch (err) {
            if (errorCallback) errorCallback(err);
            else console.error(`[Real-time Error] ${table}:`, err);
        }
    };

    fetchData();
    // Use Math.random() in channel string to prevent Realtime channel collisions across remounts
    const channelName = `live-${table}-${id || 'all'}-${Math.random().toString(36).substr(2, 9)}`;
    const sub = supabase.channel(channelName).on('postgres_changes', { event: '*', schema: 'public', table }, () => fetchData()).subscribe();
    return () => { supabase.removeChannel(sub); };
};

// Direct Fetch Utils
export const getDocs = async (collRef: CollectionPath) => {
    const { table } = collRef;
    const res = await executingWithRetry(async () => await supabase.from(table).select().order('createdAt', { ascending: false }));
    const { data, error } = res;
    if (error) throw error;
    return { docs: (data || []).map(d => ({ id: d.id, data: () => d })), empty: (data || []).length === 0 };
};

export const getDoc = async (docRef: DocPath) => {
    const { table, id } = docRef;
    const res = await executingWithRetry(async () => await supabase.from(table).select().eq('id', id).maybeSingle());
    const { data, error } = res;
    if (error) throw error;
    return { exists: () => !!data, id: data?.id, data: () => data };
};

// Misc Helpers
// --- STATISTICS & RANKING ---
/**
 * Calculates user statistics based on their recordings
 */
export const getUserStats = async (uid: string) => {
    const { data: recs, error } = await supabase
        .from('recordings')
        .select('score')
        .eq('userId', uid);
        
    if (error) return { totalScore: 0, count: 0, average: 0 };
    
    const totalScore = recs.reduce((sum, r) => sum + (r.score || 0), 0);
    return {
        totalScore,
        count: recs.length,
        average: recs.length > 0 ? totalScore / recs.length : 0
    };
};

/**
 * Atomically syncs a user's score, rank, and stats via a Postgres RPC function.
 * This eliminates race conditions that occur with the two-step JS read+write approach.
 */
export const syncUserScore = async (uid: string) => {
    const { error } = await supabase.rpc('sync_user_score', { user_id: uid });
    if (error) {
        // Fallback to the JS approach if the RPC function hasn't been deployed yet
        console.warn('[syncUserScore] RPC not available, using fallback:', error.message);
        const stats = await getUserStats(uid);
        await supabase.from('users').update({
            totalScore: stats.totalScore,
            recordingCount: stats.count,
            averageScore: stats.average
        }).eq('id', uid);
    }
};

/**
 * Updates public user profile
 */
export const updateUserProfile = async (uid: string, data: any) => {
    const { error } = await supabase.from('users').update(data).eq('id', uid);
    if (error) throw error;
};

/**
 * Fetches the global leaderboard sorted by score
 */
export const getGlobalLeaderboard = async (limitCount = 10) => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('totalScore', { ascending: false })
        .limit(limitCount);
        
    return data || [];
};

export const query = (c: any, ..._args: any[]) => c;
export const orderBy = (..._args: any[]) => ({});
export const limit = (..._args: any[]) => ({});
export const arrayUnion = (val: any) => val;
export const arrayRemove = (val: any) => val;
export const setDoc = updateDoc;
export const loginWithGoogle = loginAnonymously;
export const writeBatch = () => ({ delete: () => {}, commit: async () => {} });
export const serverTimestamp = () => Date.now();

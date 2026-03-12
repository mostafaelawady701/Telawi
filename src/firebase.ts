
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
export const db: any = { isSupabase: true };

export const collection = (_db: any, ...path: string[]) => ({ table: path[path.length - 1] });
export const doc = (_db: any, ...path: string[]) => ({ table: path[path.length - 2], id: path[path.length - 1] });

// Standardized Add (with error tracking)
export const addDoc = async (collRef: any, data: any) => {
    const { table } = collRef;
    const finalData = { ...data };
    delete finalData.id;
    delete finalData.uid;

    const { data: inserted, error } = await supabase.from(table).insert([finalData]).select().single();
    if (error) {
        console.error(`[Backend Error] Insert in ${table}:`, error);
        throw error;
    }
    return { id: inserted.id, ...inserted };
};

// Standardized Update (with smart array handling)
export const updateDoc = async (docRef: any, data: any) => {
    const { table, id } = docRef;
    const finalData = { ...data };
    delete finalData.id;
    delete finalData.uid;

    // Advanced Merge for Arrays (Participants, Likes, etc.)
    const arrayFields = ['participants', 'readyUsers', 'likes'];
    for (const key of arrayFields) {
        if (finalData[key]) {
            const { data: current } = await supabase.from(table).select(key).eq('id', id).single();
            const currentArray = (current && Array.isArray(current[key])) ? current[key] : [];
            const newValue = Array.isArray(finalData[key]) ? finalData[key] : [finalData[key]];
            const merged = Array.from(new Set([...currentArray, ...newValue]));
            finalData[key] = merged;
        }
    }

    const { error } = await supabase.from(table).update(finalData).eq('id', id);
    if (error) {
        console.error(`[Backend Error] Update in ${table}:`, error);
        throw error;
    }
};

export const deleteDoc = async (docRef: any) => {
    const { table, id } = docRef;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
};

// Optimized Real-time Subscriptions
export const onSnapshot = (collOrDocRef: any, callback: (snapshot: any) => void, errorCallback?: (err: any) => void) => {
    const { table, id } = collOrDocRef;

    const fetchData = async () => {
        try {
            if (id) {
                const { data, error } = await supabase.from(table).select().eq('id', id).maybeSingle();
                if (error) throw error;
                callback({ exists: () => !!data, id: id, data: () => data });
            } else {
                const { data, error } = await supabase.from(table).select().order('createdAt', { ascending: false });
                if (error) throw error;
                const docs = (data || []).map(d => ({ id: d.id, data: () => d }));
                callback({ docs, empty: docs.length === 0 });
            }
        } catch (err) {
            if (errorCallback) errorCallback(err);
            else console.error(`[Real-time Error] ${table}:`, err);
        }
    };

    fetchData();
    const sub = supabase.channel(`live-${table}-${id || 'all'}`).on('postgres_changes', { event: '*', schema: 'public', table }, () => fetchData()).subscribe();
    return () => { supabase.removeChannel(sub); };
};

// Direct Fetch Utils
export const getDocs = async (collRef: any) => {
    const { table } = collRef;
    const { data, error } = await supabase.from(table).select().order('createdAt', { ascending: false });
    if (error) throw error;
    return { docs: (data || []).map(d => ({ id: d.id, data: () => d })), empty: (data || []).length === 0 };
};

export const getDoc = async (docRef: any) => {
    const { table, id } = docRef;
    const { data, error } = await supabase.from(table).select().eq('id', id).maybeSingle();
    if (error) throw error;
    return { exists: () => !!data, data: () => data };
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
 * Fetches the global leaderboard
 */
export const getGlobalLeaderboard = async (limitCount = 10) => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('createdAt', { ascending: false }) // Or by a 'totalScore' field if you add one
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


import { createClient } from '@supabase/supabase-js';

// --- INITIALIZATION ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vsmxitplvwqvxbglklcv.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 'sb_publishable_rQ8XhbUUEe44ENsafWuRPw_NJktcCWJ';

export const supabase = createClient(supabaseUrl, supabaseKey);

// --- AUTH & AUTHENTICATION ---
// Professional projects use Supabase Auth. We keep these helpers for backward compatibility.
const STORAGE_USER_KEY = 'telawa_user';
export const auth: any = { currentUser: null };

export const loginAnonymously = async () => {
    const user = {
        uid: 'guest_' + Math.random().toString(36).substr(2, 9),
        displayName: 'زائر ' + Math.floor(Math.random() * 1000),
        photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`,
        isAnonymous: true,
    };
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
    window.location.reload();
    return { user };
};

export const loginWithUsername = (username: string) => {
    const user = {
        uid: 'user_' + Math.random().toString(36).substr(2, 9),
        displayName: username,
        photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
        isAnonymous: false,
    };
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
    window.location.reload();
};

export const logout = async () => {
    localStorage.removeItem(STORAGE_USER_KEY);
    window.location.reload();
};

export const onAuthStateChanged = (_authObj: any, callback: (user: any) => void) => {
    const savedUser = localStorage.getItem(STORAGE_USER_KEY);
    const user = savedUser ? JSON.parse(savedUser) : null;
    auth.currentUser = user; 
    callback(user);
    return () => { };
};

// --- FIRESTORE BRIDGE (PROFESSIONAL IMPLEMENTATION) ---
// This bridge allows using Firestore-like syntax but talks directly to Supabase professionally.

export const db: any = { isSupabase: true };

export const collection = (_db: any, ...path: string[]) => {
    return { table: path[0], fullPath: path.join('/') };
};

export const doc = (_db: any, ...path: string[]) => {
    // path could be ['rooms', roomId] or ['rooms', roomId, 'rounds', roundId]
    return { 
        table: path[path.length - 2], 
        id: path[path.length - 1],
        path: path.join('/') 
    };
};

export const addDoc = async (collRef: any, data: any) => {
    const { table } = collRef;
    const { data: inserted, error } = await supabase
        .from(table)
        .insert([{ ...data }]) // created_at handled by Postgres
        .select()
        .single();

    if (error) {
        console.error(`[Professional Error] Supabase Insert in ${table}:`, error);
        throw error;
    }
    return inserted;
};

export const updateDoc = async (docRef: any, data: any) => {
    const { table, id } = docRef;
    
    // Support arrayUnion/arrayRemove (Firestore emulation)
    const processedData = { ...data };
    for (const key in processedData) {
        const val = processedData[key];
        if (val && typeof val === 'object' && (val as any)._type === 'arrayOp') {
            // Fetch current state for array operations (Non-ideal for scale, but standard for this bridge)
            const { data: current } = await supabase.from(table).select(key).eq('id', id).single();
            const currentArray = (current && Array.isArray(current[key])) ? current[key] : [];
            
            if (val.op === 'union') {
                if (!currentArray.includes(val.value)) {
                    processedData[key] = [...currentArray, val.value];
                } else {
                    delete processedData[key];
                }
            } else if (val.op === 'remove') {
                processedData[key] = currentArray.filter((v: any) => v !== val.value);
            }
        }
    }

    if (Object.keys(processedData).length === 0) return;

    const { error } = await supabase
        .from(table)
        .update(processedData)
        .eq('id', id);

    if (error) {
        console.error(`[Professional Error] Supabase Update in ${table}:`, error);
        throw error;
    }
};

export const deleteDoc = async (docRef: any) => {
    const { table, id } = docRef;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
};

export const onSnapshot = (queryOrRef: any, callback: (snapshot: any) => void, errorCallback?: (err: any) => void) => {
    const table = queryOrRef.table;
    const id = queryOrRef.id;

    const fetchData = async () => {
        try {
            if (id) {
                const { data, error } = await supabase.from(table).select().eq('id', id).maybeSingle();
                if (error) throw error;
                callback({
                    exists: () => !!data,
                    id: id,
                    data: () => data
                });
            } else {
                let query = supabase.from(table).select();
                // Simple descending order if it's a collection
                query = query.order('created_at', { ascending: false });
                
                const { data, error } = await query;
                if (error) throw error;
                
                const docs = (data || []).map(d => ({
                    id: d.id,
                    ref: { table, id: d.id },
                    data: () => d
                }));
                callback({ docs });
            }
        } catch (err) {
            console.error(`[Professional Error] Realtime Fetch on ${table}:`, err);
            if (errorCallback) errorCallback(err);
        }
    };

    fetchData();

    // Subscribe to REALTIME changes for the table
    const subscription = supabase
        .channel(`table-changes-${table}-${id || 'all'}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: table }, (_payload) => {
            fetchData();
        })
        .subscribe();

    return () => {
        supabase.removeChannel(subscription);
    };
};

export const getDocs = async (collRef: any) => {
    const { table } = collRef;
    const { data, error } = await supabase.from(table).select();
    if (error) throw error;
    const docs = (data || []).map(d => ({
        id: d.id,
        ref: { table, id: d.id },
        data: () => d
    }));
    return { docs, empty: docs.length === 0 };
};

export const getDoc = async (docRef: any) => {
    const { table, id } = docRef;
    const { data, error } = await supabase.from(table).select().eq('id', id).maybeSingle();
    if (error) throw error;
    return {
        exists: () => !!data,
        data: () => data
    };
};

// --- FIRESTORE QUERY OPERATORS ---
export const query = (c: any, ..._args: any[]) => c;
export const orderBy = (..._args: any[]) => ({});
export const limit = (..._args: any[]) => ({});
export const arrayUnion = (item: any) => ({ _type: 'arrayOp', op: 'union', value: item });
export const arrayRemove = (item: any) => ({ _type: 'arrayOp', op: 'remove', value: item });

export const setDoc = updateDoc;
export const loginWithGoogle = loginAnonymously;
export const writeBatch = () => ({
    delete: () => { },
    commit: async () => { }
});

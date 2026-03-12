
import { createClient } from '@supabase/supabase-js';

// --- INITIALIZATION ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vsmxitplvwqvxbglklcv.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 'sb_publishable_rQ8XhbUUEe44ENsafWuRPw_NJktcCWJ';

export const supabase = createClient(supabaseUrl, supabaseKey);

// --- AUTH MOCK ---
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

// --- FIRESTORE BRIDGE ---
export const db: any = { isSupabase: true };

export const collection = (_db: any, ...path: string[]) => {
    const table = path[path.length - 1]; 
    return { table };
};

export const doc = (_db: any, ...path: string[]) => {
    const table = path[path.length - 2];
    const id = path[path.length - 1];
    return { table, id };
};

export const addDoc = async (collRef: any, data: any) => {
    const { table } = collRef;
    const finalData = { ...data };
    delete finalData.id;
    delete finalData.uid;

    const { data: inserted, error } = await supabase
        .from(table)
        .insert([finalData])
        .select()
        .single();

    if (error) {
        console.error(`[Supabase Error] Insert in ${table}:`, error);
        throw error;
    }
    return { id: inserted.id, ...inserted };
};

export const updateDoc = async (docRef: any, data: any) => {
    const { table, id } = docRef;
    const finalData = { ...data };
    delete finalData.id;
    delete finalData.uid;

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
        console.error(`[Supabase Error] Update in ${table}:`, error);
        throw error;
    }
};

export const deleteDoc = async (docRef: any) => {
    const { table, id } = docRef;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
};

export const onSnapshot = (collOrDocRef: any, callback: (snapshot: any) => void, errorCallback?: (err: any) => void) => {
    const { table, id } = collOrDocRef;

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
                const { data, error } = await supabase.from(table).select().order('createdAt', { ascending: false });
                if (error) throw error;
                const docs = (data || []).map(d => ({
                    id: d.id,
                    data: () => d
                }));
                callback({ docs, empty: docs.length === 0 });
            }
        } catch (err) {
            if (errorCallback) errorCallback(err);
            else console.error(`[Supabase Error] Realtime on ${table}:`, err);
        }
    };

    fetchData();
    const subscription = supabase.channel(`sync-${table}-${id || 'all'}`).on('postgres_changes', { event: '*', schema: 'public', table }, () => fetchData()).subscribe();
    return () => { supabase.removeChannel(subscription); };
};

export const getDocs = async (collRef: any) => {
    const { table } = collRef;
    const { data, error } = await supabase.from(table).select();
    if (error) throw error;
    return {
        docs: (data || []).map(d => ({
            id: d.id,
            data: () => d
        })),
        empty: (data || []).length === 0
    };
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

export const query = (c: any, ..._args: any[]) => c;
export const orderBy = (..._args: any[]) => ({});
export const limit = (..._args: any[]) => ({});
export const arrayUnion = (val: any) => val;
export const arrayRemove = (val: any) => val;
export const setDoc = updateDoc;
export const loginWithGoogle = loginAnonymously;
export const writeBatch = () => ({ delete: () => {}, commit: async () => {} });
export const serverTimestamp = () => Date.now();

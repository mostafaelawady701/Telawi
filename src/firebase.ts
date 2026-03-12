
import { createClient } from '@supabase/supabase-js';
import { io } from 'socket.io-client';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vsmxitplvwqvxbglklcv.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 'sb_publishable_rQ8XhbUUEe44ENsafWuRPw_NJktcCWJ';

export const supabase = createClient(supabaseUrl, supabaseKey);
const socket = io({ path: '/socket.io/', transports: ['polling'] });

// --- Auth Mock (Local for session, but we could use Supabase Auth if needed later) ---
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

export const onAuthStateChanged = (authObj: any, callback: (user: any) => void) => {
    const savedUser = localStorage.getItem(STORAGE_USER_KEY);
    callback(savedUser ? JSON.parse(savedUser) : null);
    return () => { };
};

// --- "Firestore" API Mapped to Supabase ---
export const db: any = {};

export const collection = (db_or_ref: any, ...path: string[]) => {
    return { table: path[path.length - 1], path: path.join('/') };
};

export const doc = (db_or_ref: any, ...path: string[]) => {
    let fullPath = (db_or_ref && db_or_ref.path) ? db_or_ref.path + '/' : '';
    fullPath += path.join('/');
    const parts = fullPath.split('/');
    return {
        table: parts[parts.length - 2],
        id: parts[parts.length - 1],
        path: fullPath
    };
};

export const addDoc = async (collRef: any, data: any) => {
    const { table } = collRef;
    const { data: inserted, error } = await supabase
        .from(table)
        .insert([{ ...data, created_at: new Date() }])
        .select()
        .single();

    if (error) console.error("Supabase Add Error:", error);
    return inserted;
};

export const updateDoc = async (docRef: any, data: any) => {
    const { table, id } = docRef;
    const { error } = await supabase
        .from(table)
        .update(data)
        .eq('id', id);
    if (error) console.error("Supabase Update Error:", error);
};

export const deleteDoc = async (docRef: any) => {
    const { table, id } = docRef;
    const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);
    if (error) console.error("Supabase Delete Error:", error);
};

export const onSnapshot = (queryOrRef: any, callback: (snapshot: any) => void) => {
    const table = queryOrRef.table;
    const id = queryOrRef.id;

    // Initial fetch
    const fetchData = async () => {
        if (id) {
            const { data } = await supabase.from(table).select().eq('id', id).single();
            callback({
                exists: () => !!data,
                id: id,
                data: () => data
            });
        } else {
            const { data } = await supabase.from(table).select().order('created_at', { ascending: false });
            const docs = (data || []).map(d => ({
                id: d.id,
                ref: { table, id: d.id },
                data: () => d
            }));
            callback({ docs });
        }
    };

    fetchData();

    // Subscribe to real-time changes
    const subscription = supabase
        .channel(`public:${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: table }, (payload) => {
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
    const docs = (data || []).map(d => ({
        id: d.id,
        ref: { table, id: d.id },
        data: () => d
    }));
    return { docs, empty: docs.length === 0 };
};

export const getDoc = async (docRef: any) => {
    const { table, id } = docRef;
    const { data } = await supabase.from(table).select().eq('id', id).single();
    return {
        exists: () => !!data,
        data: () => data
    };
};

// Dummy exports
export const query = (c: any) => c;
export const orderBy = () => ({});
export const limit = () => ({});
export const arrayUnion = (item: any) => item;
export const arrayRemove = (item: any) => item;
export const setDoc = updateDoc;
export const loginWithGoogle = loginAnonymously;
export const writeBatch = () => ({
    delete: () => { },
    commit: async () => { }
});

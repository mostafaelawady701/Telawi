
import { createClient } from '@supabase/supabase-js';

// --- INITIALIZATION ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vsmxitplvwqvxbglklcv.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 'sb_publishable_rQ8XhbUUEe44ENsafWuRPw_NJktcCWJ';

export const supabase = createClient(supabaseUrl, supabaseKey);

export const auth: any = { currentUser: null };

export const loginAnonymously = async () => {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    if (data.user) {
        const displayName = 'زائر ' + Math.floor(Math.random() * 1000);
        await supabase.auth.updateUser({ data: { display_name: displayName, is_anonymous: true } });
        await syncUserProfile(data.user.id, displayName, true);
    }
    return data;
};

export const loginWithUsername = async (username: string) => {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    if (data.user) {
        await supabase.auth.updateUser({ data: { display_name: username, is_anonymous: false } });
        await syncUserProfile(data.user.id, username, false);
    }
    return data;
};

export const logout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
};

const syncUserProfile = async (uid: string, name: string, isAnon: boolean) => {
    const { error } = await supabase.from('users').upsert({
        id: uid,
        display_name: name,
        is_anonymous: isAnon,
        photo_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
        last_seen: new Date().toISOString(),
        created_at: Date.now()
    });
    if (error) console.error("Error syncing profile to DB:", error);
};

export const onAuthStateChanged = (_authObj: any, callback: (user: any) => void) => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        const user = session?.user;
        if (user) {
            const appUser = {
                uid: user.id,
                email: user.email,
                displayName: user.user_metadata?.display_name || 'قارئ',
                photoURL: user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
                isAnonymous: user.is_anonymous || false
            };
            auth.currentUser = appUser;
            callback(appUser);
            if (event === 'SIGNED_IN') syncUserProfile(appUser.uid, appUser.displayName, appUser.isAnonymous);
        } else {
            auth.currentUser = null;
            callback(null);
        }
    });
    return () => { subscription.unsubscribe(); };
};

// --- DATA SYSTEM ---
export const db = { isSupabase: true };
export const collection = (_db: any, ...path: string[]): any => ({ table: path[path.length - 1] });
export const doc = (_db: any, ...path: string[]): any => ({ table: path[path.length - 2], id: path[path.length - 1] });

// Mappers to handle CamelCase -> SnakeCase
const toSnake = (obj: any) => {
    const snake: any = {};
    for (const key in obj) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        snake[snakeKey] = obj[key];
    }
    return snake;
};

const fromSnake = (obj: any) => {
    if (!obj) return obj;
    const camel: any = {};
    for (const key in obj) {
        const camelKey = key.replace(/([-_][a-z])/g, group => group.toUpperCase().replace('-', '').replace('_', ''));
        camel[camelKey] = obj[key];
    }
    return camel;
};

export const addDoc = async (collRef: any, data: any) => {
    const { data: inserted, error } = await supabase.from(collRef.table).insert([toSnake(data)]).select().single();
    if (error) throw error;
    return fromSnake(inserted);
};

export const updateDoc = async (docRef: any, data: any) => {
    const { error } = await supabase.from(docRef.table).update(toSnake(data)).eq('id', docRef.id);
    if (error) throw error;
};

export const deleteDoc = async (docRef: any) => {
    const { error } = await supabase.from(docRef.table).delete().eq('id', docRef.id);
    if (error) throw error;
};

export const onSnapshot = (collOrDocRef: any, callback: (snap: any) => void) => {
    const table = collOrDocRef.table;
    const id = collOrDocRef.id;

    const stream = async () => {
        if (id) {
            const { data } = await supabase.from(table).select().eq('id', id).maybeSingle();
            callback({ exists: () => !!data, id, data: () => fromSnake(data) });
        } else {
            const { data } = await supabase.from(table).select().order('created_at', { ascending: false });
            const docs = (data || []).map(d => ({ id: d.id, data: () => fromSnake(d) }));
            callback({ docs, empty: docs.length === 0 });
        }
    };

    stream();
    const sub = supabase.channel(`pub-${table}`).on('postgres_changes', { event: '*', schema: 'public', table }, () => stream()).subscribe();
    return () => { supabase.removeChannel(sub); };
};

export const getUserStats = async (uid: string) => {
    const { data } = await supabase.from('recordings').select('score').eq('user_id', uid);
    const recs = data || [];
    const totalScore = recs.reduce((sum, r) => sum + (r.score || 0), 0);
    return { totalScore, count: recs.length, average: recs.length > 0 ? totalScore / recs.length : 0 };
};

export const getGlobalLeaderboard = async (limitCount = 10) => {
    const { data } = await supabase.from('users').select('*').order('total_score', { ascending: false }).limit(limitCount);
    return (data || []).map(fromSnake);
};

export const updateUserProfile = async (uid: string, data: any) => {
    const { error } = await supabase.from('users').update(toSnake(data)).eq('id', uid);
    if (error) throw error;
};

export const query = (c: any) => c;
export const orderBy = () => ({});
export const limit = () => ({});
export const arrayUnion = (val: any) => val;
export const getDocs = async (collRef: any) => {
    const { data } = await supabase.from(collRef.table).select().order('created_at', { ascending: false });
    return { docs: (data || []).map(d => ({ id: d.id, data: () => fromSnake(d) })), empty: (data || []).length === 0 };
};

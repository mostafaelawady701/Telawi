
import { io } from 'socket.io-client';

const socket = io(); // Use the existing shared server context

// --- Auth Mock (Still purely local) ---
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

// --- Firestore Mock (Talking to Server) ---
export const db: any = {};

export const collection = (db_or_ref: any, ...path: string[]) => {
    return { collName: path.join('/') };
};

export const doc = (db_or_ref: any, ...path: string[]) => {
    let base = (db_or_ref && db_or_ref.collName) ? db_or_ref.collName + '/' : '';
    const fullPath = base + path.join('/');
    const lastSlash = fullPath.lastIndexOf('/');
    return {
        collName: fullPath.substring(0, lastSlash),
        id: fullPath.substring(lastSlash + 1)
    };
};

export const addDoc = async (collName_or_ref: any, data: any) => {
    const collName = collName_or_ref.collName || collName_or_ref;
    const res = await fetch(`/api/data/${collName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return res.json();
};

export const updateDoc = async (docRef: any, data: any) => {
    await fetch(`/api/data/${docRef.collName}/${docRef.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
};

export const deleteDoc = async (docRef: any) => {
    await fetch(`/api/data/${docRef.collName}/${docRef.id}`, {
        method: 'DELETE'
    });
};

export const onSnapshot = (queryOrRef: any, callback: (snapshot: any) => void) => {
    const collName = queryOrRef.collName || queryOrRef;

    const refresh = async () => {
        if (queryOrRef.id) {
            const res = await fetch(`/api/data/${collName}/${queryOrRef.id}`);
            const data = await res.json();
            callback({
                exists: () => !!data,
                id: queryOrRef.id,
                data: () => data
            });
        } else {
            const res = await fetch(`/api/data/${collName}`);
            const dataObj = await res.json();
            const docs = Object.values(dataObj).map((d: any) => ({
                id: d.id,
                ref: { collName, id: d.id },
                data: () => d
            }));
            callback({ docs });
        }
    };

    refresh();

    // Listen for changes from server
    const eventName = `data-changed:${collName}`;
    socket.on(eventName, refresh);

    return () => {
        socket.off(eventName, refresh);
    };
};

export const getDocs = async (collNameOrQuery: any) => {
    const collName = collNameOrQuery.collName || collNameOrQuery;
    const res = await fetch(`/api/data/${collName}`);
    const dataObj = await res.json();
    const docs = Object.values(dataObj).map((d: any) => ({
        id: d.id,
        ref: { collName, id: d.id },
        data: () => d
    }));
    return {
        docs,
        empty: docs.length === 0
    };
};

export const getDoc = async (docRef: any) => {
    const res = await fetch(`/api/data/${docRef.collName}/${docRef.id}`);
    const data = await res.json();
    return {
        exists: () => !!data,
        data: () => data
    };
};

// Dummy constants
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

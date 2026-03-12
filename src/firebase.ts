
// Mock Firebase replacement using LocalStorage
const STORAGE_USER_KEY = 'telawa_user';
const STORAGE_DATA_KEY = 'telawa_data';

// --- Auth Mock ---
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

// --- Firestore Mock ---
const getLocalData = () => JSON.parse(localStorage.getItem(STORAGE_DATA_KEY) || '{"rooms": {}, "users": {}}');
const setLocalData = (data: any) => localStorage.setItem(STORAGE_DATA_KEY, JSON.stringify(data));

export const db: any = {};
export const collection = (db_or_ref: any, ...path: string[]) => {
    // Simplistic subcollection handling: join path with /
    const fullPath = path.join('/');
    return { collName: fullPath };
};
export const doc = (db_or_ref: any, ...path: string[]) => {
    // If first arg is a ref, its collName is prepended
    let base = '';
    let parts = path;
    if (db_or_ref && typeof db_or_ref === 'object' && db_or_ref.collName) {
        base = db_or_ref.collName + '/';
    }
    const fullPath = base + parts.join('/');
    const lastSlash = fullPath.lastIndexOf('/');
    return {
        collName: fullPath.substring(0, lastSlash),
        id: fullPath.substring(lastSlash + 1)
    };
};

export const addDoc = async (collName_or_ref: any, data: any) => {
    const allData = getLocalData();
    const collName = collName_or_ref.collName || collName_or_ref;
    const id = Math.random().toString(36).substr(2, 9);
    if (!allData[collName]) allData[collName] = {};
    allData[collName][id] = { ...data, id, createdAt: Date.now() };
    setLocalData(allData);
    return { id };
};

export const updateDoc = async (docRef: any, data: any) => {
    const allData = getLocalData();
    const collName = docRef.collName;
    const id = docRef.id;
    if (allData[collName] && allData[collName][id]) {
        allData[collName][id] = { ...allData[collName][id], ...data };
        setLocalData(allData);
    }
};

export const deleteDoc = async (docRef: any) => {
    const allData = getLocalData();
    if (allData[docRef.collName]) {
        delete allData[docRef.collName][docRef.id];
        setLocalData(allData);
    }
};

export const onSnapshot = (queryOrRef: any, callback: (snapshot: any) => void) => {
    const refresh = () => {
        const allData = getLocalData();
        const collName = queryOrRef.collName || queryOrRef;
        const docsObj = allData[collName] || {};

        if (queryOrRef.id) {
            const d = docsObj[queryOrRef.id];
            callback({
                exists: () => !!d,
                id: queryOrRef.id,
                data: () => d
            });
        } else {
            const docs = Object.values(docsObj).map(d => ({
                id: (d as any).id,
                ref: { collName, id: (d as any).id },
                data: () => d
            }));
            callback({ docs });
        }
    };
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
};

export const query = (c: any, ...args: any[]) => c;
export const orderBy = (...args: any[]) => ({});
export const limit = (...args: any[]) => ({});
export const arrayUnion = (item: any) => item;
export const arrayRemove = (item: any) => item;
export const getDocs = async (collNameOrQuery: any) => {
    const allData = getLocalData();
    const collName = collNameOrQuery.collName || collNameOrQuery;
    const docsObj = allData[collName] || {};
    return {
        docs: Object.values(docsObj).map(d => ({
            id: (d as any).id,
            ref: { collName, id: (d as any).id },
            data: () => d
        })),
        empty: Object.keys(docsObj).length === 0
    };
};

export const loginWithGoogle = loginAnonymously;
export const setDoc = updateDoc;
export const getDoc = async (docRef: any) => {
    const allData = getLocalData();
    const d = allData[docRef.collName]?.[docRef.id];
    return {
        exists: () => !!d,
        data: () => d
    };
};
export const writeBatch = (db: any) => ({
    delete: (ref: any) => { },
    commit: async () => { }
});

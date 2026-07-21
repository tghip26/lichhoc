import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyB3R7ar7W3BXIKmcGo0Zc4U5oOUl4mg44c",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "lichhoc-e15b6.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "lichhoc-e15b6",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "lichhoc-e15b6.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "111834925875",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:111834925875:web:520a7a566737f4b20f4c46"
};

// Initialize Firebase only if there's no initialized app
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Enable Offline Persistence safely on the client browser
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("Firestore offline persistence failed (multiple tabs open).");
    } else if (err.code === 'unimplemented') {
      console.warn("Firestore offline persistence is not supported by the browser.");
    }
  });
}

export { app, auth, db, storage };

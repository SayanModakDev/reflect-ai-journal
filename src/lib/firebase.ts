import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const defaultProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "reflectai-journal-app";

export const firebaseConfig = {
  projectId: defaultProjectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${defaultProjectId}.firebaseapp.com`,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || "(default)",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${defaultProjectId}.firebasestorage.app`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  oAuthClientId: import.meta.env.VITE_FIREBASE_OAUTH_CLIENT_ID || ""
};

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let googleProviderInstance: GoogleAuthProvider | null = null;
let isConfigured = false;
let configErrorMessage: string | null = null;

const rawApiKey = (firebaseConfig.apiKey || "").trim();
const hasValidApiKey = Boolean(
  rawApiKey.length > 10 &&
  !rawApiKey.includes('REMOVED') &&
  !rawApiKey.includes('INSERT_') &&
  !rawApiKey.includes('MY_')
);

if (hasValidApiKey) {
  try {
    appInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    authInstance = getAuth(appInstance);
    googleProviderInstance = new GoogleAuthProvider();
    googleProviderInstance.addScope('profile');
    googleProviderInstance.addScope('email');
    dbInstance = getFirestore(appInstance, firebaseConfig.firestoreDatabaseId || undefined);
    isConfigured = true;
  } catch (err: any) {
    console.warn("Firebase client initialization prevented an uncaught error:", err?.message || err);
    configErrorMessage = err?.message || "Invalid Firebase API key or configuration.";
  }
} else {
  configErrorMessage = "Firebase API key is not configured in VITE_FIREBASE_API_KEY.";
}

export const app = appInstance;
export const auth = authInstance;
export const db = dbInstance;
export const googleProvider = googleProviderInstance;
export const isFirebaseConfigured = isConfigured;
export const firebaseInitError = configErrorMessage;


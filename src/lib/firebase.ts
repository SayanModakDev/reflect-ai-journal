import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  projectId: "gen-lang-client-0791255963",
  appId: "1:1010999431868:web:df11318e20af42587ef6b9",
  apiKey: "REMOVED_FIREBASE_API_KEY",
  authDomain: "gen-lang-client-0791255963.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-aireflectionjour-ec4fcd60-e4c7-40f7-bbf8-9503bfbf32e8",
  storageBucket: "gen-lang-client-0791255963.firebasestorage.app",
  messagingSenderId: "1010999431868",
  oAuthClientId: "1010999431868-m1lcmncvh05qolh2pn01omf2rpc5uj8l.apps.googleusercontent.com"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

export { app };

import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Auth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

let adminApp: App | null = null;
let firestoreDb: Firestore | null = null;
let adminAuth: Auth | null = null;

export function getFirebaseAdmin(): { app: App; db: Firestore; auth: Auth } {
  if (adminApp && firestoreDb && adminAuth) {
    return { app: adminApp, db: firestoreDb, auth: adminAuth };
  }

  let projectId = process.env.FIREBASE_PROJECT_ID;
  let databaseId = process.env.FIREBASE_DATABASE_ID;

  // Authoritative fallback to local firebase-applet-config.json
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const configRaw = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configRaw);
      // Prefer config file values if env is missing or has a dummy placeholder
      if (config.projectId && (!projectId || projectId === 'reflectai-journal-app' || projectId.trim() === '')) {
        projectId = config.projectId;
      }
      if (config.firestoreDatabaseId && (!databaseId || databaseId === '(default)' || databaseId.trim() === '')) {
        databaseId = config.firestoreDatabaseId;
      }
    }
  } catch (err) {
    console.warn("Could not read firebase-applet-config.json for admin init:", err);
  }

  // Fallback to project ID from firebase config
  if (!projectId || projectId === 'reflectai-journal-app') {
    projectId = 'gen-lang-client-0791255963';
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0]!;
  } else {
    adminApp = initializeApp({
      projectId: projectId,
    });
  }

  adminAuth = getAuth(adminApp);

  try {
    firestoreDb = databaseId && databaseId !== '(default)'
      ? getFirestore(adminApp, databaseId)
      : getFirestore(adminApp);
  } catch (e) {
    console.warn("Falling back to default getFirestore instance:", e);
    firestoreDb = getFirestore(adminApp);
  }

  return { app: adminApp, db: firestoreDb, auth: adminAuth };
}

export async function verifyAuthToken(authHeader?: string): Promise<{ uid: string; email?: string; name?: string }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing or invalid Authorization Bearer header');
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    throw new Error('Unauthorized: Empty Bearer token');
  }

  try {
    const { auth } = getFirebaseAdmin();
    const decodedToken = await auth.verifyIdToken(token);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
    };
  } catch (err: any) {
    console.error("Token verification failed:", err?.message || err);
    throw new Error(`Unauthorized: Invalid ID token (${err?.message || 'Verification failed'})`);
  }
}


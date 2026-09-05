import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut as fbSignOut } from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured, firebaseInitError } from '../lib/firebase';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  isGuest?: boolean;
  getIdToken?: (forceRefresh?: boolean) => Promise<string>;
}

interface AuthContextType {
  user: (User | AppUser) | null;
  loading: boolean;
  token: string | null;
  isConfigured: boolean;
  initError: string | null;
  signInWithGoogle: () => Promise<void>;
  enterGuestMode: () => void;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  token: null,
  isConfigured: false,
  initError: null,
  signInWithGoogle: async () => {},
  enterGuestMode: () => {},
  signOut: async () => {},
  refreshToken: async () => null,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<(User | AppUser) | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedGuest = localStorage.getItem('aura_guest_mode') === 'true';

    if (!auth) {
      if (storedGuest) {
        setUser({
          uid: 'guest_local_user',
          displayName: 'Journal Author (Local)',
          email: null,
          photoURL: null,
          isGuest: true,
          getIdToken: async () => 'guest-local-token'
        });
        setToken('guest-local-token');
      } else {
        setUser(null);
        setToken(null);
      }
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        localStorage.removeItem('aura_guest_mode');
        try {
          const idToken = await currentUser.getIdToken();
          setToken(idToken);
        } catch (err) {
          console.error("Failed to get ID token:", err);
          setToken(null);
        }
      } else if (storedGuest) {
        setUser({
          uid: 'guest_local_user',
          displayName: 'Journal Author (Local)',
          email: null,
          photoURL: null,
          isGuest: true,
          getIdToken: async () => 'guest-local-token'
        });
        setToken('guest-local-token');
      } else {
        setUser(null);
        setToken(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const enterGuestMode = () => {
    localStorage.setItem('aura_guest_mode', 'true');
    setUser({
      uid: 'guest_local_user',
      displayName: 'Journal Author (Local)',
      email: null,
      photoURL: null,
      isGuest: true,
      getIdToken: async () => 'guest-local-token'
    });
    setToken('guest-local-token');
  };

  const refreshToken = async (): Promise<string | null> => {
    if (auth?.currentUser) {
      try {
        const freshToken = await auth.currentUser.getIdToken(true);
        setToken(freshToken);
        return freshToken;
      } catch (err) {
        console.error("Error refreshing token:", err);
      }
    } else if (user && (user as any).isGuest) {
      return 'guest-local-token';
    }
    return null;
  };

  const signInWithGoogle = async () => {
    if (!auth || !googleProvider) {
      throw new Error(
        "Firebase API key is not configured. To use Google Sign-In, please configure VITE_FIREBASE_API_KEY in your environment (.env) with your new rotated key."
      );
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      localStorage.removeItem('aura_guest_mode');
      const idToken = await result.user.getIdToken();
      setUser(result.user);
      setToken(idToken);
    } catch (error: any) {
      const code = error?.code || '';
      const msg = error?.message || '';

      if (code === 'auth/configuration-not-found' || msg.includes('configuration-not-found')) {
        console.warn("Firebase Auth: Google Sign-in provider is not yet activated in Firebase Console:", msg);
        const configErr = new Error(
          "Google Sign-In has not been enabled yet in the Firebase Console for this project. Go to Firebase Console > Authentication > Sign-in method, click 'Get started' and enable 'Google'. You can also continue immediately using Local Reflection Mode below."
        );
        (configErr as any).code = 'auth/configuration-not-found';
        (configErr as any).isConfigNotFound = true;
        throw configErr;
      }

      if (code === 'auth/popup-closed-by-user') {
        console.warn("Firebase Auth: Sign-in popup closed before completion.");
        const popupErr = new Error("Google sign-in popup was closed before finishing.");
        (popupErr as any).code = 'auth/popup-closed-by-user';
        throw popupErr;
      }

      if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
        console.warn("Firebase Auth: Domain not yet authorized in Firebase Console:", msg);
        const domainErr = new Error(
          "This app domain is not in the Firebase Authorized Domains list. Add it in Firebase Console > Authentication > Settings > Authorized domains."
        );
        (domainErr as any).code = 'auth/unauthorized-domain';
        throw domainErr;
      }

      console.warn("Google sign in notice:", error?.message || error);
      throw error;
    }
  };

  const signOut = async () => {
    localStorage.removeItem('aura_guest_mode');
    if (auth) {
      try {
        await fbSignOut(auth);
      } catch (error) {
        console.error("Sign out failed:", error);
      }
    }
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        token,
        isConfigured: isFirebaseConfigured,
        initError: firebaseInitError,
        signInWithGoogle,
        enterGuestMode,
        signOut,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);


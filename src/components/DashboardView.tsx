import React, { useEffect, useState, useCallback } from 'react';
import { Sparkles, LogOut, RefreshCw, Shield, AlertCircle, Menu, X, Brain, CheckCircle2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { JournalEntry } from '../types';
import { MoodAnalytics } from './MoodAnalytics';
import { ReflectionInput } from './ReflectionInput';
import { HistorySidebar } from './HistorySidebar';
import { EntryDetailView } from './EntryDetailView';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { DomainAuthorizationModal } from './DomainAuthorizationModal';
import { FirestoreRulesModal } from './FirestoreRulesModal';

export const DashboardView: React.FC = () => {
  const { user, signOut, signInWithGoogle, token, refreshToken, isConfigured } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isRulesRestricted, setIsRulesRestricted] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [domainModalOpen, setDomainModalOpen] = useState(false);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);

  // Modal state for in-app deletion confirmation
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    entryId: string | null;
    entryTitle: string;
  }>({
    isOpen: false,
    entryId: null,
    entryTitle: '',
  });
  const [isDeleting, setIsDeleting] = useState(false);

  // Helper to persist local cache
  const updateLocalCache = (uid: string, data: JournalEntry[]) => {
    try {
      localStorage.setItem(`aura_journal_entries_${uid}`, JSON.stringify(data));
    } catch (e) {
      console.warn("Local cache save note:", e);
    }
  };

  // Helper to show transient notification toast
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((prev) => (prev === message ? null : prev));
    }, 3500);
  };

  // Direct manual Sync from client Firestore
  const syncEntries = useCallback(async () => {
    if (!user) return;
    setLoadingEntries(true);
    setFetchError(null);

    const isGuestOrNoAuth = (user as any)?.isGuest || !auth?.currentUser;
    if (!db || isGuestOrNoAuth) {
      // Local storage fallback mode
      try {
        const cached = localStorage.getItem(`aura_journal_entries_${user.uid}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            setEntries(parsed);
            showToast(parsed.length > 0 ? `Loaded ${parsed.length} reflections from local storage` : "Local journal is empty");
          }
        } else {
          setEntries([]);
        }
      } catch (err: any) {
        console.warn("Local cache read note:", err);
      } finally {
        setLoadingEntries(false);
      }
      return;
    }

    const pathForGetDocs = `users/${user.uid}/entries`;
    try {
      const entriesRef = collection(db, "users", user.uid, "entries");
      let snapshot;

      // Try ordered query first, fallback to unordered if index/sort issue occurs
      try {
        snapshot = await getDocs(query(entriesRef, orderBy("createdAt", "desc")));
      } catch (orderErr) {
        console.warn("Client query with orderBy note, attempting plain fetch:", orderErr);
        snapshot = await getDocs(entriesRef);
      }

      const firestoreEntries: JournalEntry[] = [];
      snapshot.forEach((docSnap) => {
        firestoreEntries.push({
          id: docSnap.id,
          ...(docSnap.data() as any),
        });
      });

      firestoreEntries.sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );

      setEntries(firestoreEntries);
      updateLocalCache(user.uid, firestoreEntries);
      setIsRulesRestricted(false);
      setFetchError(null);
      showToast(
        firestoreEntries.length > 0
          ? `Synced ${firestoreEntries.length} ${firestoreEntries.length === 1 ? 'reflection' : 'reflections'} from cloud`
          : 'Reflections cloud sync completed (0 entries found)'
      );

      // Also trigger background server API check if token available
      try {
        let currentToken = token;
        if (!currentToken) currentToken = await refreshToken();
        if (currentToken) {
          fetch("/api/entries", {
            headers: { Authorization: `Bearer ${currentToken}` },
          }).catch(() => {});
        }
      } catch {
        // Ignore background server check errors
      }
    } catch (err: any) {
      const isPermissionErr =
        err?.code === 'permission-denied' ||
        (typeof err?.message === 'string' && err.message.includes('Missing or insufficient permissions'));

      if (isPermissionErr) {
        setIsRulesRestricted(true);
        try {
          handleFirestoreError(err, OperationType.LIST, pathForGetDocs);
        } catch (structuredErr) {
          console.warn("Firestore error logged for schema/rules audit:", structuredErr);
        }

        // Bridge: Attempt server-side admin fetch via /api/entries
        let serverSynced = false;
        try {
          let currentToken = token;
          if (!currentToken) currentToken = await refreshToken();
          if (currentToken) {
            const apiRes = await fetch("/api/entries", {
              headers: { Authorization: `Bearer ${currentToken}` }
            });
            if (apiRes.ok) {
              const apiData = await apiRes.json();
              if (Array.isArray(apiData.entries) && apiData.entries.length > 0) {
                setEntries(apiData.entries);
                updateLocalCache(user.uid, apiData.entries);
                serverSynced = true;
                showToast(`Synced ${apiData.entries.length} reflections via Cloud API`);
              }
            }
          }
        } catch (apiErr) {
          console.warn("Server API sync bridge note:", apiErr);
        }

        // Fallback gracefully to local cache so user experience is smooth and data is safe
        if (!serverSynced) {
          const cached = localStorage.getItem(`aura_journal_entries_${user.uid}`);
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed)) setEntries(parsed);
            } catch {}
          }
        }

        setFetchError("Cloud sync permission restricted. Deploy your Firestore Security Rules in Firebase Console to unlock real-time sync.");
        showToast("Active with local reflections");
      } else {
        console.warn("Manual sync notice:", err);
        setFetchError(err?.message || "Failed to sync reflections from cloud");
        showToast("Sync encountered a connection notice.");
      }
    } finally {
      setLoadingEntries(false);
    }
  }, [user, token, refreshToken]);

  // Set up real-time listener for user's isolated documents
  useEffect(() => {
    if (!user) {
      setEntries([]);
      setLoadingEntries(false);
      return;
    }

    // 1. Instantly populate from local cache if available to prevent empty layout flicker
    try {
      const cached = localStorage.getItem(`aura_journal_entries_${user.uid}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEntries(parsed);
          setLoadingEntries(false);
        }
      }
    } catch (e) {
      console.warn("Cached entries read note:", e);
    }

    const isGuestOrNoAuth = (user as any)?.isGuest || !auth?.currentUser;
    if (!db || isGuestOrNoAuth) {
      // Local/offline journal mode - do NOT attach onSnapshot listener to Firestore
      setLoadingEntries(false);
      return;
    }

    setLoadingEntries(true);
    const entriesRef = collection(db, "users", user.uid, "entries");
    const pathForSnapshot = `users/${user.uid}/entries`;

    // Try real-time subscription
    let unsubscribe: (() => void) | undefined;

    const setupListener = (useOrder: boolean) => {
      try {
        const q = useOrder ? query(entriesRef, orderBy("createdAt", "desc")) : entriesRef;
        return onSnapshot(
          q,
          (snapshot) => {
            const firestoreEntries: JournalEntry[] = [];
            snapshot.forEach((docSnap) => {
              firestoreEntries.push({
                id: docSnap.id,
                ...(docSnap.data() as any),
              });
            });

            firestoreEntries.sort(
              (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
            );

            setEntries(firestoreEntries);
            updateLocalCache(user.uid, firestoreEntries);
            setIsRulesRestricted(false);
            setLoadingEntries(false);
            setFetchError(null);
          },
          (error) => {
            console.warn(`Real-time Firestore listener (ordered=${useOrder}) notice:`, error);
            const isPermissionErr =
              error?.code === 'permission-denied' ||
              (typeof error?.message === 'string' && error.message.includes('Missing or insufficient permissions'));

            if (isPermissionErr) {
              try {
                handleFirestoreError(error, OperationType.LIST, pathForSnapshot);
              } catch (structuredErr) {
                console.warn("Firestore listener permission notice:", structuredErr);
              }
              setIsRulesRestricted(true);
              setFetchError("Cloud sync permission restricted. Deploy your Firestore Security Rules in Firebase Console to unlock real-time sync.");
              setLoadingEntries(false);
              return;
            }

            if (useOrder) {
              // Fall back to listener without orderBy
              unsubscribe = setupListener(false);
            } else {
              // Non-permission network fallback
              syncEntries();
            }
          }
        );
      } catch (err) {
        console.warn("setupListener caught error:", err);
        return undefined;
      }
    };

    unsubscribe = setupListener(true);

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, syncEntries]);

  const handleEntryCreated = (newEntry: JournalEntry) => {
    setEntries((prev) => {
      const updated = [newEntry, ...prev.filter((e) => e.id !== newEntry.id)];
      if (user) updateLocalCache(user.uid, updated);
      return updated;
    });
    setSelectedEntry(newEntry);
    showToast("Reflection analyzed & saved successfully");
  };

  // Open modal to delete entry
  const handleDeleteEntry = (id: string) => {
    const target = entries.find((e) => e.id === id);
    setDeleteModalState({
      isOpen: true,
      entryId: id,
      entryTitle: target?.title || target?.summary || 'Reflection',
    });
  };

  // Confirm delete handler (in-app modal, works inside iframes!)
  const confirmDeleteEntry = async () => {
    const id = deleteModalState.entryId;
    if (!id || !user) {
      setDeleteModalState({ isOpen: false, entryId: null, entryTitle: '' });
      return;
    }

    setIsDeleting(true);
    try {
      // 1. Optimistic UI update
      setEntries((prev) => {
        const updated = prev.filter((e) => e.id !== id);
        updateLocalCache(user.uid, updated);
        return updated;
      });

      if (selectedEntry?.id === id) {
        setSelectedEntry(null);
      }

      // 2. Direct delete from authenticated client Firestore if configured
      const isGuestOrNoAuth = (user as any)?.isGuest || !auth?.currentUser;
      if (db && !isGuestOrNoAuth) {
        try {
          await deleteDoc(doc(db, "users", user.uid, "entries", id));
        } catch (clientErr: any) {
          const isPermissionErr =
            clientErr?.code === 'permission-denied' ||
            (typeof clientErr?.message === 'string' && clientErr.message.includes('Missing or insufficient permissions'));
          if (isPermissionErr) {
            try {
              handleFirestoreError(clientErr, OperationType.DELETE, `users/${user.uid}/entries/${id}`);
            } catch (e) {
              console.warn("Firestore delete permission notice:", e);
            }
          } else {
            console.warn("Client Firestore deleteDoc note:", clientErr);
          }
        }
      }

      // 3. Notify backend API endpoint
      try {
        let currentToken = token;
        if (!currentToken) currentToken = await refreshToken();
        if (currentToken) {
          fetch(`/api/entries/${id}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${currentToken}`,
            },
          }).catch((e) => console.warn("Backend API delete notice:", e));
        }
      } catch {
        // Non-blocking
      }

      showToast("Reflection deleted successfully");
      setDeleteModalState({ isOpen: false, entryId: null, entryTitle: '' });
    } catch (err: any) {
      console.error("Failed to delete reflection:", err);
      showToast(err.message || "Could not delete reflection");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConnectCloudSync = async () => {
    try {
      await signInWithGoogle();
      showToast("Connected to Google account with Cloud Sync!");
    } catch (err: any) {
      const isDomainError = Boolean(
        err?.isUnauthorizedDomain ||
        err?.code === 'auth/unauthorized-domain' ||
        (typeof err?.message === 'string' && (
          err.message.includes('Authorized Domains') ||
          err.message.includes('unauthorized-domain') ||
          err.message.includes('Authorized domains')
        ))
      );
      if (isDomainError) {
        setDomainModalOpen(true);
      } else {
        showToast(err?.message || "Sign in failed");
      }
    }
  };

  return (
    <div id="dashboard-container" className="h-screen w-screen flex flex-col bg-stone-50 text-stone-900 overflow-hidden">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          id="status-toast"
          className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 text-stone-50 text-xs font-medium shadow-lg border border-stone-800 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* In-app Safe Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteModalState.isOpen}
        entryTitle={deleteModalState.entryTitle}
        onConfirm={confirmDeleteEntry}
        onCancel={() => setDeleteModalState({ isOpen: false, entryId: null, entryTitle: '' })}
        isDeleting={isDeleting}
      />

      {/* Domain Authorization Guidance Modal */}
      <DomainAuthorizationModal
        isOpen={domainModalOpen}
        onClose={() => setDomainModalOpen(false)}
        onRetry={handleConnectCloudSync}
      />

      {/* Firestore Security Rules Guidance Modal */}
      <FirestoreRulesModal
        isOpen={rulesModalOpen}
        onClose={() => setRulesModalOpen(false)}
        onRetrySync={syncEntries}
        isSyncing={loadingEntries}
      />

      {/* Dashboard Top Navigation */}
      <header id="dashboard-header" className="h-16 border-b border-stone-200/80 bg-white px-4 sm:px-6 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="md:hidden p-2 rounded-lg text-stone-600 hover:bg-stone-100"
            aria-label="Toggle history menu"
          >
            {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-stone-900 text-stone-50 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <span className="font-semibold text-stone-900 text-sm tracking-tight">Aura Reflection</span>
              <span className={`hidden sm:inline-block ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded border ${isConfigured ? 'text-emerald-700 bg-emerald-50 border-emerald-200/60' : 'text-amber-700 bg-amber-50 border-amber-200/60'}`}>
                {isConfigured ? 'Cloud Sync' : 'Local Journal'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {isRulesRestricted && (
            <button
              id="header-rules-badge"
              type="button"
              onClick={() => setRulesModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300/80 cursor-pointer transition-colors shadow-2xs"
              title="Click to view required Firestore Security Rules"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
              <span className="hidden sm:inline">Rules Required</span>
            </button>
          )}

          {(user as any)?.isGuest && (
            <button
              id="connect-cloud-sync-btn"
              type="button"
              onClick={handleConnectCloudSync}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300/80 cursor-pointer transition-colors shadow-2xs"
              title="Upgrade to Google Cloud Sync"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span className="hidden sm:inline">Connect Cloud Sync</span>
            </button>
          )}

          {user && !(user as any)?.isGuest && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-stone-600 border-r border-stone-200 pr-3">
              {user.photoURL ? (
                <img src={user.photoURL} alt="User avatar" className="w-6 h-6 rounded-full border border-stone-200" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-stone-200 flex items-center justify-center text-[10px] font-bold">
                  {user.displayName?.[0] || user.email?.[0] || 'U'}
                </div>
              )}
              <span className="font-medium text-stone-800 max-w-[140px] truncate">
                {user.displayName || user.email}
              </span>
            </div>
          )}

          {/* Sync Button with icon & label */}
          <button
            id="refresh-entries-btn"
            type="button"
            onClick={syncEntries}
            disabled={loadingEntries}
            title="Sync reflections from Cloud Firestore"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 cursor-pointer transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingEntries ? 'animate-spin text-amber-600' : ''}`} />
            <span className="hidden sm:inline">{loadingEntries ? 'Syncing...' : 'Sync'}</span>
          </button>

          <button
            id="signout-btn"
            type="button"
            onClick={() => signOut()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area with History Sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar for Desktop */}
        <div className="hidden md:block h-full">
          <HistorySidebar
            entries={entries}
            selectedEntryId={selectedEntry?.id || null}
            onSelectEntry={(entry) => setSelectedEntry(entry)}
            onNewSession={() => setSelectedEntry(null)}
            onDeleteEntry={handleDeleteEntry}
            onSync={syncEntries}
            isSyncing={loadingEntries}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>

        {/* Mobile Drawer Sidebar */}
        {mobileSidebarOpen && (
          <div className="md:hidden absolute inset-0 z-20 bg-stone-900/40 backdrop-blur-xs flex">
            <div className="w-4/5 max-w-sm h-full bg-white shadow-xl flex flex-col">
              <HistorySidebar
                entries={entries}
                selectedEntryId={selectedEntry?.id || null}
                onSelectEntry={(entry) => {
                  setSelectedEntry(entry);
                  setMobileSidebarOpen(false);
                }}
                onNewSession={() => {
                  setSelectedEntry(null);
                  setMobileSidebarOpen(false);
                }}
                onDeleteEntry={(id) => {
                  handleDeleteEntry(id);
                  setMobileSidebarOpen(false);
                }}
                onSync={syncEntries}
                isSyncing={loadingEntries}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
            </div>
            <div className="flex-1" onClick={() => setMobileSidebarOpen(false)} />
          </div>
        )}

        {/* Scrollable Main Workspace */}
        <main id="journal-workspace" className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-stone-50/50">
          <div className="max-w-4xl mx-auto space-y-6">
            {isRulesRestricted ? (
              <div
                id="rules-restriction-callout"
                className="p-4 sm:p-5 rounded-2xl bg-amber-50/90 border border-amber-300/80 text-amber-950 shadow-xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-200/80 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs sm:text-sm text-amber-950">
                        Firestore Security Rules Required for Real-Time Cloud Sync
                      </h4>
                      <p className="text-xs text-amber-900/90 mt-0.5 leading-relaxed">
                        Google Sign-In succeeded! Your reflections are safely active in local storage. To activate multi-device Cloud Firestore sync, publish the owner-isolated security rules in Firebase Console.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 sm:self-center">
                    <button
                      type="button"
                      id="open-rules-guide-btn"
                      onClick={() => setRulesModalOpen(true)}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs font-medium cursor-pointer transition-colors shadow-xs"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
                      <span>Deploy Rules (1 Min)</span>
                    </button>
                    <button
                      type="button"
                      id="retry-rules-sync-btn"
                      onClick={syncEntries}
                      disabled={loadingEntries}
                      className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-white hover:bg-amber-100/60 text-amber-900 border border-amber-300 text-xs font-medium cursor-pointer transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingEntries ? 'animate-spin' : ''}`} />
                      <span>Retry</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : fetchError ? (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{fetchError}</span>
                </div>
                <button
                  type="button"
                  onClick={syncEntries}
                  className="font-semibold underline ml-2 hover:text-amber-950 cursor-pointer"
                >
                  Retry Sync
                </button>
              </div>
            ) : null}

            {/* Mood Analytics Bar */}
            <MoodAnalytics entries={entries} />

            {/* Workspace: either active entry details or new entry creation */}
            {selectedEntry ? (
              <EntryDetailView
                entry={selectedEntry}
                onBackToNew={() => setSelectedEntry(null)}
                onDeleteEntry={handleDeleteEntry}
                onUpdateEntry={(updated) => {
                  setSelectedEntry(updated);
                  setEntries((prev) => {
                    const next = [updated, ...prev.filter((e) => e.id !== updated.id)];
                    if (user) updateLocalCache(user.uid, next);
                    return next;
                  });
                }}
              />
            ) : (
              <div>
                <ReflectionInput onEntryCreated={handleEntryCreated} />

                {/* Prompting suggestions / reflective prompts */}
                <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="w-4 h-4 text-stone-600" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                      Reflective Starters
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-stone-50 border border-stone-100 text-stone-700">
                      <p className="font-medium text-stone-900 mb-0.5">&ldquo;What energized me today?&rdquo;</p>
                      <p className="text-[11px] text-stone-500">Unpack moments of genuine momentum and gratitude.</p>
                    </div>

                    <div className="p-3 rounded-xl bg-stone-50 border border-stone-100 text-stone-700">
                      <p className="font-medium text-stone-900 mb-0.5">&ldquo;What tension am I carrying?&rdquo;</p>
                      <p className="text-[11px] text-stone-500">Name the friction without judgment to reframe it.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

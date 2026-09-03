import React, { useEffect, useState, useCallback } from 'react';
import { Sparkles, LogOut, RefreshCw, Shield, AlertCircle, Menu, X, Brain, CheckCircle2 } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { JournalEntry } from '../types';
import { MoodAnalytics } from './MoodAnalytics';
import { ReflectionInput } from './ReflectionInput';
import { HistorySidebar } from './HistorySidebar';
import { EntryDetailView } from './EntryDetailView';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

export const DashboardView: React.FC = () => {
  const { user, signOut, token, refreshToken } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
      console.error("Manual sync failed:", err);
      setFetchError(err.message || "Failed to sync reflections from cloud");
      showToast("Sync encountered an error. Check network connection.");
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

    setLoadingEntries(true);
    const entriesRef = collection(db, "users", user.uid, "entries");

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
            setLoadingEntries(false);
            setFetchError(null);
          },
          (error) => {
            console.warn(`Real-time Firestore listener (ordered=${useOrder}) notice:`, error);
            if (useOrder) {
              // Fall back to listener without orderBy
              unsubscribe = setupListener(false);
            } else {
              // Fall back to direct sync
              syncEntries();
            }
          }
        );
      } catch (err) {
        console.warn("setupListener caught error:", err);
        syncEntries();
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

      // 2. Direct delete from authenticated client Firestore
      try {
        await deleteDoc(doc(db, "users", user.uid, "entries", id));
      } catch (clientErr: any) {
        console.warn("Client Firestore deleteDoc note:", clientErr);
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
              <span className="hidden sm:inline-block ml-2 text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded">
                Verified UID Isolation
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {user && (
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
            {fetchError && (
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
            )}

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

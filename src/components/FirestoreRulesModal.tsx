import React, { useState } from 'react';
import { ShieldCheck, Copy, Check, ExternalLink, X, Database, AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import { firebaseConfig } from '../lib/firebase';

interface FirestoreRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetrySync?: () => void;
  isSyncing?: boolean;
}

export const FIRESTORE_RULES_SNIPPET = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Default deny for unauthenticated or foreign access
    match /{document=**} {
      allow read, write: if false;
    }

    // Owner-isolated access for each user's personal journal
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /entries/{entryId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /{allSubpaths=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}`;

export const FirestoreRulesModal: React.FC<FirestoreRulesModalProps> = ({
  isOpen,
  onClose,
  onRetrySync,
  isSyncing = false,
}) => {
  const [copied, setCopied] = useState(false);
  const projectId = firebaseConfig.projectId || 'reflectai-journal-app';
  const consoleFirestoreRulesUrl = `https://console.firebase.google.com/project/${projectId}/firestore/rules`;
  const consoleFirestoreCreateUrl = `https://console.firebase.google.com/project/${projectId}/firestore`;

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(FIRESTORE_RULES_SNIPPET);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
        return;
      }
    } catch {
      // Fallback
    }

    try {
      const el = document.createElement('textarea');
      el.value = FIRESTORE_RULES_SNIPPET;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn("Clipboard copy note:", err);
    }
  };

  return (
    <div
      id="firestore-rules-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="firestore-rules-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="firestore-rules-modal-title"
        className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 sm:p-7 bg-white rounded-2xl shadow-2xl border border-stone-200 text-stone-900 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          id="close-firestore-rules-modal-btn"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 id="firestore-rules-modal-title" className="text-base sm:text-lg font-semibold text-stone-900">
              Publish Firestore Security Rules
            </h3>
            <p className="text-xs text-stone-600 mt-1 leading-relaxed">
              Google Sign-In is authenticated! However, Cloud Firestore requires security rules published in your Firebase project (<strong className="font-mono text-stone-800">{projectId}</strong>) to allow your browser to read and write your private reflections.
            </p>
          </div>
        </div>

        {/* 3 Step Resolution Walkthrough */}
        <div className="space-y-4 mb-5 text-xs text-stone-700">
          <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Why am I seeing "Cloud sync permission restricted"?</span>
            </div>
            <p className="text-[11px] text-amber-900 leading-relaxed">
              New Firebase projects start with all Firestore reads/writes locked (<code className="bg-white/80 px-1 py-0.5 rounded font-mono text-amber-950">allow read, write: if false;</code>), or the Firestore database has not been created yet in Firebase Console. Adding the owner-isolated rules below gives your authenticated Google account full private access.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-stone-900 text-stone-50 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
              <div>
                <p className="font-semibold text-stone-900">Open Firestore in Firebase Console</p>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Go to your project's{' '}
                  <a
                    href={consoleFirestoreRulesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-amber-700 hover:text-amber-900 underline inline-flex items-center gap-1"
                  >
                    <span>Firestore Database &rarr; Rules</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  . If you see "Create database", click it first with standard settings.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-stone-900 text-stone-50 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
              <div className="w-full">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="font-semibold text-stone-900">Replace with Owner-Isolated Security Rules</p>
                  <button
                    type="button"
                    id="copy-rules-snippet-btn"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-900 hover:bg-stone-800 text-stone-50 text-[11px] font-medium cursor-pointer transition-colors shadow-2xs"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-amber-300" />
                        <span>Copy Rules</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="relative rounded-xl bg-stone-900 p-3.5 text-stone-100 font-mono text-[11px] leading-relaxed border border-stone-800 shadow-inner overflow-x-auto max-h-44">
                  <pre className="text-stone-300 select-all">{FIRESTORE_RULES_SNIPPET}</pre>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-stone-900 text-stone-50 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
              <div>
                <p className="font-semibold text-stone-900">Click "Publish" &amp; Sync</p>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  In Firebase Console, click the blue <strong>Publish</strong> button at the top of the rules editor. Changes take ~5 seconds to apply, then click <strong>Retry Cloud Sync</strong> below.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-3 border-t border-stone-200">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
          >
            Continue with Local Storage
          </button>

          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <a
              href={consoleFirestoreRulesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-medium cursor-pointer transition-colors border border-stone-300"
            >
              <span>Open Firebase Rules Tab</span>
              <ExternalLink className="w-3.5 h-3.5 text-stone-600" />
            </a>

            {onRetrySync && (
              <button
                type="button"
                id="retry-cloud-sync-modal-btn"
                onClick={() => {
                  onRetrySync();
                }}
                disabled={isSyncing}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-medium cursor-pointer transition-colors shadow-xs disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Retry Cloud Sync'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

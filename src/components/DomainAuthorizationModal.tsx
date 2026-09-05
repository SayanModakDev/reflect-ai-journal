import React, { useState } from 'react';
import { Globe, Copy, Check, ExternalLink, X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { firebaseConfig } from '../lib/firebase';

interface DomainAuthorizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry?: () => void;
}

export const DomainAuthorizationModal: React.FC<DomainAuthorizationModalProps> = ({
  isOpen,
  onClose,
  onRetry,
}) => {
  const [copied, setCopied] = useState(false);
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const consoleAuthSettingsUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;

  if (!isOpen) return null;

  const copyToClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(currentHostname);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
        return;
      }
    } catch {
      // Fallback below
    }

    try {
      const el = document.createElement('textarea');
      el.value = currentHostname;
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
      id="domain-auth-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="domain-auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="domain-auth-modal-title"
        className="relative w-full max-w-lg p-6 bg-white rounded-2xl shadow-2xl border border-stone-200 text-stone-900 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          id="close-domain-modal-btn"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/80">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 id="domain-auth-modal-title" className="text-base font-semibold text-stone-900">
              Authorize App Domain in Firebase
            </h3>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              Firebase Authentication blocks Google Sign-In popups until your hosting domain is added to your project's <strong>Authorized domains</strong> list.
            </p>
          </div>
        </div>

        {/* Current Domain Box with 1-Click Copy */}
        <div className="mb-4 p-3.5 rounded-xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 overflow-hidden">
            <Globe className="w-4 h-4 text-stone-600 flex-shrink-0" />
            <span className="font-mono text-xs text-stone-900 font-semibold truncate select-all">
              {currentHostname || "App domain"}
            </span>
          </div>
          <button
            type="button"
            id="copy-domain-modal-btn"
            onClick={copyToClipboard}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-50 font-medium text-xs cursor-pointer transition-colors shrink-0 shadow-xs"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300 font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-amber-300" />
                <span>Copy Domain</span>
              </>
            )}
          </button>
        </div>

        {/* 3 Step Instructions */}
        <div className="mb-5 p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-950 space-y-2">
          <p className="font-semibold text-amber-950">How to add in 3 quick steps:</p>
          <ol className="list-decimal list-inside space-y-1.5 pl-0.5 text-stone-700 text-[11px] leading-relaxed">
            <li>
              Open{' '}
              <a
                href={consoleAuthSettingsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline text-stone-900 hover:text-amber-800 inline-flex items-center gap-1"
              >
                <span>Firebase Authentication Settings</span>
                <ExternalLink className="w-3 h-3 text-amber-700" />
              </a>
            </li>
            <li>
              Scroll down to the <strong>Authorized domains</strong> section and click <strong>Add domain</strong>
            </li>
            <li>
              Paste <code className="bg-white px-1 py-0.5 rounded font-mono font-semibold text-stone-900">{currentHostname}</code> and click <strong>Add</strong>
            </li>
          </ol>
          <div className="flex items-center gap-1.5 text-[11px] text-stone-500 pt-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Changes take ~10 seconds. Then you can click Google Sync again.</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
          <a
            href={consoleAuthSettingsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-stone-50 rounded-xl text-xs font-medium cursor-pointer transition-colors shadow-xs"
          >
            <span>Open Firebase Console</span>
            <ExternalLink className="w-3.5 h-3.5 text-amber-300" />
          </a>
          {onRetry && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onRetry();
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-medium cursor-pointer transition-colors shadow-xs"
            >
              Retry Google Sync
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

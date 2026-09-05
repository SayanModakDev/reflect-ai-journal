import React, { useState } from 'react';
import { Sparkles, ShieldCheck, Database, Mic, ArrowRight, BrainCircuit, Lock, KeyRound, PenLine, AlertCircle, ExternalLink, Copy, Check, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { firebaseConfig } from '../lib/firebase';

interface LoginViewProps {
  onSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess }) => {
  const { signInWithGoogle, enterGuestMode, loading, user, isConfigured } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigError, setIsConfigError] = useState(false);
  const [isUnauthorizedDomain, setIsUnauthorizedDomain] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const consoleAuthSettingsUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;

  const copyDomainToClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(currentHostname);
        setCopiedDomain(true);
        setTimeout(() => setCopiedDomain(false), 2500);
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
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2500);
    } catch (err) {
      console.warn("Clipboard copy note:", err);
    }
  };

  React.useEffect(() => {
    if (user) {
      onSuccess();
    }
  }, [user, onSuccess]);

  const handleSignIn = async () => {
    setError(null);
    setIsConfigError(false);
    setIsUnauthorizedDomain(false);
    setSigningIn(true);
    try {
      await signInWithGoogle();
      onSuccess();
    } catch (err: any) {
      console.warn("Sign-in attempt notice:", err?.message || err);
      const isConfigNotFound = Boolean(
        err?.isConfigNotFound ||
        err?.code === 'auth/configuration-not-found' ||
        (typeof err?.message === 'string' && err.message.includes('configuration-not-found'))
      );
      const isDomainError = Boolean(
        err?.isUnauthorizedDomain ||
        err?.code === 'auth/unauthorized-domain' ||
        (typeof err?.message === 'string' && (
          err.message.includes('Authorized Domains') ||
          err.message.includes('unauthorized-domain') ||
          err.message.includes('Authorized domains')
        ))
      );

      setIsConfigError(isConfigNotFound);
      setIsUnauthorizedDomain(isDomainError);
      setError(err?.message || "Failed to sign in with Google. Please try again or use Local Reflection Mode.");
    } finally {
      setSigningIn(false);
    }
  };

  const handleGuestMode = () => {
    enterGuestMode();
    onSuccess();
  };

  return (
    <div id="login-view-container" className="min-h-screen bg-stone-50 text-stone-900 flex flex-col justify-between selection:bg-stone-200">
      {/* Top Bar */}
      <header id="landing-header" className="w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-stone-900 text-stone-50 flex items-center justify-center font-medium shadow-xs">
            <Sparkles className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <span className="font-semibold text-stone-900 tracking-tight text-lg">Aura Reflection</span>
            <span className="ml-2 text-xs font-mono uppercase px-2 py-0.5 rounded-md bg-stone-200 text-stone-700">Gemini 3.6</span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <span className="text-xs text-stone-500 hidden sm:inline-flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-600" /> {isConfigured ? 'Isolated Firestore Cloud Sync' : 'Local Journal Storage'}
          </span>
        </div>
      </header>

      {/* Main Hero & Auth Card */}
      <main id="landing-main" className="max-w-4xl mx-auto px-6 py-12 flex-1 flex flex-col items-center justify-center text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-stone-200/70 text-stone-800 text-xs font-medium mb-6">
          <BrainCircuit className="w-3.5 h-3.5 text-stone-700" />
          <span>Cognitive Journaling & Sentiment Architecture</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-serif text-stone-900 font-normal tracking-tight leading-[1.15] max-w-2xl mb-6">
          Deep, private reflection with empathetic intelligence.
        </h1>

        <p className="text-base sm:text-lg text-stone-600 max-w-xl font-normal leading-relaxed mb-8">
          Transform scattered thoughts into cognitive clarity. Speak or write your daily reflections and receive structured insights, mood analytics, and actionable commitments powered by Gemini 3.6 Flash.
        </p>

        {!isConfigured && (
          <div id="api-key-notice-banner" className="mb-6 w-full max-w-md p-4 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs text-left leading-relaxed">
            <div className="flex items-center gap-2 font-medium text-amber-900 mb-1">
              <KeyRound className="w-4 h-4 text-amber-700 flex-shrink-0" />
              <span>Firebase API Key Rotated or Unset</span>
            </div>
            <p className="text-amber-800">
              The Firebase API key was rotated and safely removed from source files. To enable Google Sign-In and Cloud Firestore sync, define <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono text-[11px]">VITE_FIREBASE_API_KEY</code> in your environment or <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono text-[11px]">.env</code>.
            </p>
            <p className="mt-2 text-amber-800 font-medium">
              You can immediately start journaling below using Local Reflection Mode.
            </p>
          </div>
        )}

        {error && (
          <div id="login-error-banner" className="mb-6 w-full max-w-md p-4 rounded-xl bg-amber-50/90 border border-amber-300/80 text-amber-950 text-sm text-left shadow-xs">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-amber-900">
                  {isUnauthorizedDomain
                    ? "Authorize App Domain in Firebase Console"
                    : isConfigError
                    ? "Google Provider Needs 1-Click Activation"
                    : "Authentication Notice"}
                </p>

                {isUnauthorizedDomain ? (
                  <div id="unauthorized-domain-guide" className="mt-2 text-xs text-amber-950 space-y-3 leading-relaxed">
                    <p className="text-amber-900">
                      Firebase Authentication requires your current app domain to be added to the <strong>Authorized domains</strong> list before allowing Google Sign-In:
                    </p>

                    {/* Domain Box with 1-Click Copy */}
                    <div className="bg-white/95 p-3 rounded-lg border border-amber-300 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Globe className="w-4 h-4 text-amber-700 flex-shrink-0" />
                        <span className="font-mono text-xs text-amber-950 font-semibold truncate select-all">
                          {currentHostname || "App domain"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={copyDomainToClipboard}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-stone-900 hover:bg-stone-800 text-stone-50 font-medium text-[11px] cursor-pointer transition-colors flex-shrink-0 shadow-xs"
                      >
                        {copiedDomain ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-300 font-semibold">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-amber-300" />
                            <span>Copy Domain</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Step-by-Step Instructions */}
                    <div className="bg-amber-100/60 p-3 rounded-lg border border-amber-200/80 space-y-2 text-[11px] text-amber-900">
                      <p className="font-semibold text-amber-950">3-Step Resolution in Firebase Console:</p>
                      <ol className="list-decimal list-inside space-y-1.5 pl-0.5 text-amber-900">
                        <li>
                          Open{' '}
                          <a
                            href={consoleAuthSettingsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold underline text-amber-950 hover:text-amber-800 inline-flex items-center gap-1"
                          >
                            <span>Authentication &rarr; Settings</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </li>
                        <li>
                          Scroll down to <strong>Authorized domains</strong> and click <strong>Add domain</strong>
                        </li>
                        <li>
                          Paste <code className="bg-white px-1 py-0.5 rounded font-mono font-semibold text-amber-950">{currentHostname}</code> and click <strong>Add</strong>
                        </li>
                      </ol>
                      <p className="text-[10px] text-amber-800 italic pt-0.5">
                        * Note: Changes typically propagate within 10-15 seconds. After adding, click <strong>Google Sync</strong> below again.
                      </p>
                    </div>

                    {/* Action Links */}
                    <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                      <a
                        href={consoleAuthSettingsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-amber-900 hover:bg-amber-800 text-amber-50 rounded-lg text-xs font-medium cursor-pointer transition-colors shadow-xs"
                      >
                        <span>Open Firebase Settings</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={handleGuestMode}
                        className="w-full sm:flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 rounded-lg text-xs font-medium cursor-pointer transition-colors shadow-xs"
                      >
                        <PenLine className="w-3.5 h-3.5 text-amber-600" />
                        <span>Use Local Mode Now</span>
                      </button>
                    </div>
                  </div>
                ) : isConfigError ? (
                  <div className="mt-2 text-xs text-amber-900/90 space-y-2 leading-relaxed">
                    <p>
                      In your Firebase project (<strong className="font-mono text-[11px]">{firebaseConfig.projectId}</strong>), the Google Sign-in provider has not been turned on yet in Firebase Console.
                    </p>
                    <ol className="list-decimal list-inside space-y-1 bg-white/70 p-2.5 rounded-lg border border-amber-200/60 font-mono text-[11px] text-amber-950">
                      <li>Open <strong>console.firebase.google.com</strong></li>
                      <li>Go to <strong>Authentication &rarr; Sign-in method</strong></li>
                      <li>Click <strong>Google</strong> &rarr; toggle <strong>Enable</strong> &rarr; Save</li>
                    </ol>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={handleGuestMode}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-amber-900 hover:bg-amber-800 text-amber-50 rounded-lg text-xs font-medium cursor-pointer transition-colors shadow-xs"
                      >
                        <PenLine className="w-3.5 h-3.5 text-amber-300" />
                        <span>Continue in Local Reflection Mode (Zero Setup)</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-amber-800">{error}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center max-w-md">
          {/* Guest / Local Mode Button */}
          <button
            id="guest-start-btn"
            onClick={handleGuestMode}
            className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-5 py-3.5 bg-stone-900 hover:bg-stone-800 active:scale-[0.99] text-stone-50 rounded-xl font-medium text-sm transition-all shadow-sm cursor-pointer"
          >
            <PenLine className="w-4 h-4 text-amber-300" />
            <span>Open Reflection Journal</span>
            <ArrowRight className="w-4 h-4 ml-1 opacity-70" />
          </button>

          {/* Google Sign In Button */}
          <button
            id="google-signin-btn"
            onClick={handleSignIn}
            disabled={signingIn || loading}
            className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-4 py-3.5 bg-white hover:bg-stone-100 active:scale-[0.99] text-stone-700 border border-stone-300 rounded-xl font-medium text-sm transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {signingIn ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-stone-400 border-t-stone-800 rounded-full animate-spin" />
                Signing in...
              </span>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Google Sync</span>
              </>
            )}
          </button>
        </div>

        {/* Feature Trio */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-3xl w-full text-left">
          <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
            <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center text-stone-800 mb-3">
              <Mic className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-stone-900 mb-1">Voice & Text Multimodal</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Record voice reflections effortlessly. Gemini 3.6 Flash transcribes speech and synthesizes deep psychological takeaways in a single turn.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
            <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center text-stone-800 mb-3">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-stone-900 mb-1">Structured Insights</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Automated 1-to-10 emotional resonance scores, 1-sentence summaries, and concrete extracted action habits.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
            <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center text-stone-800 mb-3">
              <Database className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-stone-900 mb-1">Private Reflection Storage</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Full local storage persistence with isolated cloud sync when configured under <code className="text-[11px] bg-stone-100 px-1 py-0.5 rounded">/users/uid/entries</code>.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl mx-auto px-6 py-6 text-center text-xs text-stone-500 border-t border-stone-200/60 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Empathetic AI Journaling &bull; Powered by Gemini 3.6 Flash
        </span>
        <span>AI Reflection Journal &copy; 2026</span>
      </footer>
    </div>
  );
};


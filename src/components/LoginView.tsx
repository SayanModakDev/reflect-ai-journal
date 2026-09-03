import React from 'react';
import { Sparkles, ShieldCheck, Database, Mic, ArrowRight, BrainCircuit, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LoginViewProps {
  onSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess }) => {
  const { signInWithGoogle, loading, user } = useAuth();
  const [signingIn, setSigningIn] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (user) {
      onSuccess();
    }
  }, [user, onSuccess]);

  const handleSignIn = async () => {
    setError(null);
    setSigningIn(true);
    try {
      await signInWithGoogle();
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to sign in with Google. Please try again.");
    } finally {
      setSigningIn(false);
    }
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
            <Lock className="w-3.5 h-3.5 text-emerald-600" /> Isolated Firestore Single-Tenant
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

        <p className="text-base sm:text-lg text-stone-600 max-w-xl font-normal leading-relaxed mb-10">
          Transform scattered thoughts into cognitive clarity. Speak or write your daily reflections and receive structured insights, mood analytics, and actionable commitments powered by Gemini 3.6 Flash.
        </p>

        {error && (
          <div id="login-error-banner" className="mb-6 w-full max-w-md p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm text-left">
            <p className="font-medium">Authentication notice</p>
            <p className="mt-1 text-xs text-rose-700">{error}</p>
          </div>
        )}

        {/* Action Button */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center max-w-sm">
          <button
            id="google-signin-btn"
            onClick={handleSignIn}
            disabled={signingIn || loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-stone-900 hover:bg-stone-800 active:scale-[0.99] text-stone-50 rounded-xl font-medium text-sm transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {signingIn ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-stone-400 border-t-stone-100 rounded-full animate-spin" />
                Signing in with Google...
              </span>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
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
                <span>Continue with Google</span>
                <ArrowRight className="w-4 h-4 ml-1 opacity-70" />
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
            <h3 className="text-sm font-semibold text-stone-900 mb-1">Zero-Trust Isolation</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Strict document isolation under <code className="text-[11px] bg-stone-100 px-1 py-0.5 rounded">/users/uid/entries</code>. Never exposed to third parties.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl mx-auto px-6 py-6 text-center text-xs text-stone-500 border-t border-stone-200/60 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Verified ID Token Authorization via Firebase Admin SDK
        </span>
        <span>AI Reflection Journal &copy; 2026</span>
      </footer>
    </div>
  );
};

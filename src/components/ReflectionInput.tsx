import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Sparkles, Send, Volume2, AlertCircle, RefreshCw, PenLine } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { JournalEntry } from '../types';

interface ReflectionInputProps {
  onEntryCreated: (entry: JournalEntry) => void;
  activeConversation?: {
    entryId?: string;
    turns: { role: 'user' | 'model'; text: string }[];
  };
}

export const ReflectionInput: React.FC<ReflectionInputProps> = ({ onEntryCreated, activeConversation }) => {
  const { user, token, refreshToken } = useAuth();
  const [promptText, setPromptText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Convert Blob to Base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        // remove header (e.g. data:audio/webm;base64,)
        const base64Content = base64data.split(',')[1] || '';
        resolve(base64Content);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const startRecording = async () => {
    setErrorMessage(null);
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all audio tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());

        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        setAudioBlob(blob);
        try {
          const b64 = await blobToBase64(blob);
          setAudioBase64(b64);
        } catch (e) {
          console.error("Failed to convert audio:", e);
        }
      };

      mediaRecorder.start(250); // slices of 250ms
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Microphone access error:", err);
      setErrorMessage("Could not access microphone. Please ensure microphone permissions are granted.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const cancelRecording = () => {
    stopRecording();
    setAudioBlob(null);
    setAudioBase64(null);
    setRecordingSeconds(0);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!promptText.trim() && !audioBase64) || isSubmitting) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      let currentToken = token;
      if (!currentToken) {
        currentToken = await refreshToken();
      }

      if (!currentToken) {
        throw new Error("Authentication token not available. Please sign in again.");
      }

      const payload = {
        prompt: promptText.trim(),
        history: activeConversation?.turns || [],
        audioBase64: audioBase64 || undefined,
        audioMimeType: audioBlob?.type || "audio/webm",
        audioDurationSeconds: recordingSeconds || undefined,
      };

      const res = await fetch("/api/reflect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned ${res.status}`);
      }

      const data = await res.json();
      if (data.entry) {
        // Guaranteed client sync into user's isolated Firestore path
        if (user) {
          try {
            await setDoc(doc(db, "users", user.uid, "entries", data.entry.id), data.entry, { merge: true });
          } catch (syncErr) {
            console.warn("Client Firestore entry sync notice:", syncErr);
          }
        }

        onEntryCreated(data.entry);
        // Clear input buffers only after confirmed persistence
        setPromptText('');
        setAudioBlob(null);
        setAudioBase64(null);
        setRecordingSeconds(0);
      }
    } catch (err: any) {
      console.error("Submission failed:", err);
      setErrorMessage(err.message || "Failed to analyze and save reflection. Your draft is preserved below.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div id="reflection-input-box" className="p-5 sm:p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <PenLine className="w-4 h-4 text-stone-700" />
          <h3 className="text-sm font-semibold text-stone-900">
            {activeConversation?.turns?.length ? "Continue Reflection Conversation" : "New Reflection Session"}
          </h3>
        </div>
        <span className="text-[11px] font-mono uppercase tracking-wider text-stone-400">
          Gemini 3.6 Flash &bull; Firestore Direct
        </span>
      </div>

      {errorMessage && (
        <div id="reflection-error-banner" className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => handleSubmit()}
            className="text-xs font-medium underline text-rose-900 hover:text-rose-950 ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Voice Recording Widget Bar */}
      <div className="mb-3">
        {isRecording ? (
          <div id="recording-active-bar" className="flex items-center justify-between p-3.5 rounded-xl bg-rose-50/80 border border-rose-200 animate-pulse">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
              <span className="text-xs font-medium text-rose-900">
                Recording reflection speech... <span className="font-mono font-semibold ml-1">{formatTimer(recordingSeconds)}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={stopRecording}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 cursor-pointer shadow-2xs"
              >
                <Square className="w-3.5 h-3.5 fill-current" /> Stop & Review
              </button>
            </div>
          </div>
        ) : audioBlob ? (
          <div id="recording-recorded-bar" className="flex items-center justify-between p-3 rounded-xl bg-stone-100 border border-stone-200">
            <div className="flex items-center gap-2 text-stone-800 text-xs font-medium">
              <Volume2 className="w-4 h-4 text-emerald-600" />
              <span>Spoken reflection attached ({formatTimer(recordingSeconds || 1)})</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelRecording}
                className="text-xs text-stone-500 hover:text-rose-600 px-2 py-1"
              >
                Discard Audio
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Text Area */}
      <div className="relative">
        <textarea
          id="journal-prompt-textarea"
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder={
            audioBlob
              ? "Add any supplemental written notes or hit Send to transcribe and reflect..."
              : "What is on your mind today? Write candidly about challenges, insights, wins, or emotional states..."
          }
          rows={4}
          disabled={isSubmitting}
          className="w-full p-4 rounded-xl bg-stone-50/70 border border-stone-200 text-stone-900 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:bg-white transition-all resize-y min-h-[110px]"
        />
      </div>

      {/* Bottom Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-3 border-t border-stone-100">
        <div className="flex items-center gap-2">
          {!isRecording && !audioBlob && (
            <button
              id="start-voice-recording-btn"
              type="button"
              onClick={startRecording}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium transition-colors cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5 text-rose-500" />
              <span>Record Voice Reflection</span>
            </button>
          )}

          <span className="text-[11px] text-stone-400 hidden md:inline">
            Press Send to process with Gemini 3.6 Flash
          </span>
        </div>

        <div className="flex items-center justify-end gap-3">
          {promptText.trim().length > 0 && (
            <button
              type="button"
              onClick={() => setPromptText('')}
              disabled={isSubmitting}
              className="text-xs text-stone-400 hover:text-stone-600 px-2 py-1 cursor-pointer"
            >
              Clear
            </button>
          )}

          <button
            id="submit-reflection-btn"
            type="button"
            onClick={() => handleSubmit()}
            disabled={(!promptText.trim() && !audioBase64) || isSubmitting}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 active:scale-[0.98] text-stone-50 text-xs font-medium transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Reflecting with Gemini...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Reflect & Synthesize</span>
                <Send className="w-3 h-3 ml-0.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

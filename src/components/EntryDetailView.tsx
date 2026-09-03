import React, { useState } from 'react';
import { Sparkles, Calendar, CheckSquare, MessageSquare, Shield, Volume2, User, Send, ArrowLeft, Trash2 } from 'lucide-react';
import { JournalEntry, ConversationTurn } from '../types';
import { useAuth } from '../context/AuthContext';

interface EntryDetailViewProps {
  entry: JournalEntry;
  onBackToNew: () => void;
  onUpdateEntry?: (updated: JournalEntry) => void;
  onDeleteEntry?: (id: string) => void;
}

export const EntryDetailView: React.FC<EntryDetailViewProps> = ({ entry, onBackToNew, onUpdateEntry, onDeleteEntry }) => {
  const { token, refreshToken } = useAuth();
  const [followUpText, setFollowUpText] = useState('');
  const [isSendingFollowUp, setIsSendingFollowUp] = useState(false);
  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>([
    { role: 'user', text: entry.prompt, createdAt: entry.createdAt },
    { role: 'model', text: entry.response, createdAt: entry.createdAt },
  ]);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  const handleSendFollowUp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!followUpText.trim() || isSendingFollowUp) return;

    setFollowUpError(null);
    setIsSendingFollowUp(true);

    const userPrompt = followUpText.trim();
    const updatedHistory = [...conversationTurns, { role: 'user' as const, text: userPrompt }];
    setConversationTurns(updatedHistory);
    setFollowUpText('');

    try {
      let currentToken = token;
      if (!currentToken) {
        currentToken = await refreshToken();
      }

      const res = await fetch("/api/reflect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({
          prompt: userPrompt,
          history: updatedHistory,
          title: `Follow-up on: ${entry.title}`,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to continue reflection conversation");
      }

      const data = await res.json();
      if (data.insights) {
        setConversationTurns((prev) => [
          ...prev,
          { role: 'model', text: data.insights.reflectionResponse, createdAt: new Date().toISOString() }
        ]);

        if (onUpdateEntry && data.entry) {
          onUpdateEntry(data.entry);
        }
      }
    } catch (err: any) {
      console.error(err);
      setFollowUpError(err.message || "Failed to process reply");
    } finally {
      setIsSendingFollowUp(false);
    }
  };

  const getMoodBadge = (score: number) => {
    let color = "bg-amber-100 text-amber-900 border-amber-300";
    if (score >= 8) color = "bg-emerald-100 text-emerald-900 border-emerald-300";
    if (score <= 4) color = "bg-rose-100 text-rose-900 border-rose-300";

    return (
      <span className={`inline-flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded-full border ${color}`}>
        Mood Score: {score}/10
      </span>
    );
  };

  return (
    <div id="entry-detail-view" className="space-y-6">
      {/* Top action header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={onBackToNew}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to New Reflection
          </button>

          {onDeleteEntry && (
            <button
              id="delete-detail-entry-btn"
              type="button"
              onClick={() => onDeleteEntry(entry.id)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200/70 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              title="Delete this reflection"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Reflection</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {entry.isAudio && (
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 font-medium">
              <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
              Spoken Reflection
            </span>
          )}
          {getMoodBadge(entry.moodScore || 5)}
        </div>
      </div>

      {/* Structured Insights Card */}
      <div id="structured-insights-card" className="p-5 sm:p-6 rounded-2xl bg-white border border-stone-200/80 shadow-xs space-y-4">
        <div className="border-b border-stone-100 pb-4">
          <div className="flex items-center gap-2 text-[11px] text-stone-400 font-mono mb-1">
            <Calendar className="w-3 h-3" />
            {new Date(entry.createdAt).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <h2 className="text-2xl font-serif text-stone-900 font-normal tracking-tight">
            {entry.title || "Reflection"}
          </h2>
        </div>

        {/* 1-Sentence Summary Banner */}
        <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/60">
          <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-amber-800 block mb-1">
            Executive Cognitive Summary
          </span>
          <p className="text-sm font-medium text-amber-950 leading-relaxed">
            &ldquo;{entry.summary}&rdquo;
          </p>
        </div>

        {/* Action Items extracted */}
        {entry.actionItems && entry.actionItems.length > 0 && (
          <div className="space-y-2 pt-2">
            <span className="text-[11px] uppercase font-mono tracking-wider text-stone-500 font-medium flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-stone-600" />
              Extracted Action Items & Commitments
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {entry.actionItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2.5 rounded-xl bg-stone-50 border border-stone-200/60 text-xs text-stone-800"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-500 mt-1.5 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Multi-Turn Dialogue Stream */}
      <div id="dialogue-turns-container" className="space-y-4">
        <h3 className="text-xs font-mono uppercase tracking-wider text-stone-500 px-1 flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5" />
          Reflective Conversation Stream
        </h3>

        {conversationTurns.map((turn, i) => {
          const isUser = turn.role === 'user';
          return (
            <div
              key={i}
              className={`p-5 rounded-2xl border transition-all ${
                isUser
                  ? "bg-white border-stone-200 ml-0 md:ml-8"
                  : "bg-stone-50/90 border-stone-200/90 mr-0 md:mr-8"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-medium ${
                    isUser ? "bg-stone-900 text-stone-50" : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {isUser ? <User className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5 text-amber-600" />}
                </div>
                <span className="text-xs font-semibold text-stone-900">
                  {isUser ? "Your Reflection" : "Gemini 3.6 Flash"}
                </span>
              </div>

              <div className="text-sm text-stone-800 leading-relaxed whitespace-pre-line">
                {turn.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* Follow-up reply box */}
      <div id="followup-reply-card" className="p-4 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
        {followUpError && (
          <div className="mb-3 p-3 rounded-lg bg-rose-50 text-rose-800 text-xs">{followUpError}</div>
        )}

        <form onSubmit={handleSendFollowUp} className="flex gap-2">
          <input
            type="text"
            value={followUpText}
            onChange={(e) => setFollowUpText(e.target.value)}
            disabled={isSendingFollowUp}
            placeholder="Explore deeper: 'How can I reframe this doubt?' or 'What habit should I start?'..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:bg-white"
          />
          <button
            type="submit"
            disabled={!followUpText.trim() || isSendingFollowUp}
            className="px-4 py-2.5 rounded-xl bg-stone-900 text-stone-50 text-xs font-medium hover:bg-stone-800 disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
          >
            {isSendingFollowUp ? (
              <span className="w-4 h-4 border-2 border-stone-400 border-t-stone-100 rounded-full animate-spin" />
            ) : (
              <>
                <span>Reply</span>
                <Send className="w-3 h-3" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

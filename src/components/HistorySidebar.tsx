import React from 'react';
import { Search, Plus, Calendar, Volume2, Trash2, BookOpen, RefreshCw, X } from 'lucide-react';
import { JournalEntry } from '../types';

interface HistorySidebarProps {
  entries: JournalEntry[];
  selectedEntryId: string | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onNewSession: () => void;
  onDeleteEntry: (id: string) => void;
  onSync?: () => void;
  isSyncing?: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  entries,
  selectedEntryId,
  onSelectEntry,
  onNewSession,
  onDeleteEntry,
  onSync,
  isSyncing = false,
  searchQuery,
  onSearchChange,
}) => {
  // Filter entries
  const filtered = entries.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title?.toLowerCase().includes(q) ||
      item.summary?.toLowerCase().includes(q) ||
      item.prompt?.toLowerCase().includes(q) ||
      item.response?.toLowerCase().includes(q) ||
      item.actionItems?.some((act) => act.toLowerCase().includes(q))
    );
  });

  const getScoreBadgeColor = (score: number) => {
    if (score >= 8) return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (score <= 4) return "bg-rose-100 text-rose-800 border-rose-200";
    return "bg-amber-100 text-amber-800 border-amber-200";
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "Recent";
    }
  };

  return (
    <aside id="history-sidebar" className="w-full md:w-80 lg:w-96 flex flex-col bg-stone-100/70 border-r border-stone-200/80 shrink-0 h-full">
      {/* Top Header & New Entry */}
      <div className="p-4 border-b border-stone-200/80 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-stone-700" />
            <h2 className="text-sm font-semibold text-stone-900 tracking-tight">Reflections Archive</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full border border-stone-200/60">
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            </span>
            {onSync && (
              <button
                id="sidebar-sync-btn"
                type="button"
                onClick={onSync}
                disabled={isSyncing}
                title="Sync with Cloud Firestore"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-600 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 border border-stone-200 px-2 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-amber-600' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
              </button>
            )}
          </div>
        </div>

        <button
          id="new-session-sidebar-btn"
          type="button"
          onClick={onNewSession}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 active:scale-[0.99] text-stone-50 text-xs font-medium transition-all shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4 text-amber-300" />
          <span>Start New Reflection</span>
        </button>

        {/* Search input */}
        <div className="relative mt-3">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            id="history-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search reflections, insights, actions..."
            className="w-full pl-9 pr-8 py-1.5 rounded-lg bg-stone-50 border border-stone-200 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Entry List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-stone-500 space-y-2">
            <p>{searchQuery ? "No reflections match your search." : "No saved reflections yet. Record your first reflection above!"}</p>
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="text-stone-800 font-medium underline cursor-pointer"
              >
                Clear search filter
              </button>
            )}
            {!searchQuery && onSync && (
              <button
                onClick={onSync}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer mt-2"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Sync from Cloud</span>
              </button>
            )}
          </div>
        ) : (
          filtered.map((item) => {
            const isSelected = item.id === selectedEntryId;
            return (
              <div
                key={item.id}
                id={`entry-item-${item.id}`}
                onClick={() => onSelectEntry(item)}
                className={`group relative p-3.5 rounded-xl transition-all border cursor-pointer ${
                  isSelected
                    ? "bg-white border-stone-400 shadow-xs ring-1 ring-stone-400"
                    : "bg-white/80 hover:bg-white border-stone-200/80 hover:border-stone-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <h4 className="text-xs font-semibold text-stone-900 line-clamp-1 group-hover:text-stone-950">
                    {item.title || "Untitled Reflection"}
                  </h4>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${getScoreBadgeColor(
                      item.moodScore || 5
                    )}`}
                  >
                    Mood {item.moodScore || 5}/10
                  </span>
                </div>

                <p className="text-[11px] text-stone-600 line-clamp-2 leading-relaxed mb-2">
                  {item.summary || item.prompt}
                </p>

                <div className="flex items-center justify-between text-[10px] text-stone-400 pt-1 border-t border-stone-100">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(item.createdAt)}
                  </span>

                  <div className="flex items-center gap-2">
                    {item.isAudio && (
                      <span className="flex items-center gap-0.5 text-stone-500 font-medium">
                        <Volume2 className="w-3 h-3 text-emerald-600" />
                        Voice
                      </span>
                    )}

                    <button
                      id={`delete-entry-btn-${item.id}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteEntry(item.id);
                      }}
                      title="Delete reflection"
                      aria-label={`Delete ${item.title || 'reflection'}`}
                      className="p-1 rounded-md text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};

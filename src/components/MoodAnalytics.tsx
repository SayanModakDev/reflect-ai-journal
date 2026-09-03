import React from 'react';
import { TrendingUp, Activity, Smile, Frown, Meh, Sparkles } from 'lucide-react';
import { JournalEntry } from '../types';

interface MoodAnalyticsProps {
  entries: JournalEntry[];
}

export const MoodAnalytics: React.FC<MoodAnalyticsProps> = ({ entries }) => {
  // Sort ascending by creation date to get chronological trend of last 7 entries
  const last7 = [...entries]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-7);

  if (last7.length === 0) {
    return (
      <div id="mood-analytics-empty" className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center text-stone-600">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-stone-900">7-Entry Emotional Pulse</h4>
            <p className="text-xs text-stone-500">Record your first reflection to start plotting your sentiment trendline.</p>
          </div>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-stone-100 text-stone-600">
          No entries yet
        </span>
      </div>
    );
  }

  const averageScore = Number(
    (last7.reduce((acc, curr) => acc + (curr.moodScore || 5), 0) / last7.length).toFixed(1)
  );

  const getMoodEmoji = (score: number) => {
    if (score >= 8) return <Smile className="w-4 h-4 text-emerald-600" />;
    if (score <= 4) return <Frown className="w-4 h-4 text-rose-500" />;
    return <Meh className="w-4 h-4 text-amber-600" />;
  };

  const getMoodLabel = (score: number) => {
    if (score >= 8) return "Empowered & Clear";
    if (score >= 6) return "Balanced & Steady";
    if (score >= 4) return "Contemplative";
    return "Strained / Seeking Clarity";
  };

  // SVG dimensions for trendline
  const width = 280;
  const height = 50;
  const paddingX = 15;
  const paddingY = 8;

  const points = last7.map((entry, index) => {
    const x =
      last7.length === 1
        ? width / 2
        : paddingX + (index / (last7.length - 1)) * (width - 2 * paddingX);
    // score 1 to 10 mapped to height - paddingY to paddingY
    const score = entry.moodScore || 5;
    const y = height - paddingY - ((score - 1) / 9) * (height - 2 * paddingY);
    return { x, y, score, date: new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }) };
  });

  const pathString =
    points.length > 1
      ? points.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '')
      : '';

  return (
    <div id="mood-analytics-widget" className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-800">
          <TrendingUp className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-stone-900">7-Day Emotional Trajectory</h4>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
              {getMoodEmoji(averageScore)}
              Avg {averageScore} / 10
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            {getMoodLabel(averageScore)} &bull; Based on {last7.length} recent {last7.length === 1 ? 'reflection' : 'reflections'}
          </p>
        </div>
      </div>

      {/* Lightweight SVG Sparkline Trend */}
      <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
        <div className="relative">
          <svg width={width} height={height} className="overflow-visible">
            {/* Horizontal guideline */}
            <line
              x1={paddingX}
              y1={height / 2}
              x2={width - paddingX}
              y2={height / 2}
              stroke="#E7E5E4"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            {/* Sparkline */}
            {points.length > 1 && (
              <path
                d={pathString}
                fill="none"
                stroke="#44403C"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {/* Data points */}
            {points.map((pt, i) => (
              <g key={i} className="group">
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="4"
                  fill="#FFFFFF"
                  stroke="#1C1917"
                  strokeWidth="2"
                  className="transition-transform group-hover:scale-125"
                />
              </g>
            ))}
          </svg>
          <div className="flex justify-between text-[10px] text-stone-400 mt-1 px-1">
            <span>{points[0]?.date}</span>
            <span>{points[points.length - 1]?.date}</span>
          </div>
        </div>

        <div className="hidden lg:flex flex-col items-end border-l border-stone-100 pl-4">
          <span className="text-[10px] uppercase font-mono tracking-wider text-stone-400">Latest Pulse</span>
          <span className="text-lg font-serif font-semibold text-stone-900 flex items-center gap-1">
            {last7[last7.length - 1]?.moodScore || 7}
            <span className="text-xs font-sans text-stone-400 font-normal">/10</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  prompt: string; // The user prompt / input reflection
  response: string; // The AI's reflective coaching response
  summary: string; // 1-sentence recap
  moodScore: number; // 1 to 10
  actionItems: string[]; // commitments or habits extracted
  isAudio?: boolean; // if entry originated from voice reflection
  audioDurationSeconds?: number;
  tags?: string[];
  createdAt: string; // ISO string
  updatedAt: string;
}

export interface ConversationTurn {
  role: 'user' | 'model';
  text: string;
  createdAt?: string;
}

export interface ReflectionAnalysisResponse {
  reflectionResponse: string;
  summary: string;
  moodScore: number;
  actionItems: string[];
  transcription?: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

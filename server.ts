import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { generateContentWithFallback } from "./server/gemini";
import { verifyAuthToken, getFirebaseAdmin } from "./server/firebaseAdmin";

dotenv.config();

const PORT = 3000;

function stripUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_, v) => (v === undefined ? null : v)));
}

async function startServer() {
  const app = express();

  // Top-Level Request Deserialization (Ordering Guarantee)
  // Large limit to accept multimodal voice recordings (e.g. 20MB)
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "AI Reflection Journal" });
  });

  // Auth check helper
  app.get("/api/auth/me", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await verifyAuthToken(authHeader);
      res.json({ status: "authenticated", user });
    } catch (err: any) {
      res.status(401).json({ error: err.message || "Unauthorized" });
    }
  });

  // GET /api/entries - Fetch user's reflection entries
  app.get("/api/entries", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await verifyAuthToken(authHeader);

      let entries: any[] = [];
      let serverDbConnected = true;
      try {
        const { db } = getFirebaseAdmin();
        const entriesRef = db.collection("users").doc(user.uid).collection("entries");
        const snapshot = await entriesRef.orderBy("createdAt", "desc").limit(100).get();

        entries = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));
      } catch (dbErr: any) {
        console.warn("Server Firestore admin read unavailable in current environment (client sync will handle):", dbErr.message);
        serverDbConnected = false;
      }

      res.json({ entries, serverDbConnected });
    } catch (err: any) {
      console.error("Failed to fetch entries:", err);
      const isAuthError = err.message?.includes("Unauthorized");
      res.status(isAuthError ? 401 : 500).json({ error: err.message || "Failed to fetch journal entries" });
    }
  });

  // POST /api/reflect - Process journal reflection with Gemini 3.6 Flash & persist to Firestore
  app.post("/api/reflect", async (req, res) => {
    try {
      // 1. Auth check
      const authHeader = req.headers.authorization;
      const user = await verifyAuthToken(authHeader);

      // 2. Defensive Payload Ingestion (Null-Safe Destructuring)
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
      const conversationHistory = Array.isArray(body.history) ? body.history : [];
      const audioBase64 = typeof body.audioBase64 === "string" ? body.audioBase64 : null;
      const audioMimeType = typeof body.audioMimeType === "string" ? body.audioMimeType : "audio/webm";
      const audioDurationSeconds = typeof body.audioDurationSeconds === "number" ? body.audioDurationSeconds : 0;
      const customTitle = typeof body.title === "string" ? body.title.trim() : "";

      if (!prompt && !audioBase64) {
        return res.status(400).json({ error: "Reflection prompt or voice recording is required." });
      }

      // 3. Prepare Prompt for Gemini 3.6 Flash
      const systemInstruction = `You are a thoughtful, compassionate, and psychologically astute reflective journaling coach and cognitive guide.
Your purpose is to deeply analyze the user's personal reflection or journal entry, validate their emotional reality, provide constructive cognitive reframing or supportive inquiry, and extract structured metadata.

Analyze the reflection thoroughly:
1. Provide an empathetic, authentic, and insightful 'reflectionResponse' (2 to 4 supportive paragraphs).
2. 'summary': A concise 1-sentence recap of what the user is experiencing or contemplating.
3. 'moodScore': An integer from 1 to 10 (1 = deeply distressed/hopeless, 5 = neutral/contemplative, 10 = euphoric/highly empowered).
4. 'actionItems': An array of strings with explicit or implicit habits, commitments, next steps, or self-care reminders extracted from their words.
5. If an audio recording was provided, also include 'transcription' accurately capturing their spoken reflection.

Format your entire response strictly as valid JSON with this exact structure:
{
  "reflectionResponse": "string",
  "summary": "string",
  "moodScore": 7,
  "actionItems": ["string"],
  "transcription": "string or null"
}`;

      // Build multimodal or text contents
      const contents: any[] = [];

      // Add conversation context if multi-turn
      for (const turn of conversationHistory.slice(-6)) {
        if (turn && turn.text) {
          contents.push({
            role: turn.role === "model" ? "model" : "user",
            parts: [{ text: turn.text }]
          });
        }
      }

      const userParts: any[] = [];
      if (audioBase64) {
        userParts.push({
          inlineData: {
            mimeType: audioMimeType,
            data: audioBase64
          }
        });
        userParts.push({
          text: prompt 
            ? `Here is my spoken audio reflection along with my written note: "${prompt}". Please transcribe my spoken words into the 'transcription' field, give me a warm reflection response, and provide the structured summary, moodScore, and actionItems.`
            : `Here is my spoken audio reflection. Please accurately transcribe my spoken words into the 'transcription' field, give me a warm reflective coaching response, and provide the structured summary, moodScore, and actionItems.`
        });
      } else {
        userParts.push({
          text: prompt
        });
      }

      contents.push({
        role: "user",
        parts: userParts
      });

      // 4. Call Gemini 3.6 Flash using Resilient Fallback Ladder
      const { text: rawJson, usedModel } = await generateContentWithFallback({
        contents,
        systemInstruction,
        responseMimeType: "application/json"
      });

      let parsed: any;
      try {
        parsed = JSON.parse(rawJson);
      } catch (e) {
        // Fallback cleanup if model wrapped in markdown
        const cleaned = rawJson.replace(/```json/g, "").replace(/```/g, "").trim();
        parsed = JSON.parse(cleaned);
      }

      const reflectionResponse = parsed.reflectionResponse || "Thank you for sharing your thoughts today.";
      const summary = parsed.summary || (prompt.slice(0, 80) + "...");
      const moodScore = typeof parsed.moodScore === "number" ? Math.max(1, Math.min(10, parsed.moodScore)) : 7;
      const actionItems = Array.isArray(parsed.actionItems) ? parsed.actionItems : [];
      const transcription = parsed.transcription || (audioBase64 ? "Audio reflection transcribed." : null);

      // Determine clean entry title
      const now = new Date();
      const defaultTitle = customTitle || summary.split(".")[0]?.slice(0, 50) || `Reflection on ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

      // 5. Server-Side Firestore Persistence
      let serverPersisted = false;
      let entryId = `entry_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      try {
        const { db } = getFirebaseAdmin();
        const entriesRef = db.collection("users").doc(user.uid).collection("entries");
        const newEntryDoc = entriesRef.doc();
        entryId = newEntryDoc.id;

        const entryData = stripUndefined({
          id: entryId,
          userId: user.uid,
          title: defaultTitle,
          prompt: prompt || transcription || "Voice Reflection",
          response: reflectionResponse,
          summary,
          moodScore,
          actionItems,
          isAudio: !!audioBase64,
          audioDurationSeconds: audioDurationSeconds || undefined,
          transcription: transcription || undefined,
          usedModel,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        });

        await newEntryDoc.set(entryData);
        serverPersisted = true;

        // Also ensure /users/{uid} document exists for telemetry/profile
        await db.collection("users").doc(user.uid).set(
          stripUndefined({
            lastActiveAt: now.toISOString(),
            email: user.email || null,
            displayName: user.name || null
          }),
          { merge: true }
        );
      } catch (dbErr: any) {
        console.warn("Server-side Firestore persistence note (client sync will persist):", dbErr.message);
      }

      const finalEntry = stripUndefined({
        id: entryId,
        userId: user.uid,
        title: defaultTitle,
        prompt: prompt || transcription || "Voice Reflection",
        response: reflectionResponse,
        summary,
        moodScore,
        actionItems,
        isAudio: !!audioBase64,
        audioDurationSeconds: audioDurationSeconds || undefined,
        transcription: transcription || undefined,
        usedModel,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      });

      res.json({
        success: true,
        entry: finalEntry,
        serverPersisted,
        insights: {
          reflectionResponse,
          summary,
          moodScore,
          actionItems,
          transcription,
          usedModel
        }
      });
    } catch (err: any) {
      console.error("Error processing reflection:", err);
      const isAuthError = err.message?.includes("Unauthorized");
      res.status(isAuthError ? 401 : 500).json({
        error: err.message || "Failed to process reflection and persist to Firestore"
      });
    }
  });

  // DELETE /api/entries/:id - Delete an entry (Owner bound)
  app.delete("/api/entries/:id", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const user = await verifyAuthToken(authHeader);
      const entryId = req.params.id;

      if (!entryId) {
        return res.status(400).json({ error: "Entry ID required" });
      }

      try {
        const { db } = getFirebaseAdmin();
        const docRef = db.collection("users").doc(user.uid).collection("entries").doc(entryId);
        await docRef.delete();
      } catch (dbErr: any) {
        console.warn("Server Firestore admin delete note:", dbErr.message);
      }

      res.json({ success: true, id: entryId });
    } catch (err: any) {
      console.error("Failed to delete entry:", err);
      const isAuthError = err.message?.includes("Unauthorized");
      res.status(isAuthError ? 401 : 500).json({ error: err.message || "Failed to delete entry" });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

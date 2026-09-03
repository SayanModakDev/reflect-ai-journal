# AI Reflection Journal & Cognitive Insight Architecture

A secure, user-authenticated AI journaling and reflective coaching web application built with **Google Gemini 3.6 Flash (`gemini-3.6-flash`)**, **Firebase Authentication (Google Sign-In only)**, and **Cloud Firestore** enforcing strict single-tenant path isolation (`/users/{uid}/entries/{entryId}`).

---

## 1. Environment & Prerequisites

Ensure you have the following tools and services configured:
- **Google Cloud SDK (`gcloud` CLI)**: Installed and authenticated (`gcloud auth login`).
- **Google Cloud Project**: With billing enabled.
- **Node.js 20+ & npm / bun**: For local builds and development.

### Enable Required Google Cloud APIs
Run the following commands to enable the necessary APIs for Cloud Run, Firestore, Secret Manager, and Generative Language:

```bash
# Enable required Google Cloud services
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  generativelanguage.googleapis.com \
  --project="YOUR_PROJECT_ID"
```

---

## 2. Secret Management Setup

The application strictly prevents API keys and credentials from reaching the browser client. All generative AI requests and token verification are handled server-side.

### Create and Populate Secrets
```bash
# 1. Create and populate GEMINI_API_KEY
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic" --project="YOUR_PROJECT_ID"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=- --project="YOUR_PROJECT_ID"

# 2. Grant the Cloud Run service account access to read the secret
# Retrieve your project number
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)')

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project="YOUR_PROJECT_ID"
```

---

## 3. Database Security Configuration (Cloud Firestore)

The application enforces zero-insecure defaults. Only authenticated users can access documents explicitly scoped to their own `uid`.

### Firestore Security Rules (`firestore.rules`)
Deploy the following security rules using the Firebase CLI (`firebase deploy --only firestore:rules`) or Google Cloud Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 4. Cloud Run Deployment Flow

Deploy the full-stack container directly using `gcloud run deploy`:

```bash
gcloud run deploy ai-reflection-journal \
  --source . \
  --region="us-central1" \
  --platform="managed" \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --set-env-vars="NODE_ENV=production,FIREBASE_PROJECT_ID=YOUR_PROJECT_ID" \
  --port=3000 \
  --project="YOUR_PROJECT_ID"
```

### Required Campaign Verification Labeling
Register your service for automated challenge verification by applying the required resource label:

```bash
gcloud run services update ai-reflection-journal \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region="us-central1" \
  --project="YOUR_PROJECT_ID"
```

---

## 5. Architectural Highlights & Security Assurances

1. **Authentication Architecture**:
   - Federated Google Sign-In via Firebase Auth.
   - Client sends Firebase ID token in `Authorization: Bearer <token>` headers.
   - Server decodes and verifies tokens via `firebase-admin/auth` (`verifyIdToken`).
   - Unauthenticated visitors to `/dashboard` are immediately redirected to `/login`.

2. **Gemini 3.6 Flash Multi-Turn & Multimodal Pipeline**:
   - Text & Voice reflections supported via browser MediaRecorder.
   - Structured JSON response containing:
     - `reflectionResponse`: Empathetic cognitive guidance.
     - `summary`: Concise 1-sentence recap.
     - `moodScore`: Integer from 1 to 10.
     - `actionItems`: Extracted commitments and habits.
     - `transcription`: Spoken speech transcription for audio reflections.
   - **Resilient Fallback Ladder**: `gemini-3.6-flash` &rarr; `gemini-3.1-flash-lite` &rarr; `gemini-flash-latest` &rarr; `gemini-3.7-flash`.

3. **Mood Analytics Widget**:
   - Chronological SVG trendline plotting the user's emotional sentiment across their last 7 entries.

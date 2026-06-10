# Splitsy Deployment & Firebase Setup Guide

This guide details the steps to verify the Progressive Web App (PWA) build, configure environment settings, and deploy the application to Google Firebase.

---

## 📦 PWA Build Verification

To verify that the application compiles correctly:

1. **Build the Production Bundle**:
   Ensure Node.js and dependencies are installed, then run:
   ```bash
   eval "$(fnm env)"
   npm run build
   ```
   * This generates the static assets inside the `dist/` directory.
   * It compiles all TypeScript modules and generates the PWA Service Worker (`dist/sw.js`) containing the offline-precached assets.

2. **Verify Configuration Files**:
   * **`firebase.json`**: Configures the SPA routing rewrites and cache headers.
   * **`firestore.rules`**: Contains security rules ensuring database paths (groups, bills, settlements) are only accessible by authenticated group members.

---

## ☁️ Step-by-Step: Connecting Firebase Cloud Sync

To transition Splitsy from local database storage (IndexedDB) to shared real-time database sync:

### Step 1: Create a Firebase Project
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add Project** and name the project (e.g., `splitsy-app`).

### Step 2: Configure Services on the Console
1. **Enable Authentication**:
   * Go to **Product categories** -> **Security** -> **Authentication** in the left sidebar.
   * Click **Get Started**, select the **Sign-in method** tab, click **Email/Password**, and toggle it to **Enabled**.
2. **Create Firestore Database**:
   * Go to **Product categories** -> **Databases & Storage** -> **Firestore Database** in the left sidebar.
   * Click **Create Database**.
   * Select a region close to your target users and start in **Production Mode**.

### Step 3: Register Web App
1. On the project homepage, click the Web icon (`</>`) to add an app.
2. Provide a name and register the app.
3. Copy the generated Firebase configuration object (containing variables like `apiKey`, `authDomain`, etc.).

### Step 4: Set Up Local Environment Variables
Create or edit the `.env` file in the root of the project to enable Firebase Mode:

```env
# Enable Firebase sync provider
VITE_BACKEND_PROVIDER=firebase

# Firebase Credentials
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

---

## 🌐 Deploying to Firebase Hosting

To host the application online:

1. **Log in to the Firebase CLI**:
   ```bash
   eval "$(fnm env)"
   npx -y firebase-tools@latest login
   ```

2. **Select the Project Context**:
   Add the project context to your local repository directory:
   ```bash
   npx -y firebase-tools@latest use --add
   ```
   Select the project ID created in Step 1.

3. **Deploy Web App & Rules**:
   Build the production assets and deploy them to Firebase:
   ```bash
   npm run build
   npx -y firebase-tools@latest deploy
   ```

Upon completion, the CLI will output a **Hosting URL** (e.g., `https://splitsy-xxxx.web.app`). Open this link on a mobile device to install it directly as a PWA.

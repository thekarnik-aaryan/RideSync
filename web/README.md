# RideSync 🚗💨

**RideSync** keeps your whole convoy on the same road — live group map, group chat, a shared photo drive, split expenses and a one-tap SOS. Built as a pure HTML/CSS/JS frontend backed by **Firebase** (Spark free tier).

## ✨ Features

- **Landing page** — animated hero, app mockup, features, safety showcase, testimonials, FAQ
- **Auth** — email/password sign-up & login + Google OAuth (Firebase Auth)
- **Groups** — create with an invite code, join with a code, member management, roles & settings
- **Live map** — real-time member positions (MapLibre by default, Google Maps when configured), "Go live" sharing, satellite view
- **Navigation** — plan a route with directions & ETA
- **Group chat** — threaded, per-group, live
- **Photo drive** — shared album with uploads (photos & videos via Cloudinary)
- **Expenses** — trip ledger with splits & per-person totals
- **SOS / Emergency** — hold-to-alert, alert history, emergency contacts

## 🧰 Tech

- Vanilla HTML5 / CSS3 / JavaScript (no build step)
- [Firebase JS SDK (compat, v10)](https://firebase.google.com/docs/web/setup) — auth + Firestore
- [Cloudinary](https://cloudinary.com) — free photo/video upload & delivery (no billing card needed)
- [MapLibre GL](https://maplibre.org/maplibre-gl-js/docs/) — keyless map rendering
- Font Awesome + Google Fonts (Sora / Inter)

## 🚀 Getting started

### 1. Try the demo (no backend required)

Open any page — the app runs in **demo mode** and seeds a sample convoy into `localStorage`. On the login page, tap **"Explore the live demo"**.

### 2. Create the free Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and sign in with your Google account (free).
2. **Add project** → name it `RideSync` (or anything) → continue (Google Analytics optional, can skip).
3. Click the **</>** (Web) icon to register your app, name it `web`, and click **Register app**.
4. Firebase shows your config (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId). Copy it into `assets/js/config.js` under `FIREBASE_CONFIG`.
5. In the left menu:
   - **Authentication → Get started → Sign-in method → Email/Password → Enable → Save.** Enable **Google** too (then click Google → Web SDK → enable).
   - **Build → Firestore Database → Create database** → pick a region (e.g. `asia-south1`) → **Start in production mode**.
   - **Realtime Database** and **Storage** are NOT required — media uses Cloudinary instead (free Spark stays free, no card needed).

### 2b. Set up Cloudinary for the photo drive

1. Sign up free at [cloudinary.com](https://cloudinary.com) (no billing card).
2. In the Dashboard, copy your **Cloud name**.
3. Go to **Settings → Upload** → scroll to *Upload presets* → **Add upload preset**:
   - Mode: **Unsigned**
   - Signing mode: **Unsigned**
   - (Optional) set a folder, e.g. `ridesync`
   - **Save**, then copy the preset **Name**.
4. Put both into `assets/js/config.js` under `CLOUDINARY` (`cloudName`, `uploadPreset`).

### 3. Apply security rules

Paste the rules from [`firebase/firestore.rules`](firebase/firestore.rules) into **Firestore → Rules → Publish**.
(Storage rules are unused — there is no Firebase Storage bucket in this setup.)

### 4. Serve the app

```
npx serve .
# or: python -m http.server
```

Open `http://localhost:3000`. Sign up, create a group, and you're live.

> Note: the app keeps the demo (`localStorage`) mode until real keys are in `config.js`.

## 📁 Structure

```
web/
├── index.html              Landing page
├── login.html / signup.html
├── home.html               Personal dashboard
├── create-group.html / join-group.html
├── group-dashboard.html    Main group hub
├── group-management.html / member-status.html
├── map.html / navigation.html
├── emergency.html / contacts.html
├── photo-drive.html / chat.html / expenses.html
├── profile.html / settings.html
├── firebase/
│   ├── firestore.rules     Firestore security rules
│   └── storage.rules       (unused — kept for reference only)
└── assets/
    ├── css/  (style, login, dashboard, responsive)
    ├── js/   (config, firebase, common, auth, dashboard, group,
    │          map, navigation, emergency, chat, photos, expenses)
    └── images/ (logo.svg, icons/)
```

## 🔒 Security notes

- Firestore rules in `firebase/firestore.rules` let users read only data for groups they belong to, and only write their own rows.
- Cloudinary uploads use an **unsigned preset**, so anyone with your cloud name + preset name can upload to that folder. Keep the preset read-only and prefer a dedicated folder; do not enable video/image transformations that cost credits.
- The repository ships with placeholder values in `assets/js/config.js`. Add your own Firebase and Cloudinary configuration for live mode. Do not commit privileged credentials; restrict browser API keys and upload presets.
- Demo mode stores data only in the browser's `localStorage`.

## 💸 Free-tier limits (Spark + Cloudinary)

- Firestore: 1 GiB storage, 50K reads / 20K writes per day
- Auth: free (email/password, Google)
- Cloudinary: 25 GB storage + 25 GB/month transfer (free plan)

---

Built for people who drive together. 🛣️

# RideSync

RideSync is a browser-based group riding and biker-safety app for coordinating trips. It includes group management, **group live location features**, **group navigation**, group chat, photo sharing, shared expenses, emergency contacts, and SOS alerts.

## Features

- Email/password and Google sign-in with Firebase Authentication
- Create and join riding groups with invite codes
- Group dashboards, member status, and location sharing
- Maps and route navigation
- Group chat and shared photo/video albums
- Expense tracking and split summaries
- Emergency contacts and SOS alerts
- Demo mode backed by browser `localStorage`

## Tech stack

- HTML, CSS, vanilla JavaScript
- Firebase Authentication and Cloud Firestore
- MapLibre GL, with optional Google Maps integration
- Cloudinary for photo/video uploads

## Run locally

No build step is required. Clone the repository, then serve the `web` directory with a local HTTP server. For example, from the repository root:

```bash
python -m http.server 8000 --directory web
```

Open <http://localhost:8000>. Opening HTML files directly with `file://` may prevent some browser features from working correctly.

Without a configured Firebase project, RideSync uses demo mode and stores sample data in the current browser's `localStorage`. Demo data is local to that browser and is not shared with other users.

## Configure integrations

Configuration lives in `web/assets/js/config.js`. The committed file contains placeholders; add your own project settings locally before enabling live services.

1. Create a Firebase project at <https://console.firebase.google.com/> and register a web app.
2. Enable the sign-in providers you intend to use in Firebase Authentication.
3. Create a Cloud Firestore database and review `web/firebase/firestore.rules` against your data model before publishing the rules.
4. Replace the `YOUR_*` Firebase values in `web/assets/js/config.js` with the web app's configuration.
5. For photo/video uploads, configure a Cloudinary cloud name and unsigned upload preset in the same file. Restrict the preset's allowed formats, file sizes, and upload scope in Cloudinary.
6. `GOOGLE_MAPS_KEY` is optional. If you add a Google Maps API key, restrict it by HTTP referrer and enable only the APIs the app actually uses.

Firebase's browser API key is part of client configuration, not a server-side secret. It should still be restricted in Google Cloud Console, and Firebase Authentication, Firestore rules, and provider settings must be configured securely. Never put service-account JSON, private keys, server tokens, or other privileged credentials in browser code or commit them to Git.

### Firebase deployment (optional)

Install the Firebase CLI and authenticate, then select your own project when deploying. The repository intentionally does not include a project-specific `.firebaserc` file.

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy
```

The hosting configuration serves the `web/` directory. Review the security rules and hosting settings before deploying a public instance.

## Project layout

```text
.
├── firebase.json
├── web/
│   ├── assets/
│   │   ├── css/
│   │   ├── images/
│   │   └── js/           # App logic and integration configuration
│   ├── firebase/         # Firestore and Storage rules
│   └── *.html            # App pages
├── .gitignore
└── README.md
```

## Security checklist before publishing

- [ ] Configure your own Firebase project and restrict its API key.
- [ ] Test Firestore rules with the Firebase Rules simulator and real user roles.
- [ ] Configure and constrain the Cloudinary unsigned upload preset; anyone who knows an unsigned preset can potentially use it.
- [ ] Do not commit private credentials, local config overrides, logs, or Firebase CLI state.
- [ ] Test authentication, group membership, location privacy, uploads, and emergency flows with multiple accounts.


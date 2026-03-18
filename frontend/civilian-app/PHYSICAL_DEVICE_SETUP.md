# Running MeshSOS on a Physical iPhone

## Background: Why This Is More Complex Than the Simulator

The iOS Simulator runs on your Mac and shares its network stack, so `localhost` and local IPs work fine. A physical iPhone is a completely separate device with its own network connection. This creates two problems:

1. **Native modules** — some packages (like `react-native-ble-plx` and `expo-device`) require compiled native iOS code. The standard Expo Go app doesn't include them, so you must build a custom app.
2. **Network isolation** — on eduroam (and most university/enterprise WiFi), devices can't talk directly to each other, so your phone can't reach your Mac's local IP.

---

## One-Time Setup

**Step 1: Create a free ngrok account**
- Go to [ngrok.com](https://ngrok.com), sign up, and copy your authtoken from the dashboard

**Step 2: Install and authenticate ngrok**
```bash
brew install ngrok
ngrok config add-authtoken <your-token>
```
ngrok creates tunnels that let your phone reach your Mac through the internet, bypassing network restrictions.

**Step 3: Trust your iPhone with your Mac**
- Connect iPhone via USB cable
- Tap **Trust** on your iPhone when the popup appears
- In Xcode → Settings → Accounts, sign in with your Apple ID (required to sign the app for installation)

**Step 4: Free up disk space**
The native build process generates several GB of files. If your disk is too full, the build fails with a cryptic linker error (`errno=28`). Clear old build artifacts:
```bash
rm -rf ~/Library/Developer/Xcode/DerivedData
```

---

## Every Time: Starting the App on Campus (eduroam)

**Step 5: Open 3 terminal windows**

---

**Terminal 1 — Start the FastAPI backend**
```bash
cd api
python main.py
```
This is the server the app talks to for broadcasts and supply requests.

---

**Terminal 2 — Tunnel the backend via ngrok**
```bash
ngrok http 8000
```
You'll see output like:
```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:8000
```
Copy that `https://` URL. This is a public address that forwards to your local backend.

> **Important:** ngrok gives you a new URL every session on the free plan. You must update `.env.local` each time.

---

**Step 6: Update `.env.local` with the new ngrok URL**

Open `frontend/civilian-app/.env.local` and set:
```
EXPO_PUBLIC_API_URL=https://abc123.ngrok-free.app
```
Replace `abc123.ngrok-free.app` with the URL ngrok actually gave you. This tells the app to send API requests through ngrok instead of a local IP that eduroam would block.

---

**Terminal 3 — First time only: Build and install the app**
```bash
cd frontend/civilian-app
npx expo run:ios --device
```

What this does:
- Compiles all native modules (BLE, device info, location, etc.) into a real iOS app
- Signs it with your Apple ID
- Installs it directly onto your connected iPhone
- Starts the Metro JS bundler

This takes **5-10 minutes** the first time. When it finishes you'll see a QR code and `Build Succeeded`. A new app icon appears on your phone.

> You only need to rerun this if you add new native packages. For normal JS/UI changes, skip this step.

---

**Terminal 3 — Every subsequent time: Just start Metro**
```bash
cd frontend/civilian-app
npx expo start --dev-client --tunnel
```

- `--dev-client` tells Expo to target your installed development build (not Expo Go)
- `--tunnel` routes Metro through ngrok so the phone can reach it on any network

---

**Step 7: Open the app on your iPhone**

- Open the **MeshSOS** app icon on your phone (not Expo Go — that's a different app)
- It launches the dev client launcher and automatically finds your Metro server
- The app loads and is fully functional

---

## How It All Connects

```
iPhone (MeshSOS dev build)
    │
    ├─ JS bundle ──► ngrok tunnel ──► Metro (Terminal 3, port 8081)
    │                                      │
    │                                   Your Mac
    │
    └─ API calls ──► ngrok tunnel ──► FastAPI backend (Terminal 2→1, port 8000)
```

Both the JS code and the API traffic travel through ngrok tunnels, completely bypassing eduroam's client isolation.

---

## Quick Reference

| Situation | Command |
|---|---|
| First time / added a new native package | `npx expo run:ios --device` |
| Every other session | `npx expo start --dev-client --tunnel` |
| Backend | `python main.py` (from `api/`) |
| API tunnel | `ngrok http 8000` — update `.env.local` with new URL each time |
| Home WiFi (no tunnel needed) | `npx expo start --dev-client` + set `.env.local` to `http://<mac-ip>:8000` |

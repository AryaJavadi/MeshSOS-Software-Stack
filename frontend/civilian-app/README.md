# MeshSOS — Civilian App

A React Native mobile app for civilians to send emergency supply requests over a LoRa mesh network when cellular infrastructure fails. The app connects to a nearby LoRa node over Bluetooth (BLE), displays the live mesh network topology on an Apple Maps overlay, and lets users submit structured supply requests that are relayed hop-by-hop to a gateway where emergency responders receive them.

---

## What It Does

- **Bluetooth pairing** — scans for and connects to a nearby LoRa node over BLE
- **Live mesh map** — shows all nodes in the network on Apple Maps with real GPS positions, signal-strength color coding, and hop links
- **Supply requests** — form to request water, food, medical supplies, shelter, and more; includes per-age-group medical details, GPS auto-capture, and people count
- **Message inbox** — receives updates and instructions from emergency responders relayed back through the mesh
- **Offline-first queue** — requests are persisted locally and retried automatically when a node connection is restored

---

## Tech Stack

| Package | Version | Purpose |
|---|---|---|
| Expo SDK | 54 | Core framework |
| React Native | 0.81.5 | Mobile runtime |
| Expo Router | 6 | File-based navigation |
| react-native-ble-plx | 3.5 | BLE scanning and GATT communication |
| react-native-maps | 1.20 | Apple Maps integration |
| expo-location | 19 | GPS coordinates |
| expo-sqlite | 16 | Message queue persistence |
| react-native-svg | 15 | SVG graphics |
| react-native-reanimated | 4 | Animations |
| Zustand | 5 | Global state management |
| TypeScript | 5.9 | Type safety |
| DM Sans + DM Mono | — | Typography (Google Fonts) |

---

## Prerequisites

Before you start, make sure you have:

- **macOS** (required for iOS builds)
- **Xcode 15+** — install from the Mac App Store, then open it once to accept the license agreement
- **Node.js 20+** — recommended via nvm:
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  nvm install 20
  nvm use 20
  ```
- **Watchman** (improves Metro performance):
  ```bash
  brew install watchman
  ```
- **CocoaPods** (iOS dependency manager):
  ```bash
  sudo gem install cocoapods
  ```

> **Why not Expo Go?**
> This app uses `react-native-ble-plx` (Bluetooth) and `react-native-maps` (Apple Maps), both of which require native iOS code that is not included in the Expo Go app. You must run a local native build.

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/meshsos-civillian-app.git
cd meshsos-civillian-app
```

### 2. Install JavaScript dependencies

```bash
npm install
```

This project includes a `.npmrc` with `legacy-peer-deps=true` to resolve a peer dependency conflict between React 19 and react-dom. The install will use this automatically.

### 3. Install iOS native dependencies (CocoaPods)

```bash
npx pod-install
```

This reads `ios/Podfile` and installs all native iOS libraries, including `react-native-maps` (Apple Maps) and `react-native-ble-plx`.

---

## Running the App

### iOS Simulator (recommended for development)

```bash
npm run ios
# or equivalently:
npx expo run:ios
```

This compiles the full native iOS app (~2–3 minutes on first run) and launches it in the iOS Simulator. Subsequent runs are much faster because the native layer is cached — only JavaScript changes are re-bundled.

### Physical iOS Device

1. Connect your iPhone via USB
2. Open `ios/meshsos-civillian-app.xcworkspace` in Xcode
3. Set your Apple Developer team under **Signing & Capabilities**
4. Run:
   ```bash
   npx expo run:ios --device
   ```

> Note: Bluetooth features require a physical device — the iOS Simulator does not support BLE.

### Reloading After Code Changes

Because all app logic is JavaScript/TypeScript, you do **not** need to rebuild after editing source files. To see changes:

- **In the Metro terminal** — press `r`
- **In the iOS Simulator** — press `Cmd + R`

A full rebuild (`npx expo run:ios`) is only needed when you:
- Add a new npm package with native code
- Modify `app.json` permissions or plugins
- Change files inside the `ios/` directory

---

## Development Mode (Mock BLE)

The app ships with a mock mode so you can develop and test the full UI without real LoRa hardware. Mock mode is **on by default**.

### Running in mock mode (default)

```bash
npm run ios
```

No hardware required. The app auto-connects after a 2-second simulated scan.

### Running with real LoRa hardware

```bash
EXPO_PUBLIC_MOCK_MODE=false npm run ios
```

Requires a physical iOS device with Bluetooth and a MeshSOS LoRa node within range.

### What mock mode simulates

- `startScan()` — 2-second scan delay, then connects with a mock node and network
- Five mock nodes placed around your real GPS location with varying signal strengths
- RSSI drifts slightly every 3 seconds for realism
- Three historical messages pre-populated in the inbox on connect
- New messages arrive at 20s and 40s after connect
- `sendRequest()` — relay ACK after 3s, gateway receipt ACK after 8s

### How it works

| File | Purpose |
|---|---|
| `config.ts` | `MOCK_MODE` flag — reads `EXPO_PUBLIC_MOCK_MODE` env var, defaults to `true` |
| `services/mockBle.ts` | `MockBLEService` — all mock logic, no BLE library dependency |
| `services/ble.ts` | `BLEService` — real BLE only; exports whichever service `MOCK_MODE` selects |
| `services/bleInterface.ts` | `IBLEService` interface — contract both services implement |

---

## Project Structure

```
app/
  _layout.tsx              Root layout and font loading
  (tabs)/
    _layout.tsx            Tab bar (Home, Network, Request, Messages)
    index.tsx              Home screen — disconnected / connected states
    network.tsx            Mesh network map screen
    request.tsx            Supply request form
    status.tsx             Message inbox from responders

components/
  home/
    ConnectedState.tsx     Connected home layout with activity sections
    DisconnectedState.tsx  Scan prompt and BLE connection UI
    NodeCard.tsx           Paired node info card
    SignalStrengthCard.tsx RSSI bar with signal quality labels
    GatewayHopChain.tsx    Visual hop diagram: Phone → Node → ... → Gateway
  network/
    MeshMap.tsx            Apple Maps view with node markers and hop links
    NodeDetailList.tsx     Scrollable node stats list with tap-to-focus
  request/
    SupplyChips.tsx        Multi-select supply type chips
    PeopleCounter.tsx      Adults / Children / Elderly counters
    LocationField.tsx      Auto-captured GPS field
  status/
    MessageTimeline.tsx    Delivery status timeline
  ui/
    Card.tsx               Reusable surface card
    StatusPill.tsx         Node Active / No Node badge
    SectionLabel.tsx       Uppercase section heading

services/
  ble.ts                   Real BLE manager — scan, connect, GATT; exports bleService
  mockBle.ts               MockBLEService — full simulation, no hardware needed
  bleInterface.ts          IBLEService interface — contract for all transport implementations
  location.ts              One-shot GPS via expo-location
  messageQueue.ts          SQLite persist, enqueue, flush, retry

config.ts                  MOCK_MODE flag (env var override: EXPO_PUBLIC_MOCK_MODE)

store/
  bleStore.ts              BLE connection state, node info, network topology
  messageStore.ts          Gateway messages, unread count, sync state
  requestStore.ts          Supply requests, ACK tracking, draft

constants/
  design.ts                All color, spacing, radius, and typography tokens
  ble.ts                   GATT UUIDs and RSSI thresholds

types/
  index.ts                 All shared TypeScript interfaces and enums
```

---

## Hardware Integration

The app is designed to communicate with a LoRa node that exposes a BLE GATT interface. To connect real hardware:

1. Run with `EXPO_PUBLIC_MOCK_MODE=false` (or set `MOCK_MODE = false` in `config.ts` permanently)
2. Update `constants/ble.ts` with your GATT service UUID and characteristic UUIDs:
   - `NODE_INFO` (read) — node ID and firmware version
   - `NETWORK_STATUS` (read + notify) — RSSI, hop count, topology
   - `SEND_REQUEST` (write) — encoded supply request payload
   - `REQUEST_ACK` (notify) — gateway acknowledgement
3. Confirm the message encoding format (JSON vs Protobuf) with your firmware team

---

## Permissions

The app requests the following permissions at runtime:

| Permission | Platform | Purpose |
|---|---|---|
| Bluetooth | iOS + Android | Connect to LoRa node |
| Location (when in use) | iOS + Android | GPS for supply requests and map centering |
| Background Bluetooth | iOS | Maintain node connection in background |

Permissions are declared in `app.json` and are shown to the user the first time they are needed.

---

## Building for Distribution

### TestFlight (iOS)

```bash
npx eas build --profile preview --platform ios
```

This produces an `.ipa` that can be uploaded to TestFlight for internal distribution without App Store review.

### Android APK (sideload)

```bash
npx eas build --profile preview --platform android
```

This produces an `.apk` that can be sideloaded directly onto Android devices (enable "Install from unknown sources").

EAS Build requires a free [Expo account](https://expo.dev/signup). The `eas.json` in this repo defines `development`, `simulator`, `preview`, and `production` build profiles.

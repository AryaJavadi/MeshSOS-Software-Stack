/**
 * App-wide configuration flags.
 *
 * MOCK_MODE = true  → Use MockBLEService. No LoRa hardware required.
 *                     Full UI/UX works on simulator or any device.
 *
 * MOCK_MODE = false → Use real BLEService. Requires a physical MeshSOS
 *                     LoRa node within Bluetooth range.
 *
 * Override at the command line without editing this file:
 *   EXPO_PUBLIC_MOCK_MODE=false npx expo start
 *
 * Defaults to true (mock) when the env var is not set.
 */
export const MOCK_MODE = process.env.EXPO_PUBLIC_MOCK_MODE !== 'false';

/**
 * Backend API base URL.
 *
 * iOS Simulator shares the host machine's network, so 'localhost' works.
 * Physical devices are on a separate network — set this to your Mac's
 * local IP so the phone can reach the backend over Wi-Fi.
 *
 * Find your Mac's IP:  System Settings → Wi-Fi → Details
 *                   or run: ipconfig getifaddr en0
 *
 * Examples:
 *   EXPO_PUBLIC_API_URL=http://10.0.0.31:8000 npm run ios   ← physical device
 *   npm run ios                                              ← simulator (uses localhost)
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

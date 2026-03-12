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

# MeshSOS Hardware & Testing Notes

## 1. Find USB serial device

```
ls /dev/cu.*
```

Or use the built-in device scanner:
```
cd backend
python -m bridge.meshtastic_bridge --list-devices
```

## 2. Setup

```
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 3. Run the bridge (Terminal 1 — listens for incoming LoRa messages)

```
cd backend
source .venv/bin/activate
python -m bridge.meshtastic_bridge /dev/cu.usbmodemXXXX
```

You can also type a message and press Enter to send from this terminal.

## 4. Send a message from a second node (Terminal 2)

Connect a second node via USB, find its port with `ls /dev/cu.*`, then:
```
cd backend
source .venv/bin/activate
python3 scripts/send_meshtastic_message.py /dev/cu.usbmodemYYYY "SOS need water at building 5"
```

Note: the send script cannot use the same port as the bridge (serial lock). Use a different node.

## 5. Start the API (Terminal 3)

```
cd backend
source .venv/bin/activate
python -m api.main
```

## 6. Query the database / API

### Via API (while api.main is running):
```
curl http://localhost:8000/health
curl http://localhost:8000/messages
curl "http://localhost:8000/messages/urgent?min_urgency=2"
curl http://localhost:8000/nodes
```

### Direct SQLite queries:
```
# All recent messages
sqlite3 backend/meshsos.db "SELECT id, node_id, message_type, urgency, timestamp, payload FROM messages ORDER BY id DESC LIMIT 10;"

# SOS messages only (urgency 3)
sqlite3 backend/meshsos.db "SELECT id, node_id, payload FROM messages WHERE urgency = 3 ORDER BY id DESC;"

# Supply requests only
sqlite3 backend/meshsos.db "SELECT id, node_id, payload FROM messages WHERE message_type = 'supply_request' ORDER BY id DESC;"

# Messages from a specific node
sqlite3 backend/meshsos.db "SELECT id, message_type, urgency, payload FROM messages WHERE node_id = '!9e766d5c' ORDER BY id DESC;"

# Count messages per node
sqlite3 backend/meshsos.db "SELECT node_id, COUNT(*) as msg_count, MAX(timestamp) as last_seen FROM messages GROUP BY node_id;"

# Message count by type
sqlite3 backend/meshsos.db "SELECT message_type, COUNT(*) FROM messages GROUP BY message_type;"
```

## 7. Message classification

The bridge auto-classifies messages by keyword:
- **sos** (urgency 3): contains "SOS", "HELP", or "EMERGENCY"
- **supply_request** (urgency 2): contains "SUPPLY", "WATER", "FOOD", or "MEDICAL"
- **broadcast** (urgency 1): everything else

Messages sent as JSON matching the schema bypass heuristics and use exact fields.

## Known device ports (our hardware)

- Node 1 (gateway): `/dev/cu.usbmodem3C0F02EB0B601` — Heltec Wireless Tracker, node ID `!02eb0b60`
- Node 2: `/dev/cu.usbmodemF09E9E766D5C1` — node ID `!9e766d5c`

## Notes

- Only one process can use a serial port at a time (exclusive lock)
- For position data: may need to subscribe to `"meshtastic.receive"` instead of `"meshtastic.receive.text"`
- Similar logic applies on Raspberry Pi — device paths are typically `/dev/ttyACM0` or `/dev/ttyUSB0`

---

# MeshSOS: Raspberry Pi Bridge Deployment Guide

## 1. Initial Network Connection (Host Mac)
Since you are using a direct Ethernet connection with a USB-C adapter, follow these steps to establish the network link:

1.  **Enable Internet Sharing**:
    * Go to **System Settings > General > Sharing**.
    * Click the **(i)** next to **Internet Sharing**.
    * Set **Share your connection from** to `Wi-Fi`.
    * Under **To devices using**, check your `USB 10/100/1000 LAN` (or the specific Ethernet adapter name).
    * Click **Done** and toggle the master switch to **ON**.
2.  **Verify the IP Bridge**:
    * Open Terminal on your Mac and run: `ifconfig bridge100`.
    * Look for the `inet` address (typically `192.168.2.1`). This confirms your Mac is acting as the gateway.
    * The Raspberry Pi will almost always be assigned `192.168.2.2`.

---

## 2. Remote Access (SSH)
Connect to the Pi from your Mac terminal using the project credentials:

```bash
ssh syde-capstone@192.168.2.2
password: capstone18
```

## 3. Environment and Dependency Setup
Once logged into the Pi, run these commands to install the necessary libraries for the Meshtastic API:

```bash
# Update the package repository
sudo apt update
pip install meshtastic pydantic --break-system-packages
```

## 4. Deploy & Run Bridge
# ONLY DO IF RE FLASHING OR CHANGING, DON'T NEED TO DO EVERYTIME SINCE SD CARD

1. Transfer the Script (in a NEW terminal tab)
```bash
scp /Users/benjaminchung/MeshSOS-Software-Stack/backend/bridge/meshtastic_bridge.py \
syde-capstone@192.168.2.2:~/
```

2. Connect Hardware: Plug the Heltec Wireless LoRa tracker (ESP32S3 + SX1262) into one of the Pi's BLACK USB 3.0 ports.

3. Find the Serial Port
```bash
ls /dev/ttyACM*
```

Note: Usually this is /dev/ttyACM0

4. Run the Bridge
```bash
python3 meshtastic_bridge.py /dev/ttyACM0
```

To debug the raspberry pi and see things being plugged into it:
```bash
sudo dmesg | tail -n 20
```

- note: only use the black port when plugging in the Heltec node. blue port causes issues

If issues w/ database:
```bash
scp /Users/benjaminchung/MeshSOS-Software-Stack/backend/database.py syde-capstone@192.168.2.2:~/
```

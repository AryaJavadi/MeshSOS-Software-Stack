# MeshSOS Field Range Testing

Field test suite for Heltec Wireless Tracker nodes (ESP32-S3 + SX1262, 915 MHz).

Validates the MeshSOS engineering specs:
- Range: 2–10 km line-of-sight
- Packet Delivery Rate (PDR): ≥90% across 3 hops
- Max hop count: ≤8
- TX power: up to 22 dBm
- Frequency: 915 MHz (Canada / North America)
- Max payload: 100 bytes per message

---

## Glossary — What the Acronyms Mean

| Term | Full name | What it means |
|------|-----------|---------------|
| **RSSI** | Received Signal Strength Indicator | How strong the radio signal is at the receiver, measured in dBm (decibels-milliwatt). More negative = weaker. -80 dBm is strong, -115 dBm is weak. |
| **SNR** | Signal-to-Noise Ratio | How much stronger the signal is compared to background radio noise, measured in dB. Higher is better. Goes negative when noise drowns out the signal. |
| **PDR** | Packet Delivery Rate | Percentage of sent messages that were successfully received and acknowledged. 10 pings sent, 9 ACKed = 90% PDR. MeshSOS requires ≥90%. |
| **ACK** | Acknowledgement | A confirmation packet sent back by the receiving node to say "I got your message." If no ACK arrives within the timeout, the ping is marked LOST. |
| **dBm** | Decibels-milliwatt | Unit for radio signal power. Always negative for received signals. -90 dBm is stronger than -120 dBm (closer to zero = stronger). |
| **dB** | Decibels | Unit for SNR. Positive means signal is stronger than noise. -5 dB means noise is slightly louder than the signal — still decodable at the edge. |
| **SF** | Spreading Factor | LoRa radio setting that trades speed for range. SF7 = fastest, shortest range. SF12 = slowest, longest range. Higher SF also reduces maximum packet size. |
| **LoRa** | Long Range | The radio modulation technology used by the SX1262 chip. Designed for low-power, long-range communication. |
| **Hop** | Relay hop | When a packet travels through an intermediate node to reach its destination. 1 hop = direct. 2 hops = went through 1 relay node. |
| **Traceroute** | Trace route | A diagnostic packet that records every node it passes through on the way to the destination, then reports the full path back to you. |
| **PDU** | Protocol Data Unit | The full packet transmitted over the air including headers and payload. |

---

## Signal Quality Reference (SX1262 @ 915 MHz)

| Metric | Good | Marginal | Lost |
|--------|------|----------|------|
| **RSSI** | > -100 dBm | -100 to -120 dBm | < -120 dBm |
| **SNR** | > -5 dB | -5 to -10 dB | < -10 dB |

**How to read RSSI:** Think of it like a phone bar indicator. -70 dBm = full bars, -100 dBm = 1 bar, -120 dBm = no signal. You want RSSI above -100 dBm for reliable delivery.

**How to read SNR:** 0 dB means signal and noise are equal power. Positive SNR = signal is louder than noise (good). Negative SNR = noise is louder, but LoRa can still decode down to about -10 dB. Below that, packets are lost.

---

## What Gets Logged

### `results/range_log.csv` — Range test output

One row is written every time you press Enter and complete a ping burst.

| Column | What it means |
|--------|---------------|
| `timestamp` | Date and time the test completed (UTC) |
| `test_num` | Which test point this is in the session (1, 2, 3...) |
| `distance_m` | GPS distance between Node A and Node B in metres, calculated automatically from both nodes' GPS coordinates |
| `rssi_dbm` | Average RSSI across all ACKs received at this test point. Blank if no ACKs. |
| `snr_db` | Average SNR across all ACKs received. Blank if no ACKs. |
| `hop_limit` | The hop limit setting used for this burst (how many relay hops are allowed) |
| `hops_taken` | How many hops the return ACK actually used. 0 = direct link. 1 = went through 1 relay. |
| `route_path` | `direct` if no relay was used, or the node ID(s) of intermediate relay nodes (e.g. `!ab12cd34`) |
| `pings_sent` | Number of pings sent in the burst (default: 10) |
| `acks_received` | Number of those pings that got an ACK back within the timeout |
| `pdr_pct` | Packet Delivery Rate as a percentage. `acks_received / pings_sent × 100` |
| `delivered` | True if at least 1 ACK was received, False if all pings were lost |
| `signal_quality` | `GOOD`, `MARGINAL`, or `LOST` based on the RSSI thresholds above |

### `results/packet_size_log.csv` — Packet size test output

One row is written per payload size tested (8 sizes × 10 pings each, fully automatic).

| Column | What it means |
|--------|---------------|
| `timestamp` | Date and time this size tier completed |
| `payload_bytes` | Exact size of the test payload in bytes |
| `label` | Human-readable name for this size tier (e.g. `meshsos_payload_max`) |
| `hop_limit` | Hop limit used for this size tier |
| `pings_sent` | Number of pings sent at this size (default: 10) |
| `acks_received` | How many got through |
| `pdr_pct` | Packet Delivery Rate as a percentage |
| `delivered` | True if any ACK was received |
| `avg_rssi_dbm` | Average RSSI for successful deliveries |
| `avg_snr_db` | Average SNR for successful deliveries |
| `signal_quality` | `GOOD`, `MARGINAL`, or `LOST` |
| `pass_fail` | `PASS` if PDR ≥ 90%, `FAIL` otherwise |

---

## Prerequisites

```bash
# From the project root
cd MeshSOS-Software-Stack
source .venv/bin/activate
```

If you haven't set up the virtualenv yet:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

All required packages (`meshtastic`, `pyserial`) are already in `requirements.txt` — no extra installs needed.

---

## One-Time Setup

### Step 1 — Find your serial port

Plug the base node into your laptop via USB, then run:

```bash
# macOS
ls /dev/cu.*
```

```bash
# Linux
ls /dev/ttyUSB* /dev/ttyACM*
```

You will see something like `/dev/cu.usbserial-A5069RR4`. That is your port.

### Step 2 — Find the remote node ID

Open the **Meshtastic app** on your phone → tap **Nodes** tab. Each node has an ID that looks like `!9e766d5c`. Note down the ID of the node that will be walking away (the remote node).

### Step 3 — Edit `config.py`

Open `testing_plan/config.py` and set these two values:

```python
SERIAL_PORT    = "/dev/cu.usbserial-A5069RR4"   # your port from Step 1
REMOTE_NODE_ID = "!9e766d5c"                     # remote node ID from Step 2
```

Everything else can stay at defaults.

---

## Test 1 — Max Range (2 Nodes)

**Goal:** Find the maximum reliable distance between two nodes on a direct LoRa link.

**Hardware needed:**
- Node A — plugged into your laptop via USB (stays at base)
- Node B — carried by the walker

**What it does:** At each test point, sends 10 pings, counts ACKs, fetches GPS from both nodes, calculates the real distance, and logs RSSI/SNR/PDR.

### Terminal commands

```bash
cd MeshSOS-Software-Stack/testing_plan

python main.py --port /dev/cu.usbserial-A5069RR4 --remote !9e766d5c --mode range
```

Replace `/dev/cu.usbserial-A5069RR4` with your actual port and `!9e766d5c` with your remote node ID.

### What you will see

```
Base node  : !aabbccdd
Remote node: !9e766d5c
Hop limit  : 3
Pings/point: 10
ACK timeout: 10.0s

Waiting for nodes to appear on mesh...

  Node ID          Name                 GPS
  ──────────────── ──────────────────── ──────────────────────────────
  !aabbccdd        BaseNode             43.472300, -80.544900
  !9e766d5c        RemoteNode           43.471100, -80.542300

Press Enter when the walker is at a new test position.
Press Ctrl+C to end the session and print summary.

[Test 1] Press Enter to start ping burst >
```

Press **Enter** each time the walker reaches a new spot.

```
── Test 1 ──────────────────────────────────
GPS distance: 523.4 m (0.523 km)
  Traceroute to !9e766d5c... direct (no intermediate hops)
  Ping 1/10... ACK  RSSI=-87 dBm  SNR=4 dB  hops=0
  Ping 2/10... ACK  RSSI=-88 dBm  SNR=3 dB  hops=0
  ...
  Ping 10/10... ACK  RSSI=-89 dBm  SNR=4 dB  hops=0

  Result  : PASS
  PDR     : 10/10 (100%)
  Avg RSSI: -88.0 dBm
  Avg SNR : 3.7 dB
  Avg hops: 0
  Distance: 523.4 m
  Route   : direct
  [log] Saved → results/range_log.csv
```

Press **Ctrl+C** at the end to see a full session summary.

### Suggested distances

Walk Node B to these distances and press Enter at each one:

**500 m → 1 km → 2 km → 3 km → 5 km → 7 km → 10 km**

Stop at the first distance where PDR drops below 90% — that is your effective range limit.

### Packet size test at range

Once you find the edge of reliable range, stay at that location and run:

```bash
python main.py --port /dev/cu.usbserial-A5069RR4 --remote !9e766d5c --mode packet-size
```

This automatically cycles through 8 payload sizes (50 → 100 → 150 → 200 → 250 → 300 → 400 → 500 bytes), sends 10 pings at each, and logs results to `results/packet_size_log.csv`. You want **50 B and 100 B to PASS** at your target range — those are the sizes MeshSOS actually uses.

---

## Test 2 — Multi-Hop (3 Nodes)

**Goal:** Confirm that a message can travel from Node A through an intermediate relay (Node B) to reach Node C, and verify the exact path using traceroute.

**Hardware needed:**
- Node A — plugged into your laptop via USB (stays at base)
- Node B — intermediate relay, placed roughly halfway between A and C (powered on, no laptop needed)
- Node C — carried by the walker, placed beyond Node A's direct range

### Setup

1. First run Test 1 with just Node A and Node C to find where direct contact is lost (e.g. 3 km).
2. Place Node B roughly halfway between A and C (e.g. 1.5 km from A).
3. In `config.py`, set `REMOTE_NODE_ID` to **Node C's ID** (the far node — not B).

### Terminal commands

```bash
# Step 1: Confirm Node A and C CANNOT communicate directly (hop-limit 1 = no relays allowed)
python main.py --port /dev/cu.usbserial-A5069RR4 --remote !<node_c_id> --mode range --hop-limit 1

# Step 2: Run the multi-hop test — allows up to 3 hops, should succeed via Node B
python main.py --port /dev/cu.usbserial-A5069RR4 --remote !<node_c_id> --mode range --hop-limit 3

# Step 3: Test up to MeshSOS max hop count
python main.py --port /dev/cu.usbserial-A5069RR4 --remote !<node_c_id> --mode range --hop-limit 8
```

Replace `!<node_c_id>` with Node C's actual ID.

### How to confirm multi-hop is working

The traceroute runs automatically before each ping burst. Look for this in the output:

```
Traceroute to !node_c_id... via !node_b_id
Route   : !node_b_id
```

This means the packet went through Node B to reach Node C. If it says `direct`, A and C are still in range of each other — move C further away.

Also check the CSV:
- `route_path` should show `!node_b_id` (not `"direct"`)
- `hops_taken` should be `1` or more
- PDR should still be ≥90%

### Packet size over multi-hop

After confirming the relay works, test whether payloads survive across the hop:

```bash
python main.py --port /dev/cu.usbserial-A5069RR4 --remote !<node_c_id> --mode packet-size --hop-limit 3
```

Results go to `results/packet_size_log.csv`. You want **50 B and 100 B to PASS**. Sizes above ~220 B will likely fail — that is expected behaviour from the LoRa radio limit.

---

## Packet Size Limits by Spreading Factor

The SF setting in the Meshtastic app affects both range and maximum message size.

| SF | Max packet size (approx) | Airtime | Range |
|----|--------------------------|---------|-------|
| SF7 | ~220 bytes | Fast | Short |
| SF10 | ~100 bytes | Medium | Medium |
| SF12 | ~51 bytes | Slow | Maximum |

The MeshSOS `payload` field is capped at **100 bytes** in the code — designed to be reliable at SF10. At SF7 you have extra headroom; at SF12 even the 100-byte limit is right at the radio's boundary.

To change SF: Meshtastic app → Settings → Radio Config → LoRa → Spreading Factor.

---

## Quick Reference — All Commands

```bash
# Always activate the virtualenv first
cd MeshSOS-Software-Stack
source .venv/bin/activate
cd testing_plan

# ── Test 1: Max range (2 nodes) ──────────────────────────────────────────────
python main.py --port /dev/cu.usbserial-A5069RR4 --remote !9e766d5c --mode range

# ── Test 1 + packet size: stay at edge of range and test payload sizes ────────
python main.py --port /dev/cu.usbserial-A5069RR4 --remote !9e766d5c --mode packet-size

# ── Test 2: Confirm direct link fails beyond range (hop-limit 1 = no relays) ─
python main.py --port /dev/cu.usbserial-A5069RR4 --remote !<node_c_id> --mode range --hop-limit 1

# ── Test 2: Multi-hop via relay node ─────────────────────────────────────────
python main.py --port /dev/cu.usbserial-A5069RR4 --remote !<node_c_id> --mode range --hop-limit 3

# ── Test 2: Multi-hop at MeshSOS max hop count ────────────────────────────────
python main.py --port /dev/cu.usbserial-A5069RR4 --remote !<node_c_id> --mode range --hop-limit 8

# ── Test 2 + packet size: confirm payloads survive across hops ───────────────
python main.py --port /dev/cu.usbserial-A5069RR4 --remote !<node_c_id> --mode packet-size --hop-limit 3
```

**During any range test:** press **Enter** at each new test location, **Ctrl+C** to end and print summary.

**During packet size test:** fully automatic — just wait for all 8 sizes to complete.

---

## Output Files

| File | Mode | Description |
|------|------|-------------|
| `results/range_log.csv` | `--mode range` | One row per test point. Distance, RSSI, SNR, PDR, hop count, route path. |
| `results/packet_size_log.csv` | `--mode packet-size` | One row per payload size. PDR, RSSI, SNR, pass/fail per size. |

Both files append on every run — multiple sessions accumulate in the same file so you can compare across days or locations.

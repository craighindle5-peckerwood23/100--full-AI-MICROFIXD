# Microfixd local vehicle bridge

This is executable read-only adapter integration, not a cloud server pretending it has a local USB port. Run the bridge on the computer physically connected to the vehicle interface. It uploads authenticated OBD responses to Microfixd and is visible in `/automotive` and the governed agent tools.

## Primary: J2534 Pass-Thru

Requires Windows, Python 3.10+, the adapter manufacturer's installed **J2534-1 API 04.04** driver, and Python bitness matching that DLL. API 05.00-only drivers are not supported by this implementation. No vendor DLL is bundled. Use only your installed, trusted manufacturer driver.

List installed drivers:

```powershell
python integrations/obd-bridge/bridge.py --list-j2534
```

Connect using the reported absolute FunctionLibrary path:

```powershell
python integrations/obd-bridge/bridge.py --j2534-dll "C:\Manufacturer\PassThru.dll" --server https://microfixd-full-ai.onrender.com --label "Shop J2534"
```

The CLI prompts for an existing Microfixd operator token or account access token without displaying it. `MICROFIXD_OBD_TOKEN` is an alternative environment variable. Never use the Supabase service-role key as an operator credential. Keep the token out of command arguments and source files. Shared operator tokens resolve to the existing default tenant; account tokens resolve through verified profiles. An account token must remain valid for the session. Cloud uploads require this feature to be merged/deployed first; an older server returns an error, not simulated success.

The implementation uses PassThruOpen, PassThruConnect, ISO15765 flow-control filters, PassThruWriteMsgs for allowlisted diagnostic requests, PassThruReadMsgs, PassThruDisconnect and PassThruClose. Standard generic emissions CAN profiles are probed in order: 11-bit 500/250 kbit, then 29-bit 500/250 kbit. The driver handles ISO-TP reassembly. A protocol is reported connected only after a valid supported-PID response.

11-bit ECU response IDs are 0x7E8–0x7EF. For 29-bit, the default ECU source-address list is 0x10,0x18; specify vehicle-appropriate addresses with `--ecu-addresses 10,18` (hex, max eight). This is not a scan of every possible address. Other addresses and vehicle-specific profiles require validation. J2534 support does not mean every OEM module/protocol is implemented. Legacy J1850, KWP/K-line, CAN-FD, DoIP, full-system module discovery, extended addressing, OEM security and programming are not implemented by this J2534 bridge.

## Secondary: USB/serial, Bluetooth SPP, Wi-Fi/TCP

These adapters must speak ELM327 commands. A bare 16-pin cable, generic USB-CAN interface or proprietary dongle is not automatically an ELM327 device.

```bash
python -m pip install -r integrations/obd-bridge/requirements.txt
python integrations/obd-bridge/bridge.py --serial COM5 --baud 38400 --server https://microfixd-full-ai.onrender.com
python integrations/obd-bridge/bridge.py --serial COM7 --bluetooth-spp --server https://microfixd-full-ai.onrender.com
python integrations/obd-bridge/bridge.py --tcp 192.168.0.10:35000 --server https://microfixd-full-ai.onrender.com
```

Use your actual port, baud rate, dongle IP and TCP port. Bluetooth Classic SPP must already be paired through the operating system and exposed as a serial port (COM/rfcomm). BLE/GATT adapters and direct Android browser Bluetooth access are not implemented. Wi-Fi ELM327 TCP is normally unencrypted on the local adapter network; use your own adapter/network. Cloud uploads use HTTPS. The bridge exposes no inbound network server and accepts no model-generated raw hardware commands.

ELM327 initializes echo/line formatting, requests automatic protocol selection and records the adapter's actual protocol result. It uses headerless automatic formatting; ECU identity is explicitly `unattributed`, and ambiguous multi-ECU long frames are rejected. Legacy VIN formats may remain unconfirmed instead of being guessed.

## What Microfixd understands

After the bridge starts, the workspace shows the session ID and automatically refreshes session state. `waiting_for_bridge`, `connected`, `vehicle_not_responding`, `disconnected`, `error` and `stale` are distinct states. Generic supported PIDs, VIN (where returned), stored/pending/permanent DTCs, MIL/count, RPM, coolant, speed, fuel trims, MAP, airflow, throttle and module voltage are decoded only from actual returned bytes. Unsupported values stay absent. The PID bitmap restricts live polling.

Cloud-side per-query caching keeps DTC/VIN responses for 180 seconds and live PIDs for 30 seconds. Receipts older than 20 seconds mark the connection stale. Timestamps and source responses remain available. The latest sample must contain a validated response to claim a responding vehicle. Loss of the bridge never implies a healthy vehicle or zero values. A received sample is a bridge report, not independent hardware attestation.

Agent callable tools:

- `list_obd_sessions` — find the tenant's adapter sessions.
- `read_obd_status` with `obd_session_id` — read freshness, decoded data, conflicts and a grounded next action.

Example task: **“List my OBD sessions, read the latest connected session, explain the MIL, codes, engine state and unavailable data, and suggest the next diagnostic evidence to gather.”** Enable the two tools in the existing mission controls. They use the durable planner with automatic read-only approval receipts, tenant isolation and persisted tool results. A user must start the bridge locally; the cloud model cannot silently connect USB hardware from Render.

The workspace can create a diagnostic case from a live session after the technician selects/confirms the vehicle profile. It captures observed codes and session ID/sequence/receipt time. VIN disagreement or stale/nonresponding sessions block creation. Exact engine and authorized source evidence are still required before the diagnostic workflow can generate evidence-backed hypotheses. No licensed OEM service corpus is included.

This bridge does not clear DTCs, perform actuator tests, change coding, write adaptations, snapshot firmware, or flash/rollback ECUs. Those are separate OEM-authorized workflows; no backup capability is implied by generic OBD reads. The local command allowlist rejects service 04, security access, arbitrary headers and programming commands.

## Validation

```bash
npm run test:obd-bridge
node --import tsx --test tests/obd.test.ts
node --import tsx tests/obd-bridge-e2e.mjs
bash scripts/verify-production.sh
```

The end-to-end test runs a real TCP socket adapter emulator, the actual Python bridge, authenticated Express session ingestion, the session repository contract and the governed `read_obd_status` tool. J2534 tests exercise ctypes structures, flow filters, read requests, reply decoding and cleanup through a fake vendor DLL. These prove software behavior, not manufacturer-driver or physical vehicle compatibility. Final hardware validation requires the actual adapter, Windows driver and vehicle. Stop with Ctrl+C; sessions are marked disconnected where upload succeeds, otherwise their heartbeat expires.

Primary implementation references:

- https://www.scandoc.org/en/develop/j2534/pt_connect.html
- https://www.scandoc.org/en/develop/j2534/pt_start_msgfilt.html
- https://www.scandoc.org/en/develop/j2534/pt_readmsg.html
- https://www.elmelectronics.com/wp-content/uploads/2017/01/ELM327DS.pdf

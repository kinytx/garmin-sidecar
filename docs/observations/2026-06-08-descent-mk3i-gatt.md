# 2026-06-08 Descent Mk3i GATT Observation

## Source

- Capture source: `garmin-ble-probe`
- Probe version: `0.2.0`
- Device: Garmin Descent Mk3i 51mm
- Transport: Android BLE GATT discovery
- Sensitive fields: device address redacted from this note

## Summary

The first uploaded Mk3i capture confirms that Android can connect and discover
Garmin-specific GATT services. The Garmin ML/GFDI service advertised in earlier
notes is present.

## Services

### Generic Access

- Service: `00001800-0000-1000-8000-00805f9b34fb`
- Characteristics:
  - `00002a00-0000-1000-8000-00805f9b34fb`: read
  - `00002a01-0000-1000-8000-00805f9b34fb`: read
  - `00002a04-0000-1000-8000-00805f9b34fb`: read
  - `00002aa6-0000-1000-8000-00805f9b34fb`: read

### Generic Attribute

- Service: `00001801-0000-1000-8000-00805f9b34fb`
- Characteristics:
  - `00002a05-0000-1000-8000-00805f9b34fb`: indicate

### Garmin Service: `6a4e8022-667b-11e3-949a-0800200c9a66`

- `6a4e4c80-667b-11e3-949a-0800200c9a66`: writeNoResponse
- `6a4ecd28-667b-11e3-949a-0800200c9a66`: read, notify

### Garmin ML/GFDI Service: `6a4e2800-667b-11e3-949a-0800200c9a66`

Observed characteristic pairs:

| Notify/read char | Write char | Notes |
| --- | --- | --- |
| `6a4e2810-667b-11e3-949a-0800200c9a66` | `6a4e2820-667b-11e3-949a-0800200c9a66` | Likely primary pair |
| `6a4e2811-667b-11e3-949a-0800200c9a66` | `6a4e2821-667b-11e3-949a-0800200c9a66` | Additional channel |
| `6a4e2812-667b-11e3-949a-0800200c9a66` | `6a4e2822-667b-11e3-949a-0800200c9a66` | Additional channel |
| `6a4e2813-667b-11e3-949a-0800200c9a66` | `6a4e2823-667b-11e3-949a-0800200c9a66` | Additional channel |
| `6a4e2830-667b-11e3-949a-0800200c9a66` | `6a4e2840-667b-11e3-949a-0800200c9a66` | Additional channel |

Other characteristic:

- `6a4e2803-667b-11e3-949a-0800200c9a66`: read, writeNoResponse, write

Properties:

- Notify/read characteristics were reported as `read`, `writeNoResponse`,
  `write`, `notify`.
- Write characteristics were reported as `writeNoResponse`, `write`.

### Other Services

- `00003802-0000-1000-8000-00805f9b34fb`
  - `00004a02-0000-1000-8000-00805f9b34fb`: read, write, notify
- `cc353442-be58-4ea2-876e-11d8d6976366`
  - `c551c36a-0377-4a29-9657-74ffb655a188`: read, write, notify
- `0000180d-0000-1000-8000-00805f9b34fb`
  - `00002a37-0000-1000-8000-00805f9b34fb`: notify
- `00001814-0000-1000-8000-00805f9b34fb`
  - `00002a54-0000-1000-8000-00805f9b34fb`: read
  - `00002a53-0000-1000-8000-00805f9b34fb`: notify

## Implementation Notes

Start with the ML/GFDI service `6a4e2800-667b-11e3-949a-0800200c9a66`.

Recommended first attempt:

- Enable notify on `6a4e2810-667b-11e3-949a-0800200c9a66`.
- Write to `6a4e2820-667b-11e3-949a-0800200c9a66`.
- Use `writeNoResponse` first, but keep normal write as a fallback.
- Send the existing `garmin_ble_core_start()` queued close/register packets.
- Record all notify frames before adding higher-level parsing.

Open question:

- Whether channel pair `2810/2820` is always primary for Descent devices, or
  whether the active pair depends on watch state / pairing state.

## First Handshake Result

Capture time: 2026-06-08 19:05 CST.

The `2810/2820` pair responded to the minimum management handshake.

Observed sequence:

| Direction | Label | Hex |
| --- | --- | --- |
| tx | close all | `000502000000000000000000` |
| rx | close all response | `00060200000000000000000001` |
| tx | register GFDI reliable | `00000200000000000000010002` |
| rx | register response | `00010200000000000000010000860100` |
| rx | service data / device info | `e00000023704a013972e7f10edac79ced209a00f1144657363656e74204d6b33692035316d6d0744657363656e74084d6b332035316d6d0103afc000` |

Notes:

- `descriptorWrite status=0` confirms notify subscription succeeded.
- The first register write returned Android status `9`, then a retry returned
  `0`; the watch still accepted the register sequence.
- The service data frame contains readable model text including
  `Descent Mk3i 51mm`.

Next test:

- Feed these RX frames through the C sidecar state machine.
- After service registration, let the sidecar queue MLR ACK and GFDI filter /
  directory requests instead of hard-coding only the first two management
  packets in Android.

## Second Handshake Result

Capture time: 2026-06-08 19:23 CST.

The updated Android probe successfully subscribed to notify, sent the close /
register sequence, acknowledged the first ML/GFDI data frame, and queued the
current experimental filter and directory request packets. Android write status
was `0` for every transmitted packet in this capture.

Observed sequence summary:

| Step | Direction | Label | Result |
| --- | --- | --- | --- |
| 1 | event | channel | `notify=2810 write=2820` |
| 2 | event | descriptorWrite | `status=0` |
| 3 | tx | close all | write result `0` |
| 4 | rx | close all response | `00060200000000000000000001` |
| 5 | tx | register GFDI reliable | write result `0` |
| 6 | rx | register response | `00010200000000000000010000800100` |
| 7 | rx | device info ML/GFDI frame | contains `Descent Mk3i 51mm` |
| 8 | tx | MLR ACK | `e040`, write result `0` |
| 9 | tx | GFDI filter | write result `0` |
| 10 | tx | directory request fragments | both write result `0` |

Notes:

- GATT discovery remains complete: 8 services were captured.
- The watch repeated the same device-info ML/GFDI frame several times after
  the experimental directory request.
- This strongly suggests that the transport is open, but the probe needs a
  real MLR state machine rather than a fixed ACK / directory byte sequence.

Next test:

- Port the Gadgetbridge-style MLR sequence bookkeeping into the probe or the C
  sidecar: receive sequence, send sequence, ACK timer, retransmission, and
  fragmentation.
- Only request file directory after the service callback has consumed and
  acknowledged the device-info message.

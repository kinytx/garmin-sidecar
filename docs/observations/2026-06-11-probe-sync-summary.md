# 2026-06-11 Probe Findings Synced Into Sidecar

## Summary

`garmin-ble-probe` has proven enough Garmin BLE behavior to move the sidecar
from single-file experiments toward whole-log synchronization.

Confirmed:

- Garmin Descent X50i uses BLE / GATT / ML-GFDI v2.
- Garmin Descent Mk3i 51mm uses BLE / GATT / ML-GFDI v2.
- X50i activity logs are `FIT_TYPE_4`.
- X50i location records are exposed through `FIT_TYPE_8`.
- Mk3i activity logs are `FIT_TYPE_4`.
- Mk3i did not expose `FIT_TYPE_8` in the current sample set.
- X50i can be directly connected from a cached / known device entry, without
  requiring the current scan result to show the device advertising.

## Connection Strategy

The product should treat Garmin devices as persistent known devices:

1. Show previously connected Garmin devices by default.
2. Prefer cached direct connect.
3. Use scanning for first discovery, address refresh, and visible status.
4. If direct connect fails, ask the user to wake the device or enter pairing /
   connection mode.

Expected scope:

- X50i: confirmed.
- Mk3i / Mk3 / other Descent / Fenix dive-capable BLE devices: expected to use
  the same cached direct connect strategy, but still needs per-model validation.

## Complete Log Download

Sidecar now supports the WSS command:

```json
{"type":"device.downloadAllLogs","sessionId":"watch-1"}
```

Current behavior:

1. Request Garmin directory.
2. Parse all 16-byte directory entries from the directory payload.
3. Select activity FIT entries:
   - `dataType=128`
   - `subType=4`
   - `fileSize > 0`
4. Skip entries already present in the local sidecar cache.
5. Download queued logs one by one.
6. Save completed FIT bytes with SHA-256 content deduplication.
7. Emit `device.sync.plan`, `device.sync.file`, `device.dive`, and
   `device.sync.complete` events.

Local cache:

- Environment variable: `GARMIN_SIDECAR_STORE`
- Default: `.cache/garmin-sidecar`

Deduplication:

- Directory key: `fileIndex:dataType:subType:fileNumber:fileSize:garminTime`
- Content key: SHA-256 of completed FIT bytes

## File Type Notes

X50i:

- `FIT_TYPE_4`: activity FIT, includes scuba dive profile, gas and tank data.
- `FIT_TYPE_8`: location FIT, native message `29`, includes semicircle latitude
  and longitude.
- `FIT_TYPE_1`: capability / summary style file.
- empty type: GarminDevice XML / DataType description seen in probe samples.

Mk3i:

- `FIT_TYPE_4`: activity FIT, includes apnea dive summary.
- `FIT_TYPE_1`: device capabilities.
- `FIT_TYPE_2`: settings.
- `FIT_TYPE_5`: sport / mode configuration.
- `FIT_TYPE_35`: duplicate backup ZIP in the latest sample.
- `FIT_TYPE_59`: index / menu-like data.
- `FIT_TYPE_60`: contains coordinate-shaped values, but user confirmed these
  are not visited dive sites; treat as location database / POI / map index, not
  personal dive GPS.
- `FIT_TYPE_72` / `FIT_TYPE_74`: status / training / device-like small FIT
  files, not confirmed as dive logs.
- `BACKUP_PRIMARY`: device backup ZIP.

## Current Limitation

The sidecar C/WASM core still uses the early GFDI directory download model.
The probe has already proven the newer Garmin FileSync protobuf profiles:

- `no-flags`: exposes X50i and Mk3i `FIT_TYPE_4` activity logs.
- `gb-default` flags `42405/42405`: exposes X50i `FIT_TYPE_8` location file.

Next protocol task: move FileSync protobuf multi-profile listing and request
logic from `garmin-ble-probe` into the sidecar core, then route those entries
through the same `device.downloadAllLogs` queue.

## Coordinate Landing Strategy

Coordinates should be treated as a separate attachment to the imported dive
record, not assumed to live inside every activity FIT.

Current trusted source:

- X50i `FIT_TYPE_8`
  - native message `29`
  - field `1`: latitude semicircle
  - field `2`: longitude semicircle
  - conversion: `degrees = semicircle * 180 / 2147483648`

Current non-trusted candidates:

- Mk3i `FIT_TYPE_60`: coordinate-shaped values exist, but user confirmed they
  are not visited dive sites. Keep as POI / map index research material only.

Mini-program / staging expectation:

- show `已定位` when trusted coordinates are attached.
- show `待确认` when only untrusted candidates exist.
- show `无坐标` when no reliable coordinate source is found.

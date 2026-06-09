# Garmin Sidecar Roadmap

## Phase 0: Project Shape

- [x] Create a standalone `garmin-sidecar` project.
- [x] Keep a transport-neutral C core.
- [x] Add LDC-style, WASM, and WSS adapter sketches.
- [x] Document clean-room rules for Gadgetbridge reference work.

## Phase 1: Capture and Discovery

- [x] Extend `garmin-ble-probe` to capture service/characteristic details after
      user-selected connect.
- [x] Save captures to DivePlan ECS with device model, app version, and consent.
- [ ] Add anonymized packet fixture files under `fixtures/`.
- [ ] Confirm Descent Mk2/Mk3/G1/G2/X50i service UUIDs and write/notify pairs.
      Mk3i first capture confirms Garmin ML/GFDI service
      `6a4e2800-667b-11e3-949a-0800200c9a66` and likely primary pair
      `2810 notify / 2820 write`.

## Phase 2: Real Watch Handshake

- [ ] Build a local Android sidecar harness that owns BLE.
- [ ] Forward BLE notify/write through the WSS envelope in `wss/`.
- [ ] Verify ML close/register sequence against one real Garmin watch.
- [ ] Add packet-level regression tests for the verified handshake.

## Phase 3: Directory and FIT Download

- [ ] Request activity directory entries.
- [ ] Filter likely dive FIT files first.
- [ ] Download one FIT file end-to-end.
- [ ] Persist raw FIT bytes with checksum and source metadata.
- [ ] Convert downloaded FIT bytes into DivePlan staging records.

## Phase 4: Product Integration

- [ ] Add ECS WSS endpoint for `driver=garmin-sidecar`.
- [ ] Add mini-program UI state: "Garmin requires Sidecar sync".
- [ ] Add Android collector pairing and account binding flow.
- [ ] Add admin diagnostics for failed Garmin sessions.

## Phase 5: Hardening

- [ ] Retry/resume partial file download.
- [ ] Device capability detection by model.
- [ ] Battery-safe background sync policy.
- [ ] Privacy review for raw FIT retention.
- [ ] Release build and deployment docs.

# Garmin Sidecar

Garmin Sidecar is the experimental Garmin Descent import project for DivePlan.
It is designed as a transport-neutral protocol library plus thin adapters, so
the same core can later be used by an Android collector, an ECS WSS bridge, and
a libdivecomputer-style import facade.

This project is intentionally separate from the mini-program. The mini-program
can scan Garmin BLE advertisements today, but Garmin log import needs a
dedicated Garmin protocol path instead of the current generic libdivecomputer
BLE bridge.

## Goals

- Keep Garmin protocol state outside the mini-program UI.
- Build an LDC-like library surface for directory scan and FIT file download.
- Support a WSS bridge for Android/native collectors uploading to DivePlan.
- Convert completed FIT bytes into DivePlan staging records before final save.
- Keep a clean-room boundary when learning from Gadgetbridge behavior.

## Layout

- `c/`: C99 transport-neutral Garmin BLE/GFDI core.
- `cpp/`: small C++ RAII wrapper.
- `ldc/`: libdivecomputer-style adapter and device facade.
- `wasm/`: C/WASM bridge for an ECS or browser-side harness.
- `wss/`: unified WSS message router sketches.
- `docs/`: architecture, protocol envelope, and mini-program UX notes.
- `archive/`: older experiments kept as reference only.

## Current Status

Implemented:

- C99 framing, COBS, CRC, GFDI helper functions.
- Native smoke tests for the C core, C++ wrapper, and LDC-style facade.
- WSS message envelope sketches for client-owned BLE plus backend-owned state.

Not verified yet:

- Real Garmin Descent BLE handshake.
- Real directory listing from a watch.
- Real FIT download from a watch.
- Android sidecar collector.
- Production ECS WSS deployment.

## Run Smoke Tests

```powershell
cd S:\GMP\garmin-sidecar
.\test.ps1
```

or, in a Unix-like shell:

```sh
make test
```

## Clean-Room Rule

Gadgetbridge may be used as protocol behavior reference and test oracle, but do
not copy Gadgetbridge AGPL source code into this project. See `CLEAN_ROOM.md`.

## Docs

- `ROADMAP.md`
- `CLEAN_ROOM.md`
- `docs/garmin-sidecar-architecture.md`
- `docs/garmin-wss-protocol.md`
- `docs/garmin-miniapp-ux.md`

# Clean-Room Notes

This project may study public behavior, packet captures, logs, and user-owned
device interactions, but it must not copy Gadgetbridge source code.

## Allowed Inputs

- BLE captures from devices owned or authorized by the tester.
- High-level protocol observations written in our own words.
- Public documentation that allows implementation.
- Black-box comparisons such as "when command X is sent, packet Y is observed".
- Test vectors recorded as raw bytes, with source and consent noted.

## Disallowed Inputs

- Copying Gadgetbridge classes, methods, constants blocks, or comments.
- Translating Gadgetbridge Java/Kotlin implementation line-by-line.
- Importing Gadgetbridge code into this repository.
- Mixing AGPL source snippets into proprietary DivePlan services.

## Preferred Workflow

1. Record observed behavior in `docs/observations/` using plain language and
   packet bytes.
2. Implement protocol logic from those observations in `c/`.
3. Add a native smoke test for every new parser or packet builder.
4. Keep source attribution in docs, not copied code.
5. If direct code reuse is ever required, treat that component as AGPL and keep
   it isolated with a separate license review.

## Why This Matters

Gadgetbridge is an excellent reference project, but its license has strong
sharing obligations. Garmin Sidecar should remain a DivePlan-owned protocol
implementation that can be safely used by ECS services, Android collectors, and
future import tools.

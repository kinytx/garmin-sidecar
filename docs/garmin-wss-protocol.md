# Garmin WSS Protocol / Garmin WSS 协议

## Overview / 概览

EN: The client uses the same WSS envelope as traditional LDC sessions. The
server selects the implementation from `driver` and `channel`.

中文：客户端统一使用同一套 WSS envelope。服务器通过 `driver` 和 `channel` 区分走
Garmin sidecar 还是传统 LDC。

- `driver=garmin-sidecar`, `channel=ble-bridge`
  - EN: client owns BLE, backend owns Garmin ML/MLR/GFDI state.
  - 中文：客户端负责 BLE，后端负责 Garmin ML/MLR/GFDI 状态机。
- `driver=ldc`, `channel=serial/usb/mtp/file`
  - EN: backend wraps a normal libdivecomputer-style session.
  - 中文：后端包装普通 libdivecomputer session。

## Session Open / 打开会话

Garmin BLE bridge / Garmin BLE 桥：

```json
{"type":"session.open","sessionId":"watch-1","driver":"garmin-sidecar","channel":"ble-bridge","mtu":20}
```

Traditional LDC / 传统 LDC：

```json
{"type":"session.open","sessionId":"dc-1","driver":"ldc","channel":"serial","transport":{"path":"COM5"}}
```

EN: Legacy Garmin messages are normalized by `device_session_router.js`.

中文：迁移期旧 Garmin 消息会由 `device_session_router.js` 归一化。

```json
{"type":"ble.ready","mtu":20}
{"type":"ble.notify","data":"base64..."}
{"type":"garmin.requestDirectory"}
{"type":"garmin.requestFile","fileIndex":4660,"fileSize":123456}
```

## Client To Backend / 客户端到后端

```json
{"type":"transport.notify","sessionId":"watch-1","data":"base64..."}
{"type":"device.foreach","sessionId":"watch-1"}
{"type":"device.requestFile","sessionId":"watch-1","fileIndex":4660,"fileSize":123456,"dataType":128,"subType":4}
{"type":"device.downloadAllLogs","sessionId":"watch-1"}
{"type":"session.close","sessionId":"watch-1"}
```

EN: For Garmin, `transport.notify` is a BLE notification from the watch.

中文：对 Garmin 来说，`transport.notify` 就是手表发出的 BLE notify 字节。

## Backend To Client / 后端到客户端

```json
{"type":"session.opened","sessionId":"watch-1","driver":"garmin-sidecar","channel":"ble-bridge"}
{"type":"transport.write","sessionId":"watch-1","channel":"ble-bridge","data":"base64..."}
{"type":"device.event","sessionId":"watch-1","event":{"type":1,"service":0,"messageId":0}}
{"type":"device.progress","sessionId":"watch-1","current":1024,"maximum":4096}
{"type":"device.directory","sessionId":"watch-1","format":"garmin-directory","data":"base64..."}
{"type":"device.sync.plan","sessionId":"watch-1","mode":"all-logs","total":12,"queued":3,"skipped":9}
{"type":"device.sync.file","sessionId":"watch-1","mode":"all-logs","file":{"fileIndex":4660,"dataType":128,"subType":4},"remaining":2}
{"type":"device.dive","sessionId":"watch-1","format":"fit","data":"base64..."}
{"type":"device.sync.complete","sessionId":"watch-1","mode":"all-logs","downloaded":3,"skipped":9,"failed":0}
{"type":"device.error","sessionId":"watch-1","message":"..."}
```

EN: The client should only special-case local transport actions.

中文：客户端只需要特殊处理本地传输动作：

- `transport.write`
  - EN: write `data` to the selected Garmin BLE write characteristic.
  - 中文：把 `data` 写入已选 Garmin BLE write characteristic。
- `device.dive`
  - EN: pass completed FIT bytes into the import staging flow.
  - 中文：把完整 FIT bytes 交给导入暂存流程，而不是直接写正式日志。

## Download All Logs / 下载全部日志

EN: `device.downloadAllLogs` asks the sidecar to fetch the Garmin directory,
filter dive activity files, skip files already present in the local sidecar
cache, and download the rest one by one.

中文：`device.downloadAllLogs` 会让 sidecar 先获取 Garmin 目录，再筛选潜水活动
FIT，跳过本地 sidecar 缓存里已经存在的文件，并逐个下载剩余日志。

Current filter:

- `dataType=128`
- `subType=4`
- `fileSize > 0`

This matches the observed `FIT_TYPE_4` activity files from Descent X50i and
Mk3i. The sidecar stores completed FIT files under:

```text
GARMIN_SIDECAR_STORE
```

If `GARMIN_SIDECAR_STORE` is not set, the default is:

```text
.cache/garmin-sidecar
```

Deduplication uses two levels:

- directory key: `fileIndex:dataType:subType:fileNumber:fileSize:garminTime`
- content hash: SHA-256 of completed FIT bytes

EN: The current sidecar core still uses the early GFDI directory model. The
newer probe has already proven the FileSync protobuf multi-profile path; that
logic should be moved into the sidecar core next so `device.downloadAllLogs`
can cover the full no-flags / gb-default listings on real devices.

中文：当前 sidecar 核心仍是早期 GFDI 目录模型。probe 已经跑通更新的
FileSync protobuf 多 profile 路径；下一步要把这部分下沉到 sidecar core，让
`device.downloadAllLogs` 真正在实机上覆盖 no-flags / gb-default 等完整列表。

## Router Integration / Router 接入

```js
import { DeviceSessionRouter } from './device_session_router.js';

const router = new DeviceSessionRouter(socket, {
  createGarminCore: () => createGarminBleCore(Module),
  createLdcSession: (packet) => createLdcSession(packet),
});

socket.on('message', (message) => router.onMessage(message));
```

EN: `wss/garmin_ble_wss_relay.js` is kept as old narrow Garmin-only glue. New
work should use `DeviceSessionRouter`.

中文：`wss/garmin_ble_wss_relay.js` 只是旧的 Garmin-only glue。新工作应使用
`DeviceSessionRouter`。

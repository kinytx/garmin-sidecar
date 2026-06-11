# Garmin Mini-Program UX Notes / Garmin 小程序 UX 说明

## Role Split / 职责划分

EN: The mini-program should not implement Garmin ML/MLR/GFDI. It only bridges
BLE bytes to the backend.

中文：小程序不应实现 Garmin ML/MLR/GFDI，只负责把 BLE 字节桥接到后端。

```text
Garmin watch <BLE> mini-program <WSS> backend Garmin core
```

Mini-program responsibilities / 小程序职责：

- EN: show known Garmin devices and prefer cached direct connect.
  中文：展示已知 Garmin 设备，并优先尝试缓存直连。
- EN: scan/connect Garmin watch when no cached device is available or direct
  connect fails.
  中文：没有已知设备或直连失败时，再扫描并连接 Garmin 手表。
- EN: discover Garmin ML service.
  中文：发现 Garmin ML service。
- EN: select receive/write characteristic pair.
  中文：选择 receive/write characteristic pair。
- EN: enable notify.
  中文：开启 notify。
- EN: forward notify bytes to WSS.
  中文：把 notify 字节转发到 WSS。
- EN: execute `transport.write` bytes from WSS.
  中文：执行 WSS 下发的 `transport.write`。
- EN: display directory, progress and staged FIT results.
  中文：展示目录、进度和暂存 FIT 结果。

Backend responsibilities / 后端职责：

- Garmin ML close/register.
- MLR ACK/framing.
- COBS/GFDI parsing.
- Directory request.
- FIT file request.
- Full-log queue and local FIT deduplication.
- Import staging / 导入暂存。

## Known Device Strategy / 已知设备策略

EN: X50i has been verified to support cached direct connect. The same strategy
is expected for most Garmin BLE/GATT devices, with per-model validation.

中文：X50i 已实测支持缓存直连。大部分 Garmin BLE/GATT 设备预计也能走同样策略，
但兼容表仍逐机型确认。

Mini-program UX should show known Garmin devices even when they are not visible
in the current scan result.

小程序界面应在当前扫描未发现设备时，也显示已知 Garmin 设备。

Recommended states / 推荐状态：

- `known-offline`: 已连接过，当前未扫描到，可尝试直连。
- `visible`: 当前扫描到，可连接。
- `connecting`: 正在连接蓝牙。
- `bridge-ready`: notify 已开启，WSS 已打开。
- `syncing`: 正在读取日志。
- `needs-wake`: 直连失败，请唤醒设备或进入连接/配对页面。

Connection order / 连接顺序：

1. User taps a known Garmin device.
2. Mini-program tries direct BLE connect by cached device id / address if the
   platform allows it.
3. If direct connect fails, start scan and ask the user to wake the device.
4. After connect, discover Garmin ML service and enable notify.
5. Open WSS session and start the bridge.

## BLE Service / BLE 服务

Garmin ML service:

```text
6A4E2800-667B-11E3-949A-0800200C9A66
```

Characteristic pairs / 特征值配对：

```text
receive: 2810..2814
write:   2820..2824
```

EN: The client should pick a matched receive/write pair and keep it in
connection state.

中文：客户端应选择一组匹配的 receive/write pair，并保存在连接状态里。

## UX Flow / UX 流程

1. EN: select known device or scan and connect watch.  
   中文：选择已知设备，或扫描并连接手表。
2. EN: open WSS session with `driver=garmin-sidecar`, `channel=ble-bridge`.  
   中文：打开 WSS 会话，声明 `driver=garmin-sidecar`、`channel=ble-bridge`。
3. EN: show "registering Garmin service" until GFDI ready.  
   中文：显示“正在注册 Garmin 服务”，直到 GFDI ready。
4. EN: request all logs with `device.downloadAllLogs`.  
   中文：发送 `device.downloadAllLogs` 请求全部日志。
5. EN: show sync plan and skipped cached count.  
   中文：展示同步计划和已缓存跳过数量。
6. EN: download queued files one by one.  
   中文：逐个下载待同步文件。
7. EN: show download progress.  
   中文：展示下载进度。
8. EN: when a FIT file completes, send it into the same import staging UX used
   by normal LDC imports.  
   中文：FIT 文件完成后，进入与普通 LDC 导入相同的暂存确认 UX。

## Client Events / 客户端事件

- `transport.write`
  - EN: BLE write required.
  - 中文：需要小程序执行 BLE 写入。
- `device.sync.started`
  - EN: full-log sync has started.
  - 中文：全部日志同步已开始。
- `device.sync.plan`
  - EN: total/queued/skipped counts after directory deduplication.
  - 中文：目录去重后的总数、待下载数、跳过数。
- `device.sync.file`
  - EN: next file is being requested.
  - 中文：正在请求下一条日志文件。
- `device.progress`
  - EN: current/max bytes.
  - 中文：下载进度。
- `device.directory`
  - EN: Garmin directory payload.
  - 中文：Garmin 目录 payload。
- `device.dive`
  - EN: completed FIT bytes.
  - 中文：完整 FIT bytes。
- `device.sync.complete`
  - EN: all queued files finished or were skipped.
  - 中文：队列已完成或全部跳过。
- `device.error`
  - EN: recoverable or fatal error.
  - 中文：可恢复或致命错误。

EN: `device.dive` for Garmin should not directly create a formal log. Feed it
into the import staging API first, then let the user confirm.

中文：Garmin 的 `device.dive` 不应直接创建正式日志。应先进入导入暂存 API，再让用户确认。

## Error Hints / 错误提示

Common recoverable states / 常见可恢复状态：

- EN: known device direct connect failed. 中文：已知设备直连失败。
- EN: watch disconnected. 中文：手表断开。
- EN: notify not enabled. 中文：notify 未开启。
- EN: wrong characteristic pair. 中文：characteristic pair 选错。
- EN: backend session opened but no `transport.write`. 中文：后端会话已开但没有下发 `transport.write`。
- EN: directory returned no ACTIVITY FIT files. 中文：目录里没有 ACTIVITY FIT 文件。
- EN: FIT downloaded but parser/staging failed. 中文：FIT 已下载但解析或暂存失败。

Diagnostics / 诊断信息建议包含：

- service UUID
- receive/write characteristic UUID
- MTU
- known device id / address
- discovery source: cached / scan
- last WSS message type
- last BLE notify length
- last backend error

## Minimal Message Sequence / 最小消息序列

```json
{"type":"session.open","sessionId":"garmin-1","driver":"garmin-sidecar","channel":"ble-bridge","mtu":185}
```

Backend returns one or more BLE writes:

```json
{"type":"transport.write","sessionId":"garmin-1","channel":"ble-bridge","data":"base64..."}
```

Mini-program writes to Garmin, forwards every notify:

```json
{"type":"transport.notify","sessionId":"garmin-1","data":"base64..."}
```

After bridge is ready, request full sync:

```json
{"type":"device.downloadAllLogs","sessionId":"garmin-1"}
```

Expected high-level responses:

```json
{"type":"device.sync.plan","sessionId":"garmin-1","total":12,"queued":3,"skipped":9}
{"type":"device.sync.file","sessionId":"garmin-1","file":{"fileIndex":4660,"dataType":128,"subType":4}}
{"type":"device.dive","sessionId":"garmin-1","format":"fit","isFit":true}
{"type":"device.sync.complete","sessionId":"garmin-1","downloaded":3,"skipped":9,"failed":0}
```

# Garmin / Suunto Device Compatibility

日期：2026-06-11

这份清单用于小程序、sidecar 和后端导入流程对齐。状态只代表 DivePlan 当前验证进度，不代表厂商官方完整兼容声明。

## 状态定义

| 状态 | 含义 | 产品处理 |
| --- | --- | --- |
| 已实测 | 已用真机 / probe 样本验证扫描、GATT、协议或文件下载中的关键路径 | 可进入开发与灰度 |
| 同族待测 | 官方资料显示支持蓝牙 / Garmin Dive / Suunto app，同品牌协议大概率相近，但 DivePlan 尚未真机验证 | UI 可展示为“待验证设备”，不要承诺可导入 |
| 准备适配 | 已确定为近期目标，需要真机、样本或协议接入 | 建立任务与测试入口 |
| 暂不优先 | 有导入路径，但不适合当前小程序 BLE 直连优先级 | 保留文件导入或桌面导入 |

## 已实测设备

| 品牌 | 型号 | 当前结果 | 已拿到数据 | 坐标策略 | 下一步 |
| --- | --- | --- | --- | --- | --- |
| Garmin | Descent X50i | 已验证 BLE / GATT / ML-GFDI v2；已验证缓存设备可主动直连 | `FIT_TYPE_4` 活动 FIT；`FIT_TYPE_8` 位置 FIT | 可信坐标来自 `FIT_TYPE_8` message `29` field `1/2` semicircle | 将 probe 的 FileSync protobuf 多 profile 逻辑下沉到 sidecar core |
| Garmin | Descent Mk3i 51mm | 已验证 BLE / GATT / ML-GFDI v2；已下载活动 FIT 和多类样本文件 | `FIT_TYPE_4` 活动 FIT；`FIT_TYPE_1/2/5/59/60/72/74` 等研究样本；`BACKUP_PRIMARY` ZIP | 当前未发现可信 `FIT_TYPE_8`；`FIT_TYPE_60` 坐标形态字段已被用户排除为个人潜点 | 用同一缓存直连策略继续验证；继续查找可信 GPS 来源 |

## Garmin 同品牌 BLE 待测清单

这些设备按官方资料属于 Descent / Garmin Dive / Bluetooth 生态，优先按 Garmin sidecar 路线评估。X50i 已实测说明“已知设备主动直连”策略可行，其他 Garmin BLE/GATT 设备预期可采用同样 UI 策略，但仍需逐台验证。

| 优先级 | 型号 / 系列 | 预期传输 | 当前判断 | 待验证点 |
| --- | --- | --- | --- | --- |
| P0 | Descent Mk3i 43mm | BLE / Garmin Dive / ML-GFDI 预期 | 与已测 Mk3i 51mm 同代同族 | 产品号、FileSync 列表、缓存直连、是否有 `FIT_TYPE_8` |
| P0 | Descent Mk3 43mm / 51mm | BLE / Garmin Dive / ML-GFDI 预期 | 与 Mk3i 同代，差异主要是空气整合能力 | 产品号、活动 FIT 类型、坐标文件 |
| P1 | Descent G2 | BLE / Garmin Dive | 新一代入门 Descent，官方手册说明可通过 Bluetooth 同步 Garmin Dive | ML-GFDI 是否一致、FileSync profile |
| P1 | Descent G1 / G1 Solar | BLE / Garmin Dive | 官方资料显示可与 Garmin Dive app 通过 Bluetooth 同步 | GATT 服务、协议版本、FIT 类型 |
| P1 | Descent Mk2 / Mk2i / Mk2S | BLE / Garmin Dive / Garmin Connect | 官方手册说明需要通过 Garmin Dive app 配对，连接功能走 Bluetooth | 是否使用同一 ML-GFDI v2；目录与文件请求差异 |
| P2 | Descent Mk1 | Bluetooth 生态待确认 | 老型号，可能与 Mk2/Mk3 协议差异更大 | 是否可走当前 sidecar；是否改走文件导入 |
| P2 | Garmin 非 Descent 但潜水能力型号 | Bluetooth / Garmin app 待确认 | 先不承诺；仅在确认支持 Garmin Dive 潜水日志后纳入 | 设备线、Dive app 兼容性、FIT 字段 |

产品 UI 建议：

- 已连接过的 Garmin 设备默认显示。
- 优先尝试缓存直连。
- 直连失败后提示“请唤醒设备或进入连接/配对页面”，再启动扫描。
- 未实测型号显示“待验证”，避免写成“已支持”。

## Suunto 准备适配清单

Suunto 不默认走 Garmin-style sidecar。第一路线按 LDC / 通用 WSS bridge 评估；新运动手表线先走 Suunto app / FIT 文件导入，缺字段时再考虑 `suunto-sidecar`。

| 优先级 | 型号 / 系列 | 预期路线 | 当前判断 | 待验证点 |
| --- | --- | --- | --- | --- |
| P0 | Suunto D5 | `driver=ldc` + BLE bridge | Suunto 官方说明 D5 可直接通过 Bluetooth 与 Suunto app 同步；本地 LDC 资料列为 USBHID/BLE 族 | 小程序 BLE GATT、LDC 会话、导入字段 |
| P0 | Suunto EON Core | `driver=ldc` + BLE bridge | Suunto 官方说明 EON Core 支持 Bluetooth 同步；本地 LDC 资料列为 USBHID/BLE 族 | 同上 |
| P0 | Suunto EON Steel / EON Steel Black | `driver=ldc` + BLE bridge | Suunto 官方说明 EON Steel/Core/D5 可同步到 Suunto app；EON Steel Black 产品页有无线移动连接 | 同上 |
| P1 | Suunto Ocean | `suunto-fit-file` 优先；必要时 `suunto-sidecar` | 官方当前产品线；更像运动手表 / Suunto app 生态，先不承诺 LDC BLE 直连 | Suunto app 导出 FIT 字段、GPS、潜水曲线完整度 |
| P1 | Suunto Nautic / Nautic S | `suunto-fit-file` 优先；必要时 `suunto-sidecar` | 当前 Suunto 潜水产品线，尚未真机验证 | 是否支持 FIT 导出、是否兼容 LDC / BLE |
| P2 | D4i / D6i / D9 / DX / Vyper / Zoop 等旧款 | LDC / 桌面 / 线缆路径 | Suunto 官方同步说明将其归到“其它设备”，多数不适合小程序 BLE 直连优先 | 是否需要桌面导入、是否存在无线适配器 |

小程序入口建议保持统一：

```json
{
  "type": "startImport",
  "vendor": "Suunto",
  "product": "D5",
  "driver": "ldc",
  "transport": "ble"
}
```

```json
{
  "type": "startImport",
  "vendor": "Suunto",
  "product": "Ocean",
  "driver": "suunto-fit-file",
  "transport": "file"
}
```

## 资料来源

- Garmin Descent X50i product page: https://www.garmin.com/en-US/p/985238/
- Garmin Descent Mk3i 51mm product page: https://www.garmin.com/en-US/p/852159/
- Garmin Descent Mk3i 43mm product page: https://www.garmin.com/en-US/p/852217/
- Garmin Descent Mk3 43mm product page: https://www.garmin.com/en-US/p/852183/
- Garmin Descent G2 product page: https://www.garmin.com/en-US/p/1558977/
- Garmin Descent G1 product page: https://www.garmin.com/en-US/p/766516/
- Garmin Descent Mk2/Mk2s pairing manual: https://www8.garmin.com/manuals/webhelp/GUID-120241CE-9583-49CD-A0BC-8839B887F7CA/EN-US/GUID-E9BE9F99-542F-42DF-9C30-B576E5ADD338.html
- Garmin Descent G2 pairing manual: https://www8.garmin.com/manuals/webhelp/GUID-EA4C028F-6CC0-4957-9BB2-20B2E5DAE9CD/EN-US/GUID-4C14822E-F472-4C3A-B33C-BB50407ADDE5.html
- Suunto dive computers product list: https://us.suunto.com/collections/dive-computers
- Suunto dive-log sync FAQ: https://us.suunto.com/pages/how-do-i-transfer-dive-logs-from-my-dive-computer-to-the-suunto-app
- Suunto D5 / EON / SuuntoLink support: https://us.suunto.com/pages/suunto-dm5-support
- Suunto EON Core product page: https://us.suunto.com/products/suunto-eon-core-black
- Suunto EON Steel Black product page: https://us.suunto.com/products/suunto-eon-steel-black
- DivePlan Suunto notes: `S:\GMP\gas-dive-server\docs\from-miniprogram\suunto-ldc-support-notes.md`

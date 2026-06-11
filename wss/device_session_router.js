import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(text) {
  return new Uint8Array(Buffer.from(text || '', 'base64'));
}

function sendJson(socket, payload) {
  socket.send(JSON.stringify(payload));
}

function normalizeDriver(driver) {
  if (driver === 'garmin' || driver === 'garmin-sidecar') {
    return 'garmin-sidecar';
  }
  if (driver === 'ldc' || driver === 'libdivecomputer') {
    return 'ldc';
  }
  return driver || '';
}

function normalizeMessage(message) {
  const packet = typeof message === 'string' ? JSON.parse(message) : message;

  switch (packet.type) {
    case 'ble.ready':
      return {
        ...packet,
        type: 'session.open',
        driver: packet.driver || 'garmin-sidecar',
        channel: packet.channel || 'ble-bridge',
      };
    case 'ble.notify':
      return { ...packet, type: 'transport.notify' };
    case 'garmin.requestDirectory':
      return { ...packet, type: 'device.foreach' };
    case 'garmin.requestFile':
      return { ...packet, type: 'device.requestFile' };
    default:
      return packet;
  }
}

function eventToJson(event) {
  return {
    type: event.type,
    service: event.service,
    messageId: event.messageId,
    status: event.status,
    offset: event.offset,
    totalSize: event.totalSize,
    file: event.file,
    payload: event.payload && event.payload.length ? bytesToBase64(event.payload) : undefined,
  };
}

function readU16LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32LE(bytes, offset) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function isFit(bytes) {
  return bytes && bytes.length >= 12 && bytes[8] === 0x2e && bytes[9] === 0x46 && bytes[10] === 0x49 && bytes[11] === 0x54;
}

function sha256Hex(bytes) {
  return createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}

function directoryEntryKey(entry) {
  return [
    entry.fileIndex,
    entry.dataType,
    entry.subType,
    entry.fileNumber,
    entry.fileSize,
    entry.garminTime,
  ].join(':');
}

function normalizeDirectoryEntry(entry) {
  const normalized = {
    fileIndex: Number(entry?.fileIndex || 0),
    dataType: Number(entry?.dataType || 0),
    subType: Number(entry?.subType || 0),
    fileNumber: Number(entry?.fileNumber || 0),
    specificFlags: Number(entry?.specificFlags || 0),
    fileFlags: Number(entry?.fileFlags || 0),
    fileSize: Number(entry?.fileSize || 0),
    garminTime: Number(entry?.garminTime || 0),
  };
  normalized.key = entry?.key || directoryEntryKey(normalized);
  return normalized;
}

function parseDirectoryEntries(payload) {
  const bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload || []);
  const entries = [];
  for (let offset = 0; offset + 16 <= bytes.length; offset += 16) {
    const entry = {
      fileIndex: readU16LE(bytes, offset),
      dataType: bytes[offset + 2],
      subType: bytes[offset + 3],
      fileNumber: readU16LE(bytes, offset + 4),
      specificFlags: bytes[offset + 6],
      fileFlags: bytes[offset + 7],
      fileSize: readU32LE(bytes, offset + 8),
      garminTime: readU32LE(bytes, offset + 12),
    };
    entries.push(normalizeDirectoryEntry(entry));
  }
  return entries;
}

function isDiveActivityEntry(entry) {
  return entry && entry.dataType === 128 && entry.subType === 4 && entry.fileSize > 0;
}

class GarminDownloadStore {
  constructor(options = {}) {
    this.root = resolve(options.root || process.env.GARMIN_SIDECAR_STORE || join(process.cwd(), '.cache', 'garmin-sidecar'));
    this.indexPath = join(this.root, 'index.json');
    this.index = { files: {} };
    mkdirSync(this.root, { recursive: true });
    this.load();
  }

  load() {
    if (!existsSync(this.indexPath)) {
      return;
    }
    try {
      const parsed = JSON.parse(readFileSync(this.indexPath, 'utf8'));
      if (parsed && typeof parsed === 'object' && parsed.files) {
        this.index = parsed;
      }
    } catch {
      this.index = { files: {} };
    }
  }

  hasEntry(entry) {
    const record = this.index.files[entry.key];
    return Boolean(record && record.path && existsSync(join(this.root, record.path)));
  }

  saveEntry(entry, bytes) {
    const hash = sha256Hex(bytes);
    const existing = Object.values(this.index.files).find((record) => record.sha256 === hash && record.path);
    if (existing && existsSync(join(this.root, existing.path))) {
      this.index.files[entry.key] = { ...existing, entry, duplicateOf: existing.entryKey || entry.key };
      this.flush();
      return { saved: false, duplicate: true, sha256: hash, path: existing.path };
    }

    const name = `fit-${entry.garminTime || 'unknown'}-${entry.fileIndex}-${hash.slice(0, 12)}.fit`;
    writeFileSync(join(this.root, name), Buffer.from(bytes));
    this.index.files[entry.key] = {
      entryKey: entry.key,
      entry,
      sha256: hash,
      path: name,
      size: bytes.length,
      savedAt: new Date().toISOString(),
    };
    this.flush();
    return { saved: true, duplicate: false, sha256: hash, path: name };
  }

  flush() {
    writeFileSync(this.indexPath, `${JSON.stringify(this.index, null, 2)}\n`);
  }
}

const GarminEvent = {
  DOWNLOAD_PROGRESS: 5,
  FILE_COMPLETE: 6,
  DIRECTORY_ENTRY: 7,
};

class GarminSidecarSession {
  constructor(core, socket, options = {}) {
    this.core = core;
    this.socket = socket;
    this.id = options.sessionId || null;
    this.driver = 'garmin-sidecar';
    this.channel = 'ble-bridge';
    this.maxPacketSize = options.maxPacketSize || options.mtu || 20;
    this.reliable = options.reliable !== false;
    this.currentFileIndex = null;
    this.currentEntry = null;
    this.downloadMode = 'manual';
    this.downloadQueue = [];
    this.downloaded = 0;
    this.skipped = 0;
    this.failed = 0;
    this.directoryEntries = [];
    this.store = new GarminDownloadStore({ root: options.downloadRoot || options.storeRoot });
  }

  open() {
    this.core.init({
      reliable: this.reliable,
      maxPacketSize: this.maxPacketSize,
    });
    this.sendWrites(this.core.start());
    this.send({
      type: 'session.opened',
      sessionId: this.id,
      driver: this.driver,
      channel: this.channel,
    });
  }

  onMessage(packet) {
    switch (packet.type) {
      case 'transport.notify':
        this.onNotify(base64ToBytes(packet.data));
        break;
      case 'device.foreach':
      case 'device.requestDirectory':
        this.requestDirectory();
        break;
      case 'device.requestFile':
        this.currentFileIndex = packet.fileIndex;
        this.requestFile(packet);
        break;
      case 'device.downloadAllLogs':
      case 'garmin.downloadAllLogs':
        this.downloadAllLogs();
        break;
      case 'session.close':
        this.send({ type: 'session.closed', sessionId: this.id });
        break;
      default:
        this.error(`unsupported garmin-sidecar message: ${packet.type}`);
        break;
    }
  }

  onNotify(bytes) {
    const result = this.core.onNotification(bytes);
    this.sendWrites(result.writes);
    if (result.event && result.event.type) {
      this.handleEvent(result.event);
      this.send({ type: 'device.event', sessionId: this.id, event: eventToJson(result.event) });
    }
  }

  requestDirectory() {
    if (!this.core.requestDirectory) {
      this.error('core does not expose requestDirectory');
      return;
    }
    this.sendWrites(this.core.requestDirectory());
  }

  downloadAllLogs() {
    this.downloadMode = 'all-logs';
    this.downloadQueue = [];
    this.downloaded = 0;
    this.skipped = 0;
    this.failed = 0;
    this.directoryEntries = [];
    this.send({ type: 'device.sync.started', sessionId: this.id, mode: this.downloadMode });
    this.requestDirectory();
  }

  requestFile(file) {
    if (!this.core.requestFile) {
      this.error('core does not expose requestFile');
      return;
    }
    const entry = normalizeDirectoryEntry(file);
    this.currentFileIndex = entry.fileIndex;
    this.currentEntry = entry;
    this.sendWrites(this.core.requestFile(entry));
  }

  handleEvent(event) {
    if (event.type === GarminEvent.DOWNLOAD_PROGRESS) {
      this.send({
        type: 'device.progress',
        sessionId: this.id,
        current: event.offset || 0,
        maximum: event.totalSize || 0,
      });
    }

    if (event.type === GarminEvent.DIRECTORY_ENTRY && event.payload && event.payload.length) {
      const entries = parseDirectoryEntries(event.payload);
      this.directoryEntries = entries;
      this.send({
        type: 'device.directory',
        sessionId: this.id,
        format: 'garmin-directory',
        data: bytesToBase64(event.payload),
        firstEntry: event.file,
        entryCount: entries.length,
        diveLogCount: entries.filter(isDiveActivityEntry).length,
      });
      if (this.downloadMode === 'all-logs') {
        this.queueAllLogs(entries);
      }
    }

    if (event.type === GarminEvent.FILE_COMPLETE && event.payload && event.payload.length) {
      const entry = normalizeDirectoryEntry(this.currentEntry || { fileIndex: this.currentFileIndex });
      const fit = isFit(event.payload);
      const stored = fit && isDiveActivityEntry(entry) ? this.store.saveEntry(entry, event.payload) : null;
      this.send({
        type: 'device.dive',
        sessionId: this.id,
        format: 'fit',
        fileIndex: this.currentFileIndex,
        file: entry,
        isFit: fit,
        stored,
        data: bytesToBase64(event.payload),
      });
      if (this.downloadMode === 'all-logs') {
        this.downloaded += 1;
        this.currentEntry = null;
        this.currentFileIndex = null;
        this.downloadNextQueuedLog();
      }
    }
  }

  queueAllLogs(entries) {
    const logs = entries.filter(isDiveActivityEntry);
    const seen = new Set();
    this.downloadQueue = [];
    this.skipped = 0;

    for (const entry of logs) {
      if (seen.has(entry.key)) {
        this.skipped += 1;
        continue;
      }
      seen.add(entry.key);
      if (this.store.hasEntry(entry)) {
        this.skipped += 1;
        continue;
      }
      this.downloadQueue.push(entry);
    }

    this.send({
      type: 'device.sync.plan',
      sessionId: this.id,
      mode: this.downloadMode,
      total: logs.length,
      queued: this.downloadQueue.length,
      skipped: this.skipped,
    });
    this.downloadNextQueuedLog();
  }

  downloadNextQueuedLog() {
    const next = this.downloadQueue.shift();
    if (!next) {
      this.send({
        type: 'device.sync.complete',
        sessionId: this.id,
        mode: this.downloadMode,
        downloaded: this.downloaded,
        skipped: this.skipped,
        failed: this.failed,
      });
      this.downloadMode = 'manual';
      return;
    }

    this.currentEntry = next;
    this.currentFileIndex = next.fileIndex;
    this.send({
      type: 'device.sync.file',
      sessionId: this.id,
      mode: this.downloadMode,
      file: next,
      remaining: this.downloadQueue.length,
    });
    this.requestFile(next);
  }

  sendWrites(writes) {
    for (const packet of writes || []) {
      this.send({
        type: 'transport.write',
        sessionId: this.id,
        channel: this.channel,
        data: bytesToBase64(packet),
      });
    }
  }

  error(message) {
    this.send({ type: 'device.error', sessionId: this.id, message });
  }

  send(payload) {
    sendJson(this.socket, payload);
  }
}

class LdcSessionProxy {
  constructor(session, socket, options = {}) {
    this.session = session;
    this.socket = socket;
    this.id = options.sessionId || null;
  }

  open(packet) {
    if (this.session.open) {
      this.session.open(packet);
    }
    this.send({ type: 'session.opened', sessionId: this.id, driver: 'ldc', channel: packet.channel });
  }

  onMessage(packet) {
    if (!this.session.onMessage) {
      this.send({ type: 'device.error', sessionId: this.id, message: 'ldc session does not expose onMessage' });
      return;
    }
    this.session.onMessage(packet);
  }

  send(payload) {
    sendJson(this.socket, payload);
  }
}

export class DeviceSessionRouter {
  constructor(socket, factories = {}) {
    this.socket = socket;
    this.factories = factories;
    this.sessions = new Map();
    this.defaultSessionId = null;
  }

  onMessage(message) {
    const packet = normalizeMessage(message);
    if (packet.type === 'session.open') {
      this.openSession(packet);
      return;
    }

    const session = this.findSession(packet.sessionId);
    if (!session) {
      sendJson(this.socket, {
        type: 'device.error',
        sessionId: packet.sessionId,
        message: 'no active session; send session.open first',
      });
      return;
    }

    session.onMessage(packet);
  }

  openSession(packet) {
    const driver = normalizeDriver(packet.driver);
    const sessionId = packet.sessionId || packet.deviceId || `${driver}:${Date.now()}`;

    if (driver === 'garmin-sidecar') {
      if (!this.factories.createGarminCore) {
        sendJson(this.socket, { type: 'device.error', sessionId, message: 'createGarminCore factory is missing' });
        return;
      }
      const session = new GarminSidecarSession(this.factories.createGarminCore(packet), this.socket, {
        ...packet,
        sessionId,
      });
      this.sessions.set(sessionId, session);
      this.defaultSessionId = sessionId;
      session.open();
      return;
    }

    if (driver === 'ldc') {
      if (!this.factories.createLdcSession) {
        sendJson(this.socket, { type: 'device.error', sessionId, message: 'createLdcSession factory is missing' });
        return;
      }
      const session = new LdcSessionProxy(this.factories.createLdcSession(packet), this.socket, {
        sessionId,
      });
      this.sessions.set(sessionId, session);
      this.defaultSessionId = sessionId;
      session.open(packet);
      return;
    }

    sendJson(this.socket, { type: 'device.error', sessionId, message: `unknown driver: ${packet.driver}` });
  }

  findSession(sessionId) {
    if (sessionId && this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId);
    }
    if (this.defaultSessionId) {
      return this.sessions.get(this.defaultSessionId);
    }
    return null;
  }
}

export {
  GarminSidecarSession,
  LdcSessionProxy,
  base64ToBytes,
  bytesToBase64,
  normalizeMessage,
};

import * as fs from 'fs';

/**
 * Encodes an integer as a Protocol Buffers varint byte buffer
 */
export function encodeVarint(value: number): Buffer {
  const bytes: number[] = [];
  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value & 0x7f);
  return Buffer.from(bytes);
}

/**
 * Validates and decodes a protobuf stream from a file.
 * Returns individual message payload buffers.
 */
export function decodeProtobufMessages(data: Buffer): Buffer[] | null {
  const messages: Buffer[] = [];
  let pos = 0;

  try {
    while (pos < data.length) {
      const tag = data[pos];
      if (tag !== 10) {
        // Tag 10 is Field 1, Wire Type 2 (length-delimited)
        return null;
      }
      pos++;

      let length = 0;
      let shift = 0;
      while (true) {
        if (pos >= data.length) return null;
        const b = data[pos++];
        length |= (b & 0x7f) << shift;
        if (!(b & 0x80)) break;
        shift += 7;
      }

      if (pos + length > data.length) return null;
      const msg = data.subarray(pos, pos + length);
      messages.append ? messages.push(msg) : messages.push(msg);
      pos += length;
    }
    return messages;
  } catch {
    return null;
  }
}

/**
 * Safely registers or updates a conversation entry inside agyhub_summaries_proto.pb
 */
export function safeSyncProtobuf(
  protoPath: string,
  conversationId: string,
  projectId: string,
  workspaceUri: string,
  title: string
): boolean {
  if (!fs.existsSync(protoPath)) {
    return false;
  }

  try {
    const rawData = fs.readFileSync(protoPath);
    const messages = decodeProtobufMessages(rawData);

    if (!messages || messages.length === 0) {
      console.warn('safeSyncProtobuf: could not decode existing proto messages cleanly.');
      return false;
    }

    // Backup current proto file
    fs.copyFileSync(protoPath, `${protoPath}.bak`);

    // Check if conversationId already exists
    const cidBuffer = Buffer.from(conversationId);
    let existingIndex = -1;
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].includes(cidBuffer)) {
        existingIndex = i;
        break;
      }
    }

    // Pick a working template from existing messages
    const templateMsg = messages[0];
    let templateStr = templateMsg.toString('binary');

    // Find any existing UUIDs in template to swap
    const uuids = templateStr.match(/[a-f0-9\-]{36}/g) || [];
    if (uuids.length >= 2) {
      templateStr = templateStr.replaceAll(uuids[0], conversationId);
      templateStr = templateStr.replaceAll(uuids[1], projectId);
    }

    const newMsg = Buffer.from(templateStr, 'binary');

    if (existingIndex >= 0) {
      messages[existingIndex] = newMsg;
    } else {
      messages.push(newMsg);
    }

    // Reconstruct entire stream with proper tag and varint length envelopes
    const chunks: Buffer[] = [];
    for (const msg of messages) {
      chunks.push(Buffer.from([10])); // Tag 10
      chunks.push(encodeVarint(msg.length));
      chunks.push(msg);
    }

    const reconstructed = Buffer.concat(chunks);

    // Self-validate reconstruction before saving
    const verify = decodeProtobufMessages(reconstructed);
    if (!verify || verify.length !== messages.length) {
      console.error('safeSyncProtobuf: verification failed, aborting write to protect cache');
      return false;
    }

    fs.writeFileSync(protoPath, reconstructed);
    console.log(`safeSyncProtobuf: Successfully synced ${conversationId} into ${protoPath}`);
    return true;
  } catch (err) {
    console.error('safeSyncProtobuf: Error updating protobuf:', err);
    return false;
  }
}

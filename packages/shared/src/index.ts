/**
 * Maximum number of participants allowed in a single meeting.
 * Enforced server-side on join-room.
 */
export const MAX_PARTICIPANTS = 10;

/**
 * A meeting code in the format abc-defg-hij.
 * Generated server-side using nanoid.
 */
export type MeetingCode = string;

/**
 * A participant in a meeting room.
 * Used in room-joined and peer-joined signaling messages.
 */
export interface Participant {
  peerId: string;
  displayName: string;
}

/**
 * Base ping message sent from client to server to verify connection.
 */
export interface PingMessage {
  type: "ping";
  timestamp?: number;
}

/**
 * Base acknowledgment message sent from server to client.
 */
export interface AckMessage {
  type: "ack";
  timestamp?: number;
}

/**
 * Generic socket message type.
 */
export type SocketMessage =
  PingMessage | AckMessage | { type: string; [key: string]: unknown };

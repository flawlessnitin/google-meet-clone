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

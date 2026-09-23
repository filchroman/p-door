import type { HostClock } from '@vakhta/host';
import type { MatchSettings, Me } from '@vakhta/protocol';
import { Room } from './Room';

/** Алфавит кода без похожих символов (0/O, 1/I/L): код диктуют вслух и набирают с телефона. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;
/** Пустая комната живёт ещё столько — вдруг все переподключаются. */
export const EMPTY_ROOM_TTL_MS = 30 * 60_000;

/** Комнаты в памяти (`RoomStore` спеки): для игры с друзьями этого достаточно, Redis — потом. */
export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly emptySince = new Map<string, unknown>();

  constructor(
    private readonly clock: HostClock,
    private readonly random: () => number = Math.random,
  ) {}

  create(creator: Me, settings: MatchSettings, playerCount: number): Room {
    let code = this.newCode();
    while (this.rooms.has(code)) code = this.newCode();
    const room = new Room(code, creator, settings, playerCount, this.clock, this.random);
    this.rooms.set(code, room);
    room.subscribe((event) => {
      if (event.type === 'left' || event.type === 'room') this.watchEmpty(room);
    });
    return room;
  }

  get(code: string): Room | null {
    return this.rooms.get(code.trim().toUpperCase()) ?? null;
  }

  /** Комната, где сейчас сидит игрок (одновременно он может быть только в одной). */
  roomOf(id: string): Room | null {
    for (const room of this.rooms.values()) if (room.members.has(id)) return room;
    return null;
  }

  delete(code: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    room.dispose();
    this.rooms.delete(code);
    const timer = this.emptySince.get(code);
    if (timer !== undefined) this.clock.clearTimeout(timer);
    this.emptySince.delete(code);
  }

  size(): number {
    return this.rooms.size;
  }

  private newCode(): string {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(this.random() * CODE_ALPHABET.length)];
    return code;
  }

  private watchEmpty(room: Room): void {
    const timer = this.emptySince.get(room.code);
    if (room.isEmpty()) {
      if (timer === undefined) this.emptySince.set(room.code, this.clock.setTimeout(() => this.delete(room.code), EMPTY_ROOM_TTL_MS));
    } else if (timer !== undefined) {
      this.clock.clearTimeout(timer);
      this.emptySince.delete(room.code);
    }
  }
}

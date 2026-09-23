import type { ErrorCode, PlayerId } from '@vakhta/engine';
import type { LocalHost } from '@vakhta/host';
import type { DebugControls } from './debug';
import type { AppClient, ClientUpdate, Intent } from './types';

export class LocalGameClient implements AppClient {
  readonly debug: DebugControls;
  private meId: PlayerId;
  private lastSeq = -1;
  private readonly listeners = new Set<(update: ClientUpdate) => void>();
  private readonly errorListeners = new Set<(code: ErrorCode) => void>();
  private readonly unsubscribeHost: () => void;

  constructor(private readonly host: LocalHost, me: PlayerId) {
    this.meId = me;
    this.unsubscribeHost = host.subscribe(() => this.publish());
    this.debug = {
      playAs: (id) => {
        this.meId = id;
        host.setHumanSeat(id);
      },
      setBotSpeed: (speed) => host.setBotSpeed(speed),
      setAutopilot: (on) => host.setAutopilot(on),
      allHands: () => host.getHands(),
      log: () => host.getLog(),
    };
  }

  me(): PlayerId {
    return this.meId;
  }

  subscribe(listener: (update: ClientUpdate) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  onError(listener: (code: ErrorCode) => void): () => void {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  send(intent: Intent): void {
    const result = this.host.act(this.meId, intent);
    if (!result.ok) for (const listener of [...this.errorListeners]) listener(result.error);
  }

  nextGame(): void {
    this.host.nextGame();
  }

  endSession(): void {
    this.host.endSession();
  }

  /** Срез для текущего «я»; события — только если с прошлого среза было новое изменение. */
  snapshot(): ClientUpdate | null {
    const view = this.host.viewFor(this.meId);
    if (!view) return null;
    const seq = this.host.getChangeSeq();
    const events = seq !== this.lastSeq ? this.host.getLastEvents() : [];
    this.lastSeq = seq;
    return {
      view,
      events,
      session: this.host.getSummary(),
      players: this.host.getSeats(),
      deadlines: this.host.getDeadlines(),
    };
  }

  dispose(): void {
    this.unsubscribeHost();
    this.host.dispose();
    this.listeners.clear();
    this.errorListeners.clear();
  }

  private publish(): void {
    const update = this.snapshot();
    if (!update) return;
    for (const listener of [...this.listeners]) listener(update);
  }
}

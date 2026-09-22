import { LocalHost, type HostOptions } from '../host/LocalHost';
import type { MatchSettings } from '../host/types';
import { LocalGameClient } from './LocalGameClient';
import { makeSeats } from './seats';

export interface MatchSetup {
  nick: string;
  playerCount: number;
  settings: MatchSettings;
}

export function createLocalMatch(setup: MatchSetup, options: Omit<HostOptions, 'seats' | 'settings'> = {}): LocalGameClient {
  const seats = makeSeats(setup.nick, setup.playerCount);
  const host = new LocalHost({ ...options, seats, settings: setup.settings });
  host.start();
  return new LocalGameClient(host, seats[0].id);
}

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import { realClock } from '@vakhta/host';
import Fastify, { type FastifyInstance } from 'fastify';
import { RoomManager } from './rooms/RoomManager';
import { Gateway } from './ws';

export interface AppConfig {
  botToken: string;
  botUsername: string;
  appShortName: string;
  /** Папка со сборкой веб-клиента; пусто — статику не раздаём (тесты). */
  webDist: string;
}

const FALLBACK_AVATARS = ['🙂', '😎', '🤠', '🧐', '🥸', '😺', '🐯', '🦁'];

/** Эмодзи-заглушка по id: у одного игрока всегда одна и та же. */
export function fallbackAvatar(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK_AVATARS[hash % FALLBACK_AVATARS.length];
}

/** Где лежит собранный веб-клиент: рядом в монорепозитории или в образе Docker. */
export function defaultWebDist(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [resolve(here, '../../web/dist'), resolve(here, '../../../web/dist'), resolve(here, '../web/dist')]) {
    if (existsSync(join(candidate, 'index.html'))) return candidate;
  }
  return '';
}

export interface BuiltApp {
  app: FastifyInstance;
  rooms: RoomManager;
  gateway: Gateway;
}

export function buildApp(config: AppConfig): BuiltApp {
  const app = Fastify({ logger: false });
  const rooms = new RoomManager(realClock);
  const gateway = new Gateway(app.server, {
    rooms,
    botToken: config.botToken,
    fallbackName: 'Игрок',
    fallbackAvatar,
  });

  app.get('/healthz', async () => ({ ok: true, rooms: rooms.size() }));
  // Клиенту нужны имя бота и короткое имя приложения, чтобы собрать ссылку-приглашение.
  app.get('/config.json', async () => ({ botUsername: config.botUsername, appShortName: config.appShortName }));

  if (config.webDist) {
    void app.register(fastifyStatic, { root: config.webDist, wildcard: false });
    // Ссылки вида /r/K7PQ — тот же клиент: код комнаты он прочитает из адреса.
    app.get('/r/:code', (_request, reply) => reply.sendFile('index.html'));
    app.setNotFoundHandler((_request, reply) => reply.sendFile('index.html'));
  }

  app.addHook('onClose', async () => gateway.close());
  return { app, rooms, gateway };
}

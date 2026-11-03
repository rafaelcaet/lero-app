import * as Phaser from "phaser";
import type { ServerMessage } from "@/shared/protocol";
import type { Session } from "@/session/Session";
import { characterTextureKey } from "../characters/characterSprites";
import {
  ASSET_KEYS,
  CAMERA_ZOOM,
  DEFAULT_SPAWN,
  LAYER_NAMES,
  SCENE_KEYS,
  TILE_SIZE,
  TILESET_NAME,
} from "../constants";
import { FEET_OFFSET_Y } from "../entities/Character";
import { Player } from "../entities/Player";
import { RemotePlayer } from "../entities/RemotePlayer";
import { createOfficeLayout, type Grid } from "../maps/officeLayout";
import { getSession } from "../registry";
import { FollowPlayer } from "../systems/FollowPlayer";
import { SeatInteraction } from "../systems/SeatInteraction";

export interface GameSceneData {
  /** Posição inicial em tiles. Se estiver bloqueada, usa o tile livre mais próximo. */
  spawn?: { tileX: number; tileY: number };
}

interface OfficeMap {
  map: Phaser.Tilemaps.Tilemap;
  collisionLayer: Phaser.Tilemaps.TilemapLayer;
}

/** Intervalo mínimo entre envios de posição enquanto anda. */
const MOVE_SEND_INTERVAL_MS = 60;
/** Espalha quem entra ao redor do spawn para não nascerem empilhados. */
const SPAWN_SPREAD_TILES = 2;

/** Gerencia o mapa, as colisões, a câmera e as entidades. */
export class GameScene extends Phaser.Scene {
  private player?: Player;
  private seats?: SeatInteraction;
  private follow?: FollowPlayer;
  private session?: Session;
  private readonly remotes = new Map<string, RemotePlayer>();
  private unsubscribers: Array<() => void> = [];
  private spawn: { tileX: number; tileY: number } = DEFAULT_SPAWN;
  private lastSent = { x: 0, y: 0, facing: "", anim: "", at: 0 };

  constructor() {
    super(SCENE_KEYS.game);
  }

  init(data: GameSceneData) {
    this.spawn = data.spawn ?? DEFAULT_SPAWN;
  }

  create() {
    const session = getSession(this);
    this.session = session;
    const { map, collisionLayer } = this.createMap();

    const worldWidth = map.widthInPixels;
    const worldHeight = map.heightInPixels;
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    const spread = () => Phaser.Math.Between(-SPAWN_SPREAD_TILES, SPAWN_SPREAD_TILES);
    const spawnTile = this.findFreeTile(
      collisionLayer,
      this.spawn.tileX + spread(),
      this.spawn.tileY + spread(),
    );
    this.player = new Player(this, {
      x: map.tileToWorldX(spawnTile.x)! + TILE_SIZE / 2,
      // Desloca para cima para que a hitbox (nos pés) fique dentro do tile.
      y: map.tileToWorldY(spawnTile.y)! + TILE_SIZE / 2 + FEET_OFFSET_Y,
      textureKey: characterTextureKey(0),
      name: session.name,
    });

    this.physics.add.collider(this.player, collisionLayer);
    this.seats = new SeatInteraction(this, this.player, session);
    this.follow = new FollowPlayer(this.player, collisionLayer, session, this.seats, (id) =>
      this.remotes.get(id),
    );

    const camera = this.cameras.main;
    camera.setBounds(0, 0, worldWidth, worldHeight);
    camera.setZoom(CAMERA_ZOOM);
    camera.setRoundPixels(true);
    camera.startFollow(this.player, true, 0.15, 0.15);
    camera.setBackgroundColor("#1b1d27");

    this.unsubscribers = [
      session.events.on("message", (msg) => this.handleServerMessage(msg)),
      session.events.on("status", (status) => {
        if (status !== "open") this.clearRemotes();
      }),
    ];
    // A sessão pode ter recebido o "welcome" antes desta cena existir.
    this.syncRemotesFromState();
    session.join(this.player.x, this.player.y);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  update(time: number, delta: number) {
    const player = this.player;
    if (!player || !this.seats || !this.follow) return;

    this.follow.beforeUpdate();
    const locked = this.seats.update();
    if (!locked && !this.follow.update(time, delta)) {
      const { dx, dy } = player.readDirection();
      player.move(dx, dy);
    }
    if (!player.seat) this.sendMovement(time);
  }

  private sendMovement(time: number) {
    const player = this.player!;
    const x = Math.round(player.x);
    const y = Math.round(player.y);
    const { facing } = player;
    const anim = player.animState === "walk" ? "walk" : "idle";
    const last = this.lastSent;

    const poseChanged = facing !== last.facing || anim !== last.anim;
    const moved = x !== last.x || y !== last.y;
    if (!poseChanged && !(moved && time - last.at >= MOVE_SEND_INTERVAL_MS)) return;

    this.session?.sendMove(x, y, facing, anim);
    this.lastSent = { x, y, facing, anim, at: time };
  }

  // --- jogadores remotos ---------------------------------------------------

  private handleServerMessage(msg: ServerMessage) {
    switch (msg.type) {
      case "welcome":
        this.syncRemotesFromState();
        // Força reenviar a pose atual para quem já estava na sala.
        this.lastSent = { x: -1, y: -1, facing: "", anim: "", at: 0 };
        break;
      case "player-joined":
        this.addRemote(msg.player.id);
        break;
      case "player-left":
        this.remotes.get(msg.id)?.destroy();
        this.remotes.delete(msg.id);
        break;
      case "player-moved":
        this.remotes.get(msg.id)?.applyMove(msg.x, msg.y, msg.facing, msg.anim);
        break;
      case "player-seated":
        this.remotes.get(msg.id)?.applySeat(msg.seatId);
        break;
    }
  }

  private syncRemotesFromState() {
    const state = this.session?.getState();
    this.clearRemotes();
    if (!state?.selfId) return;
    const self = state.players[state.selfId];
    if (self) this.player?.setSkin(characterTextureKey(self.colorIndex));
    for (const id of Object.keys(state.players)) this.addRemote(id);
  }

  private addRemote(id: string) {
    const state = this.session?.getState();
    const player = state?.players[id];
    if (!player || id === state.selfId || this.remotes.has(id)) return;
    this.remotes.set(id, new RemotePlayer(this, player));
  }

  private clearRemotes() {
    for (const remote of this.remotes.values()) remote.destroy();
    this.remotes.clear();
  }

  /** Usa o JSON do Tiled se carregado; caso contrário, monta o mapa em código. */
  private createMap(): OfficeMap {
    return this.cache.tilemap.exists(ASSET_KEYS.officeMap)
      ? this.createTiledMap()
      : this.createProceduralMap();
  }

  private createTiledMap(): OfficeMap {
    const map = this.make.tilemap({ key: ASSET_KEYS.officeMap });
    const tileset = map.addTilesetImage(TILESET_NAME, ASSET_KEYS.tileset);
    if (!tileset) throw new Error(`Tileset "${TILESET_NAME}" não encontrado no mapa`);

    const layer = (name: string) => {
      const created = map.createLayer(name, tileset, 0, 0);
      if (!created) throw new Error(`Camada "${name}" não encontrada no mapa`);
      return created;
    };

    layer(LAYER_NAMES.ground);
    layer(LAYER_NAMES.walls);
    layer(LAYER_NAMES.objects);
    const collisionLayer = layer(LAYER_NAMES.collisions);
    return this.finishCollisionLayer(map, collisionLayer);
  }

  private createProceduralMap(): OfficeMap {
    const layout = createOfficeLayout();
    const map = this.make.tilemap({
      width: layout.width,
      height: layout.height,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    // gid = 1 para usar os mesmos IDs do Tiled (frame = gid - 1).
    const tileset = map.addTilesetImage(
      TILESET_NAME,
      ASSET_KEYS.tileset,
      TILE_SIZE,
      TILE_SIZE,
      0,
      0,
      1,
    );
    if (!tileset) throw new Error("Falha ao criar tileset provisório");

    const layer = (name: string, data: Grid) => {
      const created = map.createBlankLayer(name, tileset);
      if (!created) throw new Error(`Falha ao criar camada "${name}"`);
      created.putTilesAt(
        data.map((row) => row.map((gid) => (gid === 0 ? -1 : gid))),
        0,
        0,
      );
      return created;
    };

    layer(LAYER_NAMES.ground, layout.ground);
    layer(LAYER_NAMES.walls, layout.walls);
    layer(LAYER_NAMES.objects, layout.objects);
    const collisionLayer = layer(LAYER_NAMES.collisions, layout.collisions);
    return this.finishCollisionLayer(map, collisionLayer);
  }

  private finishCollisionLayer(
    map: Phaser.Tilemaps.Tilemap,
    collisionLayer: Phaser.Tilemaps.TilemapLayer,
  ): OfficeMap {
    collisionLayer.setCollisionByExclusion([-1]);
    collisionLayer.setVisible(false);
    return { map, collisionLayer };
  }

  /** Busca em largura pelo tile livre mais próximo da posição desejada. */
  private findFreeTile(layer: Phaser.Tilemaps.TilemapLayer, startX: number, startY: number) {
    const { width, height } = layer.layer;
    const clampX = Phaser.Math.Clamp(startX, 0, width - 1);
    const clampY = Phaser.Math.Clamp(startY, 0, height - 1);
    const isFree = (x: number, y: number) => {
      const tile = layer.getTileAt(x, y);
      return !tile || !tile.collides;
    };

    const visited = new Set<string>();
    const queue: Array<{ x: number; y: number }> = [{ x: clampX, y: clampY }];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const id = `${current.x},${current.y}`;
      if (visited.has(id)) continue;
      visited.add(id);
      if (isFree(current.x, current.y)) return current;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height) queue.push({ x: nx, y: ny });
      }
    }
    throw new Error("Nenhum tile livre encontrado para o spawn");
  }

  private handleShutdown() {
    this.unsubscribers.forEach((off) => off());
    this.unsubscribers = [];
    this.seats?.destroy();
    this.seats = undefined;
    this.follow = undefined;
    this.clearRemotes();
    this.player?.destroy();
    this.player = undefined;
  }
}

import * as Phaser from "phaser";
import { ASSET_KEYS, SCENE_KEYS } from "../constants";
import { generatePlaceholderTextures } from "../graphics/generateTextures";

/** Carrega o mapa do Tiled e prepara as texturas antes de iniciar o jogo. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  preload() {
    // Se o JSON não existir/falhar, a GameScene usa o mapa programático.
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(`[BootScene] Falha ao carregar ${file.key}; usando mapa provisório.`);
    });
    this.load.tilemapTiledJSON(ASSET_KEYS.officeMap, "/assets/maps/office.json");
  }

  create() {
    this.load.removeAllListeners(Phaser.Loader.Events.FILE_LOAD_ERROR);
    generatePlaceholderTextures(this);
    this.scene.start(SCENE_KEYS.game);
  }
}

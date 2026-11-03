/** Converte o layout do escritório para o formato JSON do Tiled (orthogonal). */
import { LAYER_NAMES, TILE_SIZE, TILESET_NAME } from "../constants.ts";
import type { Grid, OfficeLayout } from "./officeLayout.ts";
import { TILESET_TILE_COUNT } from "./tiles.ts";

function tileLayer(id: number, name: string, g: Grid, visible = true) {
  return {
    id,
    name,
    type: "tilelayer",
    width: g[0].length,
    height: g.length,
    x: 0,
    y: 0,
    opacity: 1,
    visible,
    data: g.flat(),
  };
}

export function toTiledJson(layout: OfficeLayout) {
  return {
    type: "map",
    version: "1.10",
    tiledversion: "1.10.2",
    orientation: "orthogonal",
    renderorder: "right-down",
    infinite: false,
    width: layout.width,
    height: layout.height,
    tilewidth: TILE_SIZE,
    tileheight: TILE_SIZE,
    nextlayerid: 5,
    nextobjectid: 1,
    layers: [
      tileLayer(1, LAYER_NAMES.ground, layout.ground),
      tileLayer(2, LAYER_NAMES.walls, layout.walls),
      tileLayer(3, LAYER_NAMES.objects, layout.objects),
      tileLayer(4, LAYER_NAMES.collisions, layout.collisions, false),
    ],
    tilesets: [
      {
        firstgid: 1,
        name: TILESET_NAME,
        image: "../tilesets/office-tiles.png",
        imagewidth: TILE_SIZE * TILESET_TILE_COUNT,
        imageheight: TILE_SIZE,
        tilewidth: TILE_SIZE,
        tileheight: TILE_SIZE,
        tilecount: TILESET_TILE_COUNT,
        columns: TILESET_TILE_COUNT,
        margin: 0,
        spacing: 0,
      },
    ],
  };
}

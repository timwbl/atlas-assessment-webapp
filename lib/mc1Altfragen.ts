const J2_MC1_BLOCKS = ["j2-block1", "j2-block2", "j2-block3"] as const;

export const MC1_CATALOGS = [
  { id: "altfragen_j2_mc1_block_1", count: 39, blocks: [J2_MC1_BLOCKS[0]] },
  { id: "altfragen_j2_mc1_block_2", count: 47, blocks: [J2_MC1_BLOCKS[1]] },
  { id: "altfragen_j2_mc1_block_3", count: 21, blocks: [J2_MC1_BLOCKS[2]] },
  { id: "altfragen_j2_mc1_querschnitt", count: 8, blocks: J2_MC1_BLOCKS },
  { id: "altfragen_j2_mc1_mischserie_a", count: 35, blocks: J2_MC1_BLOCKS },
  { id: "altfragen_j2_mc1_mischserie_b", count: 35, blocks: J2_MC1_BLOCKS },
] as const;

export function mc1Catalog(id: string) {
  return MC1_CATALOGS.find((catalog) => catalog.id === id);
}

export function mc1CatalogBlockLabel(id: string): string | undefined {
  const catalog = mc1Catalog(id);
  if (catalog) return catalog.blocks.length === 1 ? `Block ${catalog.blocks[0].slice(-1)}` : "Blöcke 1–3";
}

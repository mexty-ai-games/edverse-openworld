// The Biome Frontier's props sub-tree (key `biomeFrontier` in the game's props). Every learner-facing
// word is a LocalizedText {en, fr}; every model / texture / sound is a URL prop.
// The interfaces live in src/block.tsx (the props schema parser only reads that file).
export type {
  Biome,
  Fossil,
  BiomeUi,
  BiomeModels,
  BiomeTextures,
  BiomeSounds,
  BiomeFrontierProps,
} from "../../block";

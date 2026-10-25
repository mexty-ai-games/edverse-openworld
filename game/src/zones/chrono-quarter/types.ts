// Props of the Chrono Quarter district (the `chronoQuarter` sub-tree of the game's props).
// Every learner-facing word is a LocalizedText {en, fr}; every model / texture / sound is a URL prop.
// The interfaces live in src/block.tsx (the props schema parser only reads that file).
export type {
  CqEra,
  CqArtifact,
  CqUi,
  CqModels,
  CqTextures,
  CqSounds,
  ChronoQuarterProps,
} from "../../block";

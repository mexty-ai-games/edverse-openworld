// Skyharbor's props sub-tree (props key `skyharbor`). Every learner-facing word is a LocalizedText,
// every model / texture / sound is a URL prop, and the courier levels and planets are data.
// The interfaces live in src/block.tsx (the props schema parser only reads that file).
export type {
  SkyharborModels,
  SkyharborTextures,
  SkyharborSounds,
  CourierLevel,
  Planet,
  InfoSpot,
  SkyharborUi,
  SkyharborProps,
  SkyharborOpen,
} from "../../block";

export type { LocalizedText } from "../../block";

export const KIND_ROBOT = "skyharbor:robot";
export const KIND_PLANETS = "skyharbor:planets";
export const KIND_INFO = "skyharbor:info";

// The real dig's rules, shared by the 3D dig block (rubbing with the pointer) and the panel's tool button
// (keyboard and one-tap play): the trowel scrapes the top layer away, the soft brush cleans an uncovered
// fossil. A fossil must be brushed out before digging deeper, so the order found is the order of depth.
import type { Fossil } from "../../block";
import { sound } from "../../audio";
import { DIG_LAYERS, exposedFossil, useSurvey } from "./store";

/** One stroke of the tool in hand. `on`: what the pointer rubbed (the soil, an uncovered fossil, or "auto" for the button). */
export function digStroke(fossils: Fossil[], on: "soil" | "fossil" | "auto", amount: number) {
  const st = useSurvey.getState();
  const d = st.dig;
  if (d.card) return;
  const ex = exposedFossil(d, fossils);
  const now = performance.now();
  const say = (msg: typeof d.msg) => {
    if (d.msg === msg && now - d.msgAt < 1500) return;
    st.setDig({ msg, msgAt: now });
    if (msg === "useBrush" || msg === "useTrowel" || msg === "brushFirst") sound.sfx("pop", 0.4);
  };
  if (d.tool === "trowel") {
    if (ex && (on === "fossil" || on === "auto")) {
      // a trowel on a fragile fossil: kind words, and it counts as a slip for that fossil
      if (on === "fossil") st.setDig({ slips: { ...d.slips, [ex.id]: (d.slips[ex.id] || 0) + 1 } });
      say(on === "fossil" ? "useBrush" : "brushFirst");
      return;
    }
    if (ex) {
      say("brushFirst");
      return;
    }
    if (d.removed >= DIG_LAYERS) return;
    const scrape = d.scrape + amount;
    if (scrape >= 1) {
      st.setDig({ removed: d.removed + 1, scrape: 0, msg: "layerGone", msgAt: now });
      sound.sfx("chime", 0.6);
    } else st.setDig({ scrape });
    return;
  }
  // the brush
  if (!ex) {
    if (d.removed < DIG_LAYERS) say("useTrowel");
    return;
  }
  if (on === "soil") return;
  const b = (d.brushed[ex.id] || 0) + amount;
  if (b >= 1) {
    st.setDig({ brushed: { ...d.brushed, [ex.id]: 1 }, found: d.found.concat(ex.id), card: ex.id, msg: "found", msgAt: now });
    sound.sfx("success", 0.8);
  } else st.setDig({ brushed: { ...d.brushed, [ex.id]: b } });
}

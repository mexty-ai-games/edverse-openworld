// Local harness: mounts the block like the MEXTY player does, with the saved props
// (dev/props.json; run `node dev/localize.mjs` to point asset URLs at dev/public for offline work).
import { mount } from "../src/App";
import props from "./props.local.json";

mount(document.getElementById("root")!, props);

// microfixd/index.ts
import { initOrgans } from "./langgraph/organs";

async function main() {
  const organs = initOrgans();

  // start autonomous loops
  organs.scheduler.start();
  organs.loop.start();
  organs.mission.start();
  organs.feedback.start();
  organs.federation.start();
  organs.emotion.start();
  organs.reflex.start();
  organs.voice.start();
  organs.voiceEmotion.start();

  // example: initial speech
  organs.voiceOut.speak("Voice command grammar online. Sensory feedback loops synchronized.");

  // example: register federation nodes
  organs.federation.registerNode("Node-A", "http://localhost:4001");
  organs.federation.registerNode("Node-B", "http://localhost:4002");

  // example: create a mission
  organs.mission.createMission("legal-logger", [
    { type: "legal", payload: { systemPrompt: "You are a legal engine.", userPrompt: "Draft a discovery motion." }},
    { type: "code", payload: { systemPrompt: "You are a TS engineer.", userPrompt: "Implement logging service." }},
    { type: "web", payload: { method: "GET", url: "https://api.github.com" }}
  ]);

  // Initial wiring broadcast
  organs.wiring.broadcast("reflex", { type: "system_online" });

  const result = organs.paragon.dissect("legal", {
    systemPrompt: "You are a legal engine.",
    userPrompt: "Draft a discovery motion.",
  });

  console.log("Paragon Dissection:", result);
}

main();

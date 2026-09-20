// microfixd/core/agents/agentRouter.ts
import { agentRegistry } from "./registry";
import { memory } from "../../backend/core/memory/state";
import { telemetry } from "../../backend/core/telemetry/grid";

export class AgentRouterOrgan {
  async route(request: { type: string; payload: any }): Promise<any> {
    const action = request.type.toLowerCase();
    const agent = agentRegistry[action];
    
    if (!agent) {
      throw new Error(`No agent found for router action '${action}'`);
    }

    // Call the agent execute method
    const result = await agent.execute({
      mission: { 
        description: request.payload?.userPrompt || request.payload?.description || "Routed execution",
        title: request.payload?.title || `Task: ${action}`
      },
      memory,
      telemetry
    });

    return result;
  }
}

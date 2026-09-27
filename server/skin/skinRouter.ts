import { Router }   from "express";
import { skinLayer } from "./skinLayer";
import { sensorMesh } from "./sensorMesh";

export const skinRouter = Router();

skinRouter.post("/receive", async (req, res) => {
  const { type = "api_call", payload, source = "api", session_id } = req.body;
  const result = await skinLayer.receive(type, payload, source, session_id);
  res.set(skinLayer.getStats ? {} : {}).json(result);
});

skinRouter.get("/stats",   (req, res) => res.json(skinLayer.getStats()));
skinRouter.get("/sensors", (req, res) => res.json({ log: sensorMesh.recent(50), stats: sensorMesh.stats() }));

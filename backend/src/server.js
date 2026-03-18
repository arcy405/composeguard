import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import reviewRouter from "./routes/review.js";

const app = express();
const port = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../");
const frontendDir = path.join(projectRoot, "frontend");

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use("/api", reviewRouter);
app.use(express.static(frontendDir));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "composeguard-api" });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

app.listen(port, () => {
  // Keeping this log concise makes local startup obvious.
  console.log(`ComposeGuard running on http://localhost:${port}`);
});


import { startMatchmaker } from "./swarm/network.js";
import { runQuizLoop } from "./quiz/engine.js";
import { initializeStorage } from "./storage/db.js";

async function main() {
  console.log("Welcome to Illumignoti");

  // 1. Initialize local SQLite
  await initializeStorage();

  // 2. Connect to the Matchmaker Swarm
  const network = await startMatchmaker();

  // 3. Start the onboarding / zero-config quiz loop
  await runQuizLoop(network);
}

main().catch(console.error);

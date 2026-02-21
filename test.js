import { startMatchmaker } from './swarm/network.js';
import { runQuizLoop } from './quiz/engine.js';
import { initializeStorage } from './storage/db.js';
import chalk from 'chalk';

/**
 * A basic test runner that spins up a local database connection
 * and initializes the matchmaker to ensure the peer-discovery and 
 * everything-is-a-quiz abstraction connects cleanly.
 */
async function runSystemTest() {
    console.log(chalk.bold.magenta("=== ILLUMIGNOTI SYSTEM TEST ==="));
    
    // 1. Storage
    console.log(chalk.yellow("\n[TEST] Initializing Storage..."));
    await initializeStorage();

    // 2. Swarm Networking
    console.log(chalk.yellow("\n[TEST] Connecting to Swarm..."));
    const network = await startMatchmaker();
    
    // Test the broadcast functionality (Self-ping)
    network.announceGame("illumignoti://science/biology", "WWTBAM", "test_host_key_abc123");

    // 3. Quiz Engine UI Logic
    console.log(chalk.yellow("\n[TEST] Starting Onboarding Engine..."));
    
    // Note: runQuizLoop will block on stdin in a real environment waiting for the user.
    // For a fully automated test, we would stub the stdin.
    // Here we just initialize it to ensure it doesn't crash on load.
    runQuizLoop(network);
}

runSystemTest().catch(console.error);

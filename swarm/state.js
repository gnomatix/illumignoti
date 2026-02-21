import Hypercore from 'hypercore';
import b4a from 'b4a';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';

// Temporary local storage dir for Hypercores
const CORES_DIR = path.join(process.cwd(), 'data', 'cores');
if (!fs.existsSync(CORES_DIR)) {
    fs.mkdirSync(CORES_DIR, { recursive: true });
}

export class GameSession {
    constructor(hostPublicKey = null) {
        this.hostKey = hostPublicKey;
        this.isHost = !hostPublicKey;
        
        // The authoritative game state core
        this.studioCore = null;
        
        // The player's personal log core
        this.personalCore = null;
        
        this.connectedPlayers = new Map(); // pubKey -> Core
    }

    async init() {
        if (this.isHost) {
            console.log(chalk.cyan("Initializing Host Studio Core..."));
            this.studioCore = new Hypercore(path.join(CORES_DIR, 'host-studio'));
            await this.studioCore.ready();
            this.hostKey = this.studioCore.key.toString('hex');
            console.log(chalk.green(`✓ Studio Core Ready. Host Key: ${this.hostKey}`));
        } else {
            console.log(chalk.cyan(`Connecting to Host Studio Core: ${this.hostKey.slice(0, 8)}...`));
            
            // Connect to remote host core
            this.studioCore = new Hypercore(
                path.join(CORES_DIR, `remote-${this.hostKey.slice(0, 8)}`), 
                b4a.from(this.hostKey, 'hex')
            );
            await this.studioCore.ready();
            
            // Start reading the host's broadcasts
            this.listenToHost();
            
            // Create our personal core for submitting answers
            this.personalCore = new Hypercore(path.join(CORES_DIR, `player-log-${Date.now()}`));
            await this.personalCore.ready();
            console.log(chalk.green(`✓ Connected. My Player Key: ${this.personalCore.key.toString('hex')}`));
            
            // We would then send our personalCore.key to the Host via the Matchmaker Swarm
            // so the Host can subscribe to our answers.
        }
    }

    async submitAnswer(payload) {
        if (!this.personalCore) throw new Error("Not connected to a game.");
        
        const block = b4a.from(JSON.stringify({
            event: 'answer_submitted',
            timestamp: Date.now(),
            data: payload
        }));

        await this.personalCore.append(block);
        console.log(chalk.magenta(`[STATE] Appended answer to personal log.`));
    }

    async broadcastQuestion(quizPayload) {
        if (!this.isHost) throw new Error("Only the Host can broadcast to the Studio Core.");
        
        const block = b4a.from(JSON.stringify({
            event: 'question_start',
            timestamp: Date.now(),
            data: quizPayload
        }));

        await this.studioCore.append(block);
        console.log(chalk.yellow(`[STATE] Auth-Appended new question.`));
    }

    listenToHost() {
        // Stream updates from the Host
        const stream = this.studioCore.createReadStream({ live: true });
        stream.on('data', data => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.event === 'question_start') {
                    console.log(chalk.blue(`\n[HOST BROADCAST] New Question Arrived!`));
                    // In real app, trigger promptUser UI here
                }
            } catch(e) {}
        });
    }
}

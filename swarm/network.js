import Hyperswarm from 'hyperswarm';
import crypto from 'hypercore-crypto';
import b4a from 'b4a';
import chalk from 'chalk';
import EventEmitter from 'events';

// The "Global Namespace" topic that all Illumignoti clients join upon boot
const MATCHMAKER_TOPIC = crypto.discoveryKey(b4a.from('illumignoti-global-matchmaker-v1'));

class MatchmakerSwarm extends EventEmitter {
    constructor() {
        super();
        this.swarm = new Hyperswarm();
        
        this.swarm.on('connection', (conn, info) => {
            // A new peer connected to the global matchmaker!
            // In a real app, we'd multiplex the stream or use a protocol like hypercore-protocol
            // For now, we listen for plain JSON messages on the socket
            
            conn.on('data', data => {
                try {
                    const msg = JSON.parse(data.toString());
                    this.handleIncomingMessage(msg, conn, info);
                } catch (err) {
                    // Ignore non-JSON/malformed packets
                }
            });
        });
    }

    async join() {
        console.log(chalk.blue(`Joining global matchmaker swarm...`));
        
        // Join the global discovery topic
        const discovery = this.swarm.join(MATCHMAKER_TOPIC, { server: true, client: true });
        
        // Await the initial flush to establish baseline peer connections
        await discovery.flushed();
        console.log(chalk.green(`✓ Connected to Matchmaker. Discovered peers: ${this.swarm.connections.size}`));
    }

    handleIncomingMessage(msg, conn, info) {
        if (msg.type === 'game_broadcast') {
            // A Host is announcing a new game
            this.emit('game_broadcast', msg.payload);
        }
        
        if (msg.type === 'jury_duty_dispatch') {
            // The network is routing a judging task
            this.emit('jury_duty', msg.payload);
        }
        
        if (msg.type === 'lifeline_expert_request') {
             // A player is looking for an expert in a specific ontology
             this.emit('expert_ping', msg.payload);
        }
    }

    broadcast(type, payload) {
        const data = b4a.from(JSON.stringify({ type, payload }));
        
        // Broadcast to all currently connected peers in the Matchmaker
        for (const conn of this.swarm.connections) {
            conn.write(data);
        }
    }

    announceGame(namespace, mode, hostPublicKey) {
        console.log(chalk.yellow(`[HOST] Announcing new ${mode} game in [${namespace}]...`));
        this.broadcast('game_broadcast', {
            namespace,
            mode,
            host_key: hostPublicKey, // The core key clients should connect to
            timestamp: Date.now()
        });
    }
}

export async function startMatchmaker() {
    const network = new MatchmakerSwarm();
    await network.join();
    return network;
}

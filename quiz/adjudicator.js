import { calculateTrustScore } from '../proprietary/heuristics.js';
import { saveQuizQuestion, awardTaxonomyBadge, getAllJudgeScores, updateJudgeScore } from '../storage/db.js';
import { QUIZ_TYPES } from './schema.js';
import chalk from 'chalk';
import EventEmitter from 'events';

export class AdjudicatorEngine extends EventEmitter {
    constructor(db) {
        super();
        this.db = db;
        this.activeJuryTasks = new Map(); // taskId -> { expiration, data }
    }

    // 1. A fuzzy answer is submitted, the Host requests judging
    async dispatchJuryDuty(networkMap, namespace, question, playerAnswer) {
        console.log(chalk.yellow(`\n[ADJUDICATOR] Dispatching fuzzy answer for review in [${namespace}]...`));
        
        // Find qualified judges online
        // In reality, this queries the network Map we built in swarm/network.js
        console.log("Looking for experts with T-Score > 85.0 and High Interest...");
        
        const taskId = `duty-${Date.now()}`;
        
        // Broadcast specifically to those peers
        const payload = {
            task_id: taskId,
            type: QUIZ_TYPES.ADJUDICATION_RULING,
            namespace: namespace,
            original_question: question,
            player_answer: playerAnswer
        };
        
        // Emits up to the Host network orchestrator to send the bytes
        this.emit('route_to_judges', payload);
        return taskId;
    }

    // 2. A Judge's client receives the task. It enters the "Expiring Inbox".
    receiveJuryDuty(payload) {
        const TTL = 15000; // 15 seconds to accept the task before it expires
        console.log(chalk.cyan(`\n[INBOX] New Jury Duty Task Received! Expires in 15s.`));
        console.log(`Question: ${payload.original_question}`);
        console.log(`Player Answer: ${payload.player_answer}`);
        console.log(chalk.dim(`(Accept? Y/N)`));

        const expirationToken = setTimeout(() => {
            if (this.activeJuryTasks.has(payload.task_id)) {
                console.log(chalk.dim(`[INBOX] Task ${payload.task_id} expired. No penalty.`));
                this.activeJuryTasks.delete(payload.task_id);
            }
        }, TTL);

        this.activeJuryTasks.set(payload.task_id, {
            data: payload,
            timeout: expirationToken
        });
    }

    // 3. A user submits a "Stump the Experts" question; route to opted-in judges
    async dispatchMetaEval(networkMap, namespace, authoredPayload) {
        console.log(chalk.yellow(`\n[ADJUDICATOR] Routing user-authored question for Meta-Eval in [${namespace}]...`));
        console.log("Locating Experts who have opted-in to community content review...");
        
        const taskId = `meta-eval-${Date.now()}`;
        
        const payload = {
            task_id: taskId,
            type: QUIZ_TYPES.META_EVAL,
            namespace: namespace,
            authored_question: authoredPayload
        };
        
        this.emit('route_to_judges', payload);
        return taskId;
    }

    // 4. An Expert receives a community question to review
    receiveMetaEvalTask(payload) {
        const TTL = 30000; // 30 seconds to accept a meta-eval task
        console.log(chalk.cyan.bold(`\n[INBOX] Community Review Task: Stump the Experts! Expires in 30s.`));
        console.log(`Review Question: "${payload.authored_question.presentation.prompt_text}"`);
        console.log(`Proposed Answer: "${payload.authored_question.interaction.expected_truth}"`);
        console.log(chalk.dim(`(Rate 0-10 on accuracy/fun to promote to Global Seed)`));

        const expirationToken = setTimeout(() => {
            if (this.activeJuryTasks.has(payload.task_id)) {
                console.log(chalk.dim(`[INBOX] Meta-Eval Task ${payload.task_id} expired.`));
                this.activeJuryTasks.delete(payload.task_id);
            }
        }, TTL);

        this.activeJuryTasks.set(payload.task_id, {
            data: payload,
            timeout: expirationToken
        });
    }

    // 5. When the swarm reaches consensus on a user-authored question
    async processMetaEvalConsensus(payload, averageRating, authorId) {
        if (averageRating >= 8.0) {
            console.log(chalk.green.bold(`\n⭐ [PROMOTION] Community question passed Meta-Eval with rating ${averageRating.toFixed(1)}/10!`));
            console.log(chalk.green(`Promoting to Global Seed Pool...`));
            
            // Promote to DB
            // Assign it a default mode_id for the namespace if needed, or leave null to inherit globally
            if (!payload.authored_question.mode_id) {
                payload.authored_question.mode_id = "m-jeopardy"; // Stub
            }
            await saveQuizQuestion(payload.authored_question);

            // Reward the Author with Gamification Taxonomy Badges
            await awardTaxonomyBadge(authorId, payload.namespace);
        } else {
            console.log(chalk.gray(`\n[META-EVAL] Question scored ${averageRating.toFixed(1)}/10. Not promoted to Global Seed.`));
        }
    }

    // 6. Periodic recalculation of T-Scores based on the database
    async refreshScoreboard() {
        try {
            const rows = await getAllJudgeScores();
            
            for (const row of rows) {
                // Inject the proprietary scoring algorithm
                const newScore = calculateTrustScore(row);
                await updateJudgeScore(row.judge_id, row.tag, newScore.primary_t_score);
            }
            
            console.log(chalk.green(`✓ Scoreboard recalibrated using proprietary SGE vectors.`));
        } catch (err) {
            console.error(chalk.red(`Error recalibrating scoreboard: ${err.message}`));
        }
    }
}

import readline from 'readline';
import chalk from 'chalk';
import EventEmitter from 'events';

// Proprietary Keystroke Timing Constants (Stubbed for Dev)
// In production, these are injected from proprietary/anti_cheat.js
const HUMAN_TYPING_MIN_VARIANCE_MS = 5; 

export class RawTerminalPrompt extends EventEmitter {
    constructor() {
        super();
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        // Disable standard readline processing so we can capture raw events
        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }

        this.keystrokeTimings = [];
        this.lastKeyTime = 0;
    }

    /**
     * Prompts the user using raw key events rather than stdin pipes.
     * Frustrates basic echo "A" | illumignoti scripts.
     */
    async askMultipleChoice(questionText, options) {
        return new Promise((resolve) => {
            console.log(chalk.cyan(`\n${questionText}`));
            options.forEach((opt, idx) => {
                const letter = String.fromCharCode(65 + idx); // A, B, C...
                console.log(`  ${chalk.yellow(letter)}) ${opt}`);
            });
            console.log(chalk.dim(`\n(Press the letter of your choice)`));

            this.keystrokeTimings = [];
            this.lastKeyTime = Date.now();

            const keyHandler = (char, key) => {
                if (!key) return;
                
                // Track typing cadence for anti-cheat
                const now = Date.now();
                this.keystrokeTimings.push(now - this.lastKeyTime);
                this.lastKeyTime = now;

                if (key.ctrl && key.name === 'c') {
                    process.exit();
                }

                const maxLetter = String.fromCharCode(97 + options.length - 1); // 'a' is 97
                const isValidAlpha = /^[a-z]$/i.test(key.name);
                
                if (isValidAlpha && key.name.toLowerCase() <= maxLetter) {
                    // Clean up listener
                    process.stdin.removeListener('keypress', keyHandler);
                    console.log(chalk.green(`\nSelected: ${key.name.toUpperCase()}`));
                    
                    resolve({
                        selected_option: key.name.toUpperCase(),
                        timings: this.keystrokeTimings,
                        is_human_cadence: this.analyzeCadence()
                    });
                }
            };

            process.stdin.on('keypress', keyHandler);
        });
    }

    /**
     * Basic check against perfect LLM / Script timing 
     * (e.g. key presses arriving exactly 1ms apart)
     */
    analyzeCadence() {
        if (this.keystrokeTimings.length < 2) return true; // Not enough data
        
        // Calculate variance between strokes
        let varianceSum = 0;
        for (let i = 1; i < this.keystrokeTimings.length; i++) {
            varianceSum += Math.abs(this.keystrokeTimings[i] - this.keystrokeTimings[i-1]);
        }
        const avgVariance = varianceSum / this.keystrokeTimings.length;
        
        if (avgVariance < HUMAN_TYPING_MIN_VARIANCE_MS) {
            console.log(chalk.red('\n[SYSTEM] Input event validation failed.'));
            return false;
        }
        return true;
    }

    /**
     * Standard free-text prompt allowing backspace/editing.
     * Temporarily disables raw mode.
     */
    async askFreeText(promptText) {
        return new Promise((resolve) => {
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(false);
            }
            
            this.rl.question(chalk.cyan(`\n${promptText}\n> `), (answer) => {
                if (process.stdin.isTTY) {
                    process.stdin.setRawMode(true);
                }
                resolve(answer.trim());
            });
        });
    }

    /**
     * The gamified "Stump the Experts" interactive authoring flow.
     */
    async authorQuestionFlow() {
        console.log(chalk.bgMagenta.white.bold('\n=== STUMP THE EXPERTS: AUTHOR A QUESTION ==='));
        console.log(chalk.magenta('Provide a challenging question to boost your Trust Multiplier!\n'));
        
        const prompt_text = await this.askFreeText("What is your question?");
        const expected_truth = await this.askFreeText("What is the exact correct answer?");
        const difficulty_str = await this.askFreeText("Rate the difficulty (1=Easy, 10=Master):");
        
        let difficulty_tier = parseInt(difficulty_str, 10);
        if (isNaN(difficulty_tier) || difficulty_tier < 1 || difficulty_tier > 10) {
            difficulty_tier = 5; // Default fallback
        }

        console.log(chalk.green(`\n✓ Question Drafted. Generating payload...`));
        
        return {
            question_id: `q-authored-${Date.now()}`,
            type: "schema:question",
            difficulty_tier: difficulty_tier,
            presentation: {
                media_type: "text",
                prompt_text: prompt_text
            },
            interaction: {
                input_type: "free_text", 
                expected_truth: expected_truth
            }
        };
    }
}

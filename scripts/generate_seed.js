import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch'; // Requires npm install node-fetch or native in Node 18+

// Using the OpenTDB API to grab general trivia questions
// as a safe proxy for testing multi-modal questions locally.
const OPENTDB_URL = 'https://opentdb.com/api.php';

async function fetchQuestions(count = 50) {
    console.log(`Fetching ${count} questions from OpenTDB...`);
    
    // fetch random questions
    const res = await fetch(`${OPENTDB_URL}?amount=${count}`);
    if (!res.ok) throw new Error("Failed to fetch from OpenTDB");
    
    const data = await res.json();
    return data.results;
}

function processIntoIllumignotiFormat(rawQuestions) {
    const modes = [
        {
            type: "schema:mode",
            mode_id: "m-jeopardy",
            name: "Classic Free Text Jeopardy",
            namespace: "illumignoti://history/jeopardy",
            base_time_to_answer_ms: 15000,
            difficulty_scaling_factor: 1.5,
            allows_chaining: false,
            allowed_media_types: ["text"],
            allowed_input_types: ["free_text"]
        },
        {
            type: "schema:mode",
            mode_id: "m-wheel",
            name: "Wheel of Guesses",
            namespace: "illumignoti://puzzles/wheel_of_fortune",
            base_time_to_answer_ms: 30000,
            difficulty_scaling_factor: 1.2,
            allows_chaining: false,
            allowed_media_types: ["hangman_mask"],
            allowed_input_types: ["single_char"]
        },
        {
            type: "schema:mode",
            mode_id: "m-whats-my-line",
            name: "What's My Line (True/False)",
            namespace: "illumignoti://logic/whats_my_line",
            base_time_to_answer_ms: 10000,
            difficulty_scaling_factor: 1.0,
            allows_chaining: false,
            allowed_media_types: ["text"],
            allowed_input_types: ["boolean"]
        },
        {
            type: "schema:mode",
            mode_id: "m-wwtbam",
            name: "Who Wants To Be A Millionaire",
            namespace: "illumignoti://trivia/general",
            base_time_to_answer_ms: 45000,
            difficulty_scaling_factor: 2.0,
            allows_chaining: true,
            allowed_media_types: ["text", "ansi_image"],
            allowed_input_types: ["selection"]
        }
    ];

    const questions = [];
    
    for (let i = 0; i < rawQuestions.length; i++) {
        const q = rawQuestions[i];
        
        // Convert string difficulties to tiers (1-10)
        let tier = 5;
        if (q.difficulty === 'easy') tier = 2;
        if (q.difficulty === 'hard') tier = 8;
        
        const base = {
            question_id: `q-${Date.now()}-${i}`,
            type: "schema:question",
            difficulty_tier: tier,
            presentation: {},
            interaction: {}
        };
        
        // 1. Jeopardy Format (Free text)
        if (i % 4 === 0) {
            base.mode_id = "m-jeopardy";
            base.presentation = {
                media_type: "text",
                prompt_text: `(Category: ${q.category}) ${q.question}`
            };
            base.interaction = {
                input_type: "free_text",
                expected_truth: q.correct_answer
            };
        }
        
        // 2. Wheel of Fortune (Hangman complete-the-word)
        else if (i % 4 === 1) {
            const masked = q.correct_answer.replace(/[a-zA-Z]/g, "_");
            base.mode_id = "m-wheel";
            base.presentation = {
                media_type: "hangman_mask",
                prompt_text: q.question,
                mask: masked
            };
            base.interaction = {
                input_type: "single_char",
                expected_solution: q.correct_answer 
            };
        }
        
        // 3. True/False (What's My Line boolean)
        else if (i % 4 === 2) {
             base.mode_id = "m-whats-my-line";
             base.presentation = {
                 media_type: "text",
                 prompt_text: `The answer to "${q.question}" is ${q.correct_answer}.`
             };
             base.interaction = {
                 input_type: "boolean",
                 expected_truth: true // Stubbed
             };
        }
        
        // 4. Multiple Choice (WWTBAM style)
        else {
             base.mode_id = "m-wwtbam";
             base.presentation = {
                 media_type: "text",
                 prompt_text: q.question
             };
             base.interaction = {
                 input_type: "selection",
                 options: [q.correct_answer, ...q.incorrect_answers],
                 expected_idx: 0
             };
        }
        
        questions.push(base);
    }
    
    // Add an example of chained dependencies!
    questions.push({
        question_id: `q-part2-chained`,
        type: "schema:question",
        mode_id: "m-wwtbam",
        difficulty_tier: 6,
        depends_on_id: questions[3].question_id, // Chains to the first wwtbam question!
        is_multipart: true,
        presentation: {
            media_type: "text",
            prompt_text: `Following up from that last question, why did you pick that?`
        },
        interaction: {
            input_type: "free_text",
            expected_truth: "user rationale"
        }
    });
    
    return { modes, questions };
}

async function run() {
    try {
        const raw = await fetchQuestions(50);
        const { modes, questions } = processIntoIllumignotiFormat(raw);
        
        const outPath = path.join(process.cwd(), 'data', 'seed_1950s.json');
        
        if (!fs.existsSync(path.dirname(outPath))) {
            fs.mkdirSync(path.dirname(outPath));
        }
        
        fs.writeFileSync(outPath, JSON.stringify({
            seed_description: "Mode-Driven Poly-schema test questions (safe IP testbed)",
            timestamp: Date.now(),
            modes: modes,
            questions: questions
        }, null, 2));
        
        console.log(`Successfully generated ${modes.length} Mode Rules and ${questions.length} Question Payloads to data/seed_1950s.json`);
    } catch (e) {
        console.error("Error generating seed data:", e);
    }
}

run();

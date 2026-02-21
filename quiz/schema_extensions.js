import { QUIZ_TYPES, Schemas } from './schema.js';

// Adding new quiz types for Schema expansion based on classic Game Show tests
Object.assign(QUIZ_TYPES, {
    TRIVIA_TEXT_INPUT: "trivia:text_input", // e.g. Jeopardy (free text answer)
    TRIVIA_HANGMAN: "trivia:hangman",       // e.g. Wheel of Fortune (complete the word)
    TRIVIA_IMAGE: "trivia:image",           // Rendered ANSI block imagery
    TRIVIA_YES_NO: "trivia:yes_no"          // e.g. What's My Line (Boolean logic)
});

// Adding structural validation schemas for the new types
Object.assign(Schemas, {
    [QUIZ_TYPES.TRIVIA_TEXT_INPUT]: {
        type: "object",
        properties: {
            question_id: { type: "string" },
            answer_text: { type: "string", minLength: 1, maxLength: 200 },
            time_to_answer_ms: { type: "integer" }
        },
        required: ["question_id", "answer_text", "time_to_answer_ms"]
    },
    [QUIZ_TYPES.TRIVIA_HANGMAN]: {
         type: "object",
         properties: {
             question_id: { type: "string" },
             guessed_letter: { type: "string", minLength: 1, maxLength: 1 },
             time_to_answer_ms: { type: "integer" }
         },
         required: ["question_id", "guessed_letter", "time_to_answer_ms"]
    },
    [QUIZ_TYPES.TRIVIA_YES_NO]: {
         type: "object",
         properties: {
             question_id: { type: "string" },
             is_yes: { type: "boolean" },
             time_to_answer_ms: { type: "integer" }
         },
         required: ["question_id", "is_yes", "time_to_answer_ms"]
    }
});

// A small utility export since node doesn't natively support dynamic Object.assign exports easily
export const getQuizTypes = () => QUIZ_TYPES;
export const getSchemas = () => Schemas;

// We are deprecating specific game types for a single, powerful Meta-Schema

export const QUIZ_TYPES = {
    CONFIG: "schema:config",         // Immutable player prefs
    META_EVAL: "schema:meta_eval",   // Rating other questions
    GAME_MODE: "schema:mode",        // Configurable rules governing a session
    QUESTION: "schema:question"      // The actual semantic payload
};

// The Polymorphic Descriptor Schema
export const Schemas = {
    [QUIZ_TYPES.GAME_MODE]: {
        type: "object",
        properties: {
            mode_id: { type: "string" },
            name: { type: "string" },
            namespace: { type: "string" },
            
            // Global Session Variables
            base_time_to_answer_ms: { type: "integer" },
            difficulty_scaling_factor: { type: "number" }, // Multiplier for higher tier questions
            allows_chaining: { type: "boolean" }, // Are multi-part questions allowed in this mode?
            
            // UI Enforcements
            allowed_media_types: { type: "array", items: { type: "string" } },
            allowed_input_types: { type: "array", items: { type: "string" } }
        },
        required: ["mode_id", "name", "namespace", "base_time_to_answer_ms"]
    },
    [QUIZ_TYPES.QUESTION]: {
        type: "object",
        properties: {
            question_id: { type: "string" },
            difficulty_tier: { type: "integer", minimum: 1, maximum: 10 }, // Leveled questions
            
            // Chaining / Multipart dependencies
            depends_on_id: { type: "string" }, // Must answer X before Y
            is_multipart: { type: "boolean" },
            
            // UI Render Data (No rules, just strings/assets)
            presentation: {
                type: "object",
                properties: {
                    media_type: { type: "string" }, // e.g., 'text', 'ansi_image'
                    prompt_text: { type: "string" },
                    mask: { type: "string" } // Optional, for hangman
                },
                required: ["media_type", "prompt_text"]
            },
            
            // Interaction Data (Options, exact correct text)
            interaction: {
                type: "object",
                properties: {
                    input_type: { type: "string" }, // 'selection', 'free_text', 'boolean'
                    options: { type: "array", items: { type: "string" } }, // Optional
                    expected_truth: { type: "string" } // The answer hash/string for Host verification
                },
                required: ["input_type"]
            }
        },
        required: ["question_id", "difficulty_tier", "presentation", "interaction"]
    }
    // ... Config and Meta forms remain similar structural objects
};

export function validatePayload(type, payload) {
    const schema = Schemas[type];
    if (!schema) throw new Error(`Unknown schema type: ${type}`);
    // Deep validation logic here
    return { valid: true };
}

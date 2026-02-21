import sqlite3 from 'sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbDir = join(__dirname, '../../data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = join(dbDir, 'illuminati.db');
let db;

export async function initializeStorage() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error("Error opening database " + err.message);
                reject(err);
            } else {
                console.log("Connected to the SQLite database at " + dbPath);
                
                // Initialize core tables
                db.serialize(() => {
                    db.run(`CREATE TABLE IF NOT EXISTS judge_scores (
                        judge_id TEXT PRIMARY KEY,
                        t_score REAL DEFAULT 0.0,
                        tag TEXT,
                        total_volume INTEGER DEFAULT 0,
                        last_active_timestamp INTEGER
                    )`);

                    db.run(`CREATE TABLE IF NOT EXISTS game_sessions (
                        session_id TEXT PRIMARY KEY,
                        host_id TEXT,
                        mode_id TEXT,
                        status TEXT,
                        start_time INTEGER
                    )`);

                    // Gamification Badges (Stump the Experts "Untappd" progression)
                    db.run(`CREATE TABLE IF NOT EXISTS gamification_badges (
                        player_id TEXT,
                        namespace TEXT,
                        level INTEGER DEFAULT 1,
                        PRIMARY KEY (player_id, namespace)
                    )`);

                    // Data-Driven Modes
                    db.run(`CREATE TABLE IF NOT EXISTS quiz_modes (
                        mode_id TEXT PRIMARY KEY,
                        name TEXT,
                        namespace TEXT,
                        base_time_to_answer_ms INTEGER,
                        difficulty_scaling_factor REAL,
                        allows_chaining BOOLEAN,
                        allowed_media_types TEXT, -- JSON array
                        allowed_input_types TEXT  -- JSON array
                    )`);

                    // The Polymorphic Questions Payload
                    db.run(`CREATE TABLE IF NOT EXISTS quiz_questions (
                        question_id TEXT PRIMARY KEY,
                        mode_id TEXT,
                        difficulty_tier INTEGER,
                        depends_on_id TEXT,
                        is_multipart BOOLEAN,
                        presentation_payload TEXT, -- JSON serialization of Schema UI blocks
                        interaction_payload TEXT,  -- JSON serialization of interaction blocks
                        FOREIGN KEY(mode_id) REFERENCES quiz_modes(mode_id)
                    )`);

                    // Answers and Verification
                    db.run(`CREATE TABLE IF NOT EXISTS player_responses (
                        response_id TEXT PRIMARY KEY,
                        session_id TEXT,
                        player_id TEXT,
                        question_id TEXT,
                        answer_payload TEXT, -- JSON payload defining the answer choice
                        time_to_answer_ms INTEGER,
                        is_correct BOOLEAN,
                        needs_adjudication BOOLEAN DEFAULT 0
                    )`);
                });
                resolve(db);
            }
        });
    });
}

// Helper methods for ingesting the Meta-Schema formats
export function saveQuizMode(modeObj) {
    if (!db) throw new Error("DB not initialized");
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`INSERT OR REPLACE INTO quiz_modes 
            (mode_id, name, namespace, base_time_to_answer_ms, difficulty_scaling_factor, allows_chaining, allowed_media_types, allowed_input_types) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
            
        stmt.run(
            modeObj.mode_id, modeObj.name, modeObj.namespace, 
            modeObj.base_time_to_answer_ms, modeObj.difficulty_scaling_factor, 
            modeObj.allows_chaining ? 1 : 0, 
            JSON.stringify(modeObj.allowed_media_types), JSON.stringify(modeObj.allowed_input_types),
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
        stmt.finalize();
    });
}

export function saveQuizQuestion(questionObj) {
    if (!db) throw new Error("DB not initialized");
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`INSERT OR REPLACE INTO quiz_questions 
            (question_id, mode_id, difficulty_tier, depends_on_id, is_multipart, presentation_payload, interaction_payload) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`);
            
        stmt.run(
            questionObj.question_id, questionObj.mode_id, questionObj.difficulty_tier,
            questionObj.depends_on_id || null, questionObj.is_multipart ? 1 : 0,
            JSON.stringify(questionObj.presentation), JSON.stringify(questionObj.interaction),
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
        stmt.finalize();
    });
}

export function getDb() {
    if (!db) throw new Error("Database not initialized. Call initializeStorage() first.");
    return db;
}

export function savePlayerResponse(responseObj) {
    if (!db) throw new Error("DB not initialized");
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`INSERT OR REPLACE INTO player_responses 
            (response_id, session_id, player_id, question_id, answer_payload, time_to_answer_ms, is_correct, needs_adjudication) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
            
        stmt.run(
            responseObj.response_id, responseObj.session_id, responseObj.player_id,
            responseObj.question_id, JSON.stringify(responseObj.answer_payload), 
            responseObj.time_to_answer_ms, responseObj.is_correct ? 1 : 0, 
            responseObj.needs_adjudication ? 1 : 0,
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
        stmt.finalize();
    });
}

// Gamification mechanics
export function awardTaxonomyBadge(playerId, namespace) {
    if (!db) throw new Error("DB not initialized");
    return new Promise((resolve, reject) => {
        db.get(`SELECT level FROM gamification_badges WHERE player_id = ? AND namespace = ?`, [playerId, namespace], (err, row) => {
            if (err) return reject(err);
            
            const newLevel = row ? row.level + 1 : 1;
            
            db.run(`INSERT OR REPLACE INTO gamification_badges (player_id, namespace, level) VALUES (?, ?, ?)`, 
            [playerId, namespace, newLevel], 
            (insertErr) => {
                if (insertErr) return reject(insertErr);
                console.log(`\n🏆 [GAMIFICATION] Player ${playerId} unlocked Level ${newLevel} Badge in [${namespace}]!`);
                resolve(newLevel);
            });
        });
    });
}

export function getAllJudgeScores() {
    if (!db) throw new Error("DB not initialized");
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM judge_scores', [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

export function updateJudgeScore(judgeId, tag, tScore) {
    if (!db) throw new Error("DB not initialized");
    return new Promise((resolve, reject) => {
        db.run('UPDATE judge_scores SET t_score = ? WHERE judge_id = ? AND tag = ?',
            [tScore, judgeId, tag],
            (err) => {
                if (err) return reject(err);
                resolve();
            });
    });
}

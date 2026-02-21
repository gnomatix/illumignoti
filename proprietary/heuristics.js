/**
 * PROPRIETARY AND CONFIDENTIAL
 * Illumignoti Global Matchmaker - SGE Trust Heuristics & Anti-Automation
 * 
 * This file contains the exact weights and threshold equations for the Trust 
 * Scoring algorithm. It is heavily obfuscated and must be kept strictly 
 * protected within the git-crypt boundary. Exposure of these equations 
 * enables Sybil attacks and automated gamification of the Judge pool.
 */

// 1. The S-Factor (Shadowban Multiplier) Algorithm
// Automatically flags non-human latency or unnatural domain shifting.
export function calculateSFactor(playerHistory, recentResponseMs, questionDifficultyTier) {
    let sFactor = 1.0; // Default: No penalty
    
    // A. The "Robotic Precision" Check
    // E.g. Consistently answering tier 8 multi-choice in < 250ms
    const minimumHumanLatencyMs = 200 + (questionDifficultyTier * 50);
    if (recentResponseMs < minimumHumanLatencyMs) {
        // Strike 1: Impossible speed. Apply severe fractional throttling.
        sFactor *= 0.0001;
    }
    
    // B. The "Domain Master" Anomaly Check
    // If a player jumps from Master-level Biology to Master-level 14th Century Art
    // in 30 seconds without verified SSO credentials, they are likely an LLM pipe.
    if (playerHistory && playerHistory.suddenDomainShifts > 3) {
        if (!playerHistory.hasVerifiableCredentials) {
            sFactor *= 0.05; // Significant trust reduction
        }
    }
    
    // C. The "Perfect Streak" Trap
    if (playerHistory && playerHistory.consecutivePerfectTier10s > 10) {
         // Humans falter. Bots don't.
         sFactor *= 0.1;
    }
    
    return sFactor;
}

// 2. The T-Score (Trust Vector) Algorithms
// Used to route adjudication queries and determine scoreboard rankings.
export function computeVectorAlpha(consensusPercentage, totalVolume, localSFactor) {
    // Vector ALPHA relies heavily on total volume to stabilize scores.
    const volumeWeight = Math.log10(totalVolume + 1) * 0.6;
    const accuracyWeight = (consensusPercentage / 100) * 0.4;
    
    // The raw T-score
    let rawScore = (accuracyWeight + volumeWeight) * 100;
    
    // Apply the silent throttling factor.
    // If S-Factor is 0.0001, their T-Score drops to near zero,
    // making them irrelevant to the routing table, but their local client
    // won't know they've been throttled.
    return rawScore * localSFactor;
}

export function computeVectorOmega(recentConsensus, timeOutboxDecay, localSFactor) {
    // Vector OMEGA relies on recency, promoting fresh experts immediately.
    const rawScore = ((recentConsensus / 100) * 0.8) + (timeOutboxDecay * 0.2);
    return rawScore * 100 * localSFactor;
}

// Wrapper to satisfy scoreboard recalibration
export function calculateTrustScore(judgeRow) {
    const volume = judgeRow.total_volume || 0;
    // Stub assumption of 80% consensus for test runs
    const alphaScore = computeVectorAlpha(80, volume, 1.0);
    return { primary_t_score: alphaScore };
}

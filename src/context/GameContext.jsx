"use client";
import { createContext, useContext, useState, useEffect, useRef } from 'react';

const GameContext = createContext();

export const PLAYERS = ['RED', 'GREEN', 'YELLOW', 'BLUE'];

let audioCtx = null;
const playStepSound = () => {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
    } catch(e) {}
};

const INITIAL_PAWNS = {
  RED: [0, 1, 2, 3].map(id => ({ id: `RED_${id}`, position: -1, state: 'BASE', steps: 0, color: 'RED' })),
  GREEN: [0, 1, 2, 3].map(id => ({ id: `GREEN_${id}`, position: -1, state: 'BASE', steps: 0, color: 'GREEN' })),
  YELLOW: [0, 1, 2, 3].map(id => ({ id: `YELLOW_${id}`, position: -1, state: 'BASE', steps: 0, color: 'YELLOW' })),
  BLUE: [0, 1, 2, 3].map(id => ({ id: `BLUE_${id}`, position: -1, state: 'BASE', steps: 0, color: 'BLUE' })),
};

// Safe zones indices on the 52-block track
export const SAFE_ZONES = [0, 8, 13, 21, 26, 34, 39, 47];

export function GameProvider({ children }) {
  const [pawns, setPawns] = useState(INITIAL_PAWNS);
  const [currentTurn, setCurrentTurn] = useState(0); // Index of PLAYERS array
  const [diceValue, setDiceValue] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [turnState, setTurnState] = useState('WAITING_FOR_ROLL'); // WAITING_FOR_ROLL, WAITING_FOR_MOVE
  const [gamePhase, setGamePhase] = useState('SETUP'); // SETUP, PLAYING, FINISHED
  const [playerConfig, setPlayerConfig] = useState({ 
    RED: { type: 'HUMAN', name: 'RED PLAYER' },
    GREEN: { type: 'HUMAN', name: 'GREEN PLAYER' },
    YELLOW: { type: 'HUMAN', name: 'YELLOW PLAYER' },
    BLUE: { type: 'HUMAN', name: 'BLUE PLAYER' }
  });
  const [finishedPlayers, setFinishedPlayers] = useState([]); // Rank order: [1st, 2nd, ...]
  const [isHydrated, setIsHydrated] = useState(false);
  const [lastAttacker, setLastAttacker] = useState(null); // For revenge heuristic
  const [isMusicEnabled, setIsMusicEnabled] = useState(false);
  const [musicStatus, setMusicStatus] = useState('loading'); // loading, ready, error
  const musicRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('ludoSaveData');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPawns(parsed.pawns || INITIAL_PAWNS);
        setCurrentTurn(parsed.currentTurn ?? 0);
        setDiceValue(parsed.diceValue ?? null);
        setTurnState(parsed.turnState || 'WAITING_FOR_ROLL');
        setGamePhase(parsed.gamePhase || 'SETUP');
        setPlayerConfig(parsed.playerConfig || { 
          RED: { type: 'HUMAN', name: 'RED PLAYER' },
          GREEN: { type: 'HUMAN', name: 'GREEN PLAYER' },
          YELLOW: { type: 'HUMAN', name: 'YELLOW PLAYER' },
          BLUE: { type: 'HUMAN', name: 'BLUE PLAYER' }
        });
      } catch (e) {
        console.error("Failed to load save:", e);
      }
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isMusicEnabled) {
      // If music was in error or not initialized, try creation
      if (!musicRef.current || musicStatus === 'error') {
        if (musicRef.current) {
          musicRef.current.pause();
          musicRef.current = null;
        }
        
        setMusicStatus('loading');
        console.log("[Ludo] Loading local music /bgm.mp3");
        const audio = new Audio('/bgm.mp3');
        audio.loop = true;
        audio.volume = 0.2;
        audio.addEventListener('canplaythrough', () => setMusicStatus('ready'));
        audio.addEventListener('error', (e) => {
          console.error("[Ludo] Local Music Error:", e);
          setMusicStatus('error');
        });
        musicRef.current = audio;
      }
      
      musicRef.current.play().catch(error => {
        console.warn("[Ludo] Local playback failed:", error);
      });
    } else {
      if (musicRef.current) {
        musicRef.current.pause();
      }
    }
  }, [isMusicEnabled]);

  // Update rankings and detect game over
  useEffect(() => {
    if (gamePhase !== 'PLAYING') return;
    
    const possiblePlayers = PLAYERS.filter(c => playerConfig[c].type !== 'NONE');
    const justFinished = possiblePlayers.filter(color => 
      pawns[color]?.every(p => p.state === 'HOME') && !finishedPlayers.includes(color)
    );

    if (justFinished.length > 0) {
      setFinishedPlayers(prev => {
        let updated = [...prev, ...justFinished];
        
        // If all but one have finished, the last one is 4th
        if (updated.length >= possiblePlayers.length - 1 && possiblePlayers.length > 1) {
           const lastPlayer = possiblePlayers.find(p => !updated.includes(p));
           if (lastPlayer) {
              updated.push(lastPlayer);
           }
           // Use a small timeout to ensure the UI updates the last pawn movement before showing modal
           setTimeout(() => setGamePhase('FINISHED'), 1000);
        }
        
        return updated;
      });
    }
  }, [pawns, gamePhase, finishedPlayers, playerConfig]);

  useEffect(() => {
    if (!isHydrated) return;
    const dataToSave = { pawns, currentTurn, diceValue, turnState, gamePhase, playerConfig, finishedPlayers };
    localStorage.setItem('ludoSaveData', JSON.stringify(dataToSave));
  }, [pawns, currentTurn, diceValue, turnState, gamePhase, playerConfig, isHydrated, finishedPlayers]);

  const getValidMoves = (colorPawns, dice) => {
    return colorPawns.filter(pawn => {
      if (pawn.state === 'BASE' && dice === 6) return true;
      if (pawn.state === 'TRACK') return pawn.steps + dice <= 57;
      if (pawn.state === 'HOME_STRETCH') return pawn.steps + dice <= 57;
      return false;
    });
  };

  const getNextTurn = (startIdx, pConfig) => {
    let nextIdx = (startIdx + 1) % 4;
    
    // Continue checking until we find a valid next player or loop back to start
    while (nextIdx !== startIdx) {
      const color = PLAYERS[nextIdx];
      const isNone = pConfig[color].type === 'NONE';
      
      // Safety check: sometimes pawns for a color might not exist yet during setup
      const colorPawns = pawns[color] || [];
      const hasFinished = colorPawns.length > 0 && colorPawns.every(p => p.state === 'HOME');

      if (!isNone && !hasFinished) {
        return nextIdx;
      }
      
      nextIdx = (nextIdx + 1) % 4;
    }
    return startIdx;
  };

  const rollDice = () => {
    if (turnState !== 'WAITING_FOR_ROLL' || gamePhase !== 'PLAYING') return;
    setIsRolling(true);
    
    setTimeout(() => {
      const roll = Math.floor(Math.random() * 6) + 1;
      console.log(`[Ludo] Dice Rolled: ${roll}`);
      setDiceValue(roll);
      setIsRolling(false);
      
      const validMoves = getValidMoves(pawns[PLAYERS[currentTurn]], roll);
      if (validMoves.length === 0) {
        setTurnState('WAITING_FOR_ROLL');
        setDiceValue(null);
        if (roll !== 6) {
          setCurrentTurn((prev) => getNextTurn(prev, playerConfig));
        }
      } else {
        setTurnState('WAITING_FOR_MOVE');
      }
    }, 600);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // AI ENGINE — 30-CRITERIA HEURISTIC SCORING SYSTEM
  // ══════════════════════════════════════════════════════════════════════════
  const scoreAiMove = (pawn, dice, allPawns, color, lastAttackerColor) => {
    let score = 0;
    const START = { RED: 0, GREEN: 13, YELLOW: 26, BLUE: 39 };

    // Helper: get absolute track position for a pawn
    const getTrackPos = (p, c) =>
      p.state === 'TRACK' ? (START[c] + p.steps - 1) % 52 : null;

    // Helper: how many steps behind oppPawn is to myPos (on circular 52-ring)
    const stepsBehind = (oppColor, oppPawn, myPos) => {
      const oppPos = getTrackPos(oppPawn, oppColor);
      if (oppPos === null) return 999;
      const dist = (myPos - oppPos + 52) % 52;
      return dist; // 0 means same square
    };

    // ── BASE PAWN ──────────────────────────────────────────────────────────
    if (pawn.state === 'BASE') {
      const activeCount = allPawns[color].filter(
        p => p.state === 'TRACK' || p.state === 'HOME_STRETCH'
      ).length;

      // Criterion 12: Always deploy when no active pawns
      if (activeCount === 0) return 400;

      // Criterion 12: Spread — deploy when only 1 active
      if (activeCount === 1) score += 80;
      else score += 10; // Low priority if enough pawns active
      return score;
    }

    const newSteps = pawn.steps + dice;
    const newPos = newSteps <= 51 ? (START[color] + newSteps - 1) % 52 : null;
    const curPos = getTrackPos(pawn, color);

    // ── HIGHEST: Finish exactly ────────────────────────────────────────────
    // Criterion 30 (Final Push) & implicitly all finish-line criteria
    if (newSteps === 57) return 1000;

    // ── Criterion 21: Optimize Home Stretch — move pion that needs biggest dice first ──
    if (pawn.state === 'HOME_STRETCH') {
      const stepsLeft = 57 - pawn.steps;
      // Prefer pion with more steps remaining (needs larger dice) so it can advance sooner
      score += 120 + stepsLeft * 5;
    }

    // ── ATTACK CRITERIA ────────────────────────────────────────────────────

    // Criterion 1: Can capture ANY enemy?
    if (newPos !== null && !SAFE_ZONES.includes(newPos)) {
      let captureBonus = 0;
      let captureTarget = null;
      PLAYERS.forEach(opp => {
        if (opp === color) return;
        allPawns[opp].forEach(oppPawn => {
          if (oppPawn.state === 'TRACK' && oppPawn.position === newPos) {
            captureBonus = Math.max(captureBonus, 300);
            captureTarget = { color: opp, pawn: oppPawn };
          }
        });
      });

      if (captureTarget) {
        score += captureBonus;

        // Criterion 2: Prefer capturing enemy pawn closest to finish
        score += captureTarget.pawn.steps * 2; // More steps = bigger threat = bigger reward

        // Criterion 4: Target empuk — enemy is alone (not blocked/doubled)
        const alliesAtPos = allPawns[captureTarget.color].filter(
          p => p.state === 'TRACK' && p.position === captureTarget.pawn.position
        ).length;
        if (alliesAtPos === 1) score += 50; // Alone = easier target

        // Criterion 26: Revenge — prioritize the color that last attacked us
        if (captureTarget.color === lastAttackerColor) score += 80;

        // Criterion 27: Penghambat Pemimpin — target the leading player
        const oppHomeCount = allPawns[captureTarget.color].filter(p => p.state === 'HOME').length;
        const myHomeCount = allPawns[color].filter(p => p.state === 'HOME').length;
        if (oppHomeCount > myHomeCount) score += 60; // They're winning — attack them!
      }
    }

    // Criterion 3: Protect new pion from being captured at enemy's start area
    // (penalize landing very close to enemy start positions)
    if (newPos !== null) {
      const enemyStarts = PLAYERS.filter(c => c !== color).map(c => START[c]);
      if (enemyStarts.some(s => s === newPos)) score -= 60;
    }

    // ── DEFENSE CRITERIA ───────────────────────────────────────────────────

    // Criterion 6: Escape imminent threat (enemy is 1-6 steps behind current pos)
    let isCurrentlyThreatened = false;
    if (curPos !== null && !SAFE_ZONES.includes(curPos)) {
      isCurrentlyThreatened = PLAYERS.some(opp => {
        if (opp === color) return false;
        return allPawns[opp].some(oppPawn => {
          if (oppPawn.state !== 'TRACK') return false;
          const dist = stepsBehind(opp, oppPawn, curPos);
          return dist > 0 && dist <= 6;
        });
      });
      if (isCurrentlyThreatened) score += 100; // High priority: escape!
    }

    // Criterion 7: Land on safe zone
    if (newPos !== null && SAFE_ZONES.includes(newPos)) score += 70;

    // Criterion 8: Enter home stretch
    if (newSteps > 51 && newSteps <= 57) score += 150;

    // Criterion 9: Form a blockade — land on same square as own pawn
    if (newPos !== null) {
      const alliesAtNewPos = allPawns[color].filter(
        p => p.id !== pawn.id && p.state === 'TRACK' && p.position === newPos
      ).length;
      if (alliesAtNewPos >= 1) score += 55; // Form blockade!
    }

    // Criterion 10: Avoid stopping right in front of enemy start squares
    if (newPos !== null && !SAFE_ZONES.includes(newPos)) {
      const nearEnemyStart = PLAYERS.filter(c => c !== color).some(opp => {
        const dist = (newPos - START[opp] + 52) % 52;
        return dist <= 2; // Very close to their spawn
      });
      if (nearEnemyStart) score -= 45;
    }

    // ── PROGRESS / STRATEGY CRITERIA ──────────────────────────────────────

    // Criterion 11: Prioritize frontrunner
    const activePawns = allPawns[color].filter(
      p => p.state === 'TRACK' || p.state === 'HOME_STRETCH'
    );
    const maxSteps = Math.max(...activePawns.map(p => p.steps), 0);
    if (pawn.steps === maxSteps) score += 30; // Advance frontrunner

    // Criterion 14: Spread — distribute pawns across board, don't cluster
    if (curPos !== null) {
      const clusterCount = allPawns[color].filter(
        p => p.id !== pawn.id && p.state === 'TRACK' && p.position === curPos
      ).length;
      if (clusterCount > 0) score += 35; // Moving out of cluster is good (unless forming blockade)
    }

    // Criterion 16: Efficiency — if dice is 1, prioritize getting to safe zone
    if (dice === 1 && newPos !== null && SAFE_ZONES.includes(newPos)) score += 60;

    // Criterion 17: Don't move pawn already in safe zone if another is threatened
    if (curPos !== null && SAFE_ZONES.includes(curPos) && !isCurrentlyThreatened) {
      const othersThreatened = allPawns[color].some(p => {
        if (p.id === pawn.id || p.state !== 'TRACK') return false;
        const pos = getTrackPos(p, color);
        if (pos === null || SAFE_ZONES.includes(pos)) return false;
        return PLAYERS.some(opp => {
          if (opp === color) return false;
          return allPawns[opp].some(op => {
            if (op.state !== 'TRACK') return false;
            const d = stepsBehind(opp, op, pos);
            return d > 0 && d <= 6;
          });
        });
      });
      if (othersThreatened) score -= 50; // Better to move a threatened pawn
    }

    // Criterion 18: Waiting tactic — if no attack/defend available, catch up laggard
    const allAttractionsLow = score < 50;
    if (allAttractionsLow) {
      const minSteps = Math.min(...activePawns.map(p => p.steps));
      if (pawn.steps === minSteps) score += 20; // Move the laggard to catch up
    }

    // ── PROBABILITY CRITERIA ───────────────────────────────────────────────

    // Criterion 19: Danger zone — enemy > 6 behind = relatively safe
    if (newPos !== null && !SAFE_ZONES.includes(newPos)) {
      const isInDanger = PLAYERS.some(opp => {
        if (opp === color) return false;
        return allPawns[opp].some(oppPawn => {
          if (oppPawn.state !== 'TRACK') return false;
          const dist = stepsBehind(opp, oppPawn, newPos);
          return dist > 0 && dist <= 6;
        });
      });
      if (isInDanger) score -= 50; // Risky landing
    }

    // Criterion 22: Open a blockade only if it can capture or has no other choice
    // (handled naturally by scoring — low-value blockade move will lose to capture/safe)

    // Criterion 23: With dice 6, move endangered pawn first (before bonus roll)
    if (dice === 6 && isCurrentlyThreatened) score += 40;

    // Criterion 25: Prefer landing safe over advancing recklessly despite progression
    if (newPos !== null && SAFE_ZONES.includes(newPos)) score += 20; // Extra safe bonus

    // Criterion 28: Protect near-finish pion — if another pawn is very close (steps > 45),
    // prioritize it as a bodyguard pathway by not blocking it with a slower pawn
    const nearFinish = allPawns[color].filter(p => p.steps > 45 && p.id !== pawn.id);
    if (nearFinish.length > 0 && pawn.steps < 30) score -= 15; // Let frontrunner through

    // General progress score
    score += pawn.steps * 0.3;

    return score;
  };

  // AI Automation Effect
  useEffect(() => {
    if (gamePhase !== 'PLAYING') return;

    const currentPlayerColor = PLAYERS[currentTurn];
    const isAiTurn = playerConfig[currentPlayerColor].type === 'AI';
    
    if (isAiTurn) {
       if (turnState === 'WAITING_FOR_ROLL' && !isRolling) {
           const timer = setTimeout(() => {
              rollDice();
           }, 800);
           return () => clearTimeout(timer);
       } else if (turnState === 'WAITING_FOR_MOVE' && diceValue) {
           const timer = setTimeout(() => {
              const validMoves = getValidMoves(pawns[currentPlayerColor], diceValue);
              if (validMoves.length > 0) {
                 const scored = validMoves.map(p => ({
                   pawn: p,
                   score: scoreAiMove(p, diceValue, pawns, currentPlayerColor, lastAttacker)
                 }));
                 scored.sort((a, b) => b.score - a.score);
                 movePawn(currentPlayerColor, scored[0].pawn.id);
              }
           }, 800);
           return () => clearTimeout(timer);
       }
    }
  }, [currentTurn, turnState, isRolling, diceValue, gamePhase, playerConfig, pawns]);

  const delay = (ms) => new Promise(res => setTimeout(res, ms));

  const movePawn = async (color, pawnId) => {
    if (turnState !== 'WAITING_FOR_MOVE' || PLAYERS[currentTurn] !== color || isMoving || isRolling) return;

    // Double guard: ensure this pawn is actually a valid move
    const validMoves = getValidMoves(pawns[color], diceValue);
    if (!validMoves.find(p => p.id === pawnId)) return;

    setIsMoving(true);

    const startPositions = { 'RED': 0, 'GREEN': 13, 'YELLOW': 26, 'BLUE': 39 };

    // Capture exact current pawn state from closure
    const pawnIndex = pawns[color].findIndex(p => p.id === pawnId);
    if (pawnIndex === -1) {
       setIsMoving(false);
       return;
    }
    
    let targetPawn = { ...pawns[color][pawnIndex] };

    if (targetPawn.state === 'BASE') {
      if (diceValue === 6) {
        targetPawn.state = 'TRACK';
        targetPawn.steps = 1;
        targetPawn.position = startPositions[color];

        setPawns(prev => {
           const np = { ...prev };
           const clonePlayer = [...np[color]];
           clonePlayer[pawnIndex] = targetPawn;
           np[color] = clonePlayer;
           return np;
        });

        await delay(200);
      }
    } else {
      if (targetPawn.steps + diceValue > 57) {
        setIsMoving(false);
        return; // Invalid move
      }

      // Step-by-step animation loop
      for(let i = 0; i < diceValue; i++) {
        targetPawn.steps++;

        if (targetPawn.steps <= 51) {
          targetPawn.state = 'TRACK';
          targetPawn.position = (startPositions[color] + targetPawn.steps - 1) % 52;
        } else if (targetPawn.steps <= 56) {
          targetPawn.state = 'HOME_STRETCH';
          targetPawn.position = targetPawn.steps - 52; // 0 to 4
        } else {
          targetPawn.state = 'HOME';
          targetPawn.position = -1;
        }

        setPawns(prev => {
           const np = { ...prev };
           const clonePlayer = [...np[color]];
           clonePlayer[pawnIndex] = { ...targetPawn };
           np[color] = clonePlayer;
           return np;
        });

        await delay(190); // 190ms trails the 180ms linear tween
        playStepSound();
      }
    }

    // Capture Mechanics (Predict synchronously using final state)
    let bonusTurn = diceValue === 6;
    let didWin = false;

    if (targetPawn.state === 'TRACK' && !SAFE_ZONES.includes(targetPawn.position)) {
      PLAYERS.forEach(oppColor => {
        if (oppColor !== color) {
           const hasOverlap = pawns[oppColor].some(p => p.state === 'TRACK' && p.position === targetPawn.position);
           if (hasOverlap) bonusTurn = true;
        }
      });
    }

    if (targetPawn.state === 'HOME') {
       bonusTurn = true; 
    }

    const playerJustWon = targetPawn.state === 'HOME' && 
                          pawns[color].filter((_, idx) => idx !== pawnIndex).every(p => p.state === 'HOME');

    setPawns(prev => {
       const finalPawns = JSON.parse(JSON.stringify(prev));
       const finalPawn = finalPawns[color][pawnIndex];

       if (finalPawn.state === 'TRACK' && !SAFE_ZONES.includes(finalPawn.position)) {
         PLAYERS.forEach(oppColor => {
           if (oppColor !== color) {
             finalPawns[oppColor] = finalPawns[oppColor].map(oppPawn => {
               if (oppPawn.state === 'TRACK' && oppPawn.position === finalPawn.position) {
                 // Track who last attacked for revenge heuristic
                 setLastAttacker(color); // 'color' just kicked an opponent's pawn
                 return { ...oppPawn, state: 'BASE', steps: 0, position: -1 };
               }
               return oppPawn;
             });
           }
         });
       }

       didWin = finalPawns[color].every(p => p.state === 'HOME');
       return finalPawns;
    });

    setDiceValue(null);
    setTurnState('WAITING_FOR_ROLL');
    
    if (!bonusTurn) {
      setCurrentTurn((prevTurn) => getNextTurn(prevTurn, playerConfig));
    }

    setIsMoving(false);
  };

  const startGame = (newConfig) => {
    setPlayerConfig(newConfig);
    // Determine the first player that is not NONE
    let firstTurn = 0;
    while(newConfig[PLAYERS[firstTurn]].type === 'NONE' && firstTurn < 4) {
       firstTurn++;
    }
    setCurrentTurn(firstTurn);
    setGamePhase('PLAYING');
    setPawns(INITIAL_PAWNS);
    setDiceValue(null);
    setTurnState('WAITING_FOR_ROLL');
  };

  const resetGame = () => {
    setPawns(INITIAL_PAWNS);
    setGamePhase('SETUP');
    setCurrentTurn(0);
    setDiceValue(null);
    setTurnState('WAITING_FOR_ROLL');
    setLastAttacker(null);
    setFinishedPlayers([]);
    setPlayerConfig({ 
      RED: { type: 'HUMAN', name: 'RED PLAYER' },
      GREEN: { type: 'HUMAN', name: 'GREEN PLAYER' },
      YELLOW: { type: 'HUMAN', name: 'YELLOW PLAYER' },
      BLUE: { type: 'HUMAN', name: 'BLUE PLAYER' }
    });
  };

  if (!isHydrated) return null; // Avoid hydration mismatch visually

  return (
    <GameContext.Provider value={{ 
      pawns, currentTurn, diceValue, isRolling, isMoving, turnState, gamePhase, playerConfig, finishedPlayers,
      rollDice, movePawn, startGame, resetGame, getValidMoves,
      isMusicEnabled, setIsMusicEnabled,
      musicStatus
    }}>
      {children}
    </GameContext.Provider>
  );
}

export const useGame = () => useContext(GameContext);

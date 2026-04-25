"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { GameProvider, useGame, PLAYERS } from '../context/GameContext';
import styles from './GameBoard.module.css';

// Player panel for each color, shown around the board
const PlayerPanel = ({ color, position }) => {
  const { 
    currentTurn, diceValue, isRolling, isMoving, rollDice, turnState, playerConfig, pawns, finishedPlayers 
  } = useGame();
  const isMyTurn = PLAYERS[currentTurn] === color;
  const isAi = playerConfig[color].type === 'AI';
  const isNone = playerConfig[color].type === 'NONE';
  const homePawns = pawns[color]?.filter(p => p.state === 'HOME').length || 0;

  const isFinished = homePawns === 4;
  const isActionDisabled = !isMyTurn || isAi || isMoving || turnState === 'WAITING_FOR_MOVE' || isFinished;

  // Rank logic
  const rank = finishedPlayers.indexOf(color) + 1;
  const rankText = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : '4th';

  // Status text
  let statusText = '';
  if (isNone) statusText = 'Not Playing';
  else if (isFinished) statusText = rank > 0 ? `🏆 ${rankText} PLACE!` : '🏁 FINISHED!';
  else if (!isMyTurn) statusText = 'Waiting...';
  else if (isAi) statusText = 'Thinking...';
  else if (turnState === 'WAITING_FOR_ROLL') statusText = '🎲 Click to Roll!';
  else statusText = '➡️ Move a Pawn';

  const rankClass = rank > 0 ? styles[`finish${rank}${rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'}`] : '';

  return (
    <div 
      className={`${styles.playerPanel} ${styles[`panel${color.charAt(0) + color.slice(1).toLowerCase()}`]} ${isMyTurn ? styles.activePanel : ''} ${isNone ? styles.inactivePanel : ''} ${rankClass}`}
      data-position={position}
    >
      <div className={styles.panelHeader}>
        <span className={styles.playerName} style={{ color: `var(--${color.toLowerCase()}-color)` }}>
          {playerConfig[color].name}
        </span>
        <span className={styles.playerType}>{isNone ? '—' : isAi ? '🤖 CPU' : '👤 P'}</span>
      </div>

      {/* Pion counters */}
      <div className={styles.pawnsProgress}>
        {[0,1,2,3].map(i => (
          <div 
            key={i}
            className={styles.progressDot}
            style={{ background: i < homePawns ? `var(--${color.toLowerCase()}-color)` : 'rgba(255,255,255,0.15)' }}
          />
        ))}
      </div>

      {/* Dice */}
      {!isNone && (
        <div
          className={`${styles.dice} ${isMyTurn && isRolling ? styles.rolling : ''} ${isMyTurn ? styles.diceActive : ''}`}
          onClick={!isActionDisabled ? rollDice : undefined}
          style={{
            '--face-color': isMyTurn && diceValue ? `var(--${color.toLowerCase()}-color)` : 'rgba(255,255,255,0.3)',
            opacity: isMyTurn && !isActionDisabled ? 1 : (isMyTurn ? 0.6 : 0.25),
            cursor: !isActionDisabled ? 'pointer' : 'default',
            pointerEvents: !isActionDisabled ? 'auto' : 'none',
            fontSize: isMyTurn ? '2rem' : '1.4rem',
          }}
        >
          {isMyTurn && isRolling ? '⏳' : (isMyTurn && diceValue ? diceValue : '🎲')}
        </div>
      )}

      <p className={styles.panelStatus}>{statusText}</p>
    </div>
  );
};

export const TRACK_PATH = [
  [7, 2], [7, 3], [7, 4], [7, 5], [7, 6],
  [6, 7], [5, 7], [4, 7], [3, 7], [2, 7], [1, 7],
  [1, 8], [1, 9],
  [2, 9], [3, 9], [4, 9], [5, 9], [6, 9],
  [7, 10], [7, 11], [7, 12], [7, 13], [7, 14], [7, 15],
  [8, 15], [9, 15],
  [9, 14], [9, 13], [9, 12], [9, 11], [9, 10],
  [10, 9], [11, 9], [12, 9], [13, 9], [14, 9], [15, 9],
  [15, 8], [15, 7],
  [14, 7], [13, 7], [12, 7], [11, 7], [10, 7],
  [9, 6], [9, 5], [9, 4], [9, 3], [9, 2], [9, 1],
  [8, 1], [7, 1]
];

export const HOME_STRETCHES = {
  RED: [[8, 2], [8, 3], [8, 4], [8, 5], [8, 6]],
  GREEN: [[2, 8], [3, 8], [4, 8], [5, 8], [6, 8]],
  YELLOW: [[8, 14], [8, 13], [8, 12], [8, 11], [8, 10]],
  BLUE: [[14, 8], [13, 8], [12, 8], [11, 8], [10, 8]],
};

export const SAFE_ZONES = [0, 8, 13, 21, 26, 34, 39, 47];

const BASE_COORDS = {
  RED: [[3, 3], [3, 5], [5, 3], [5, 5]],
  GREEN: [[3, 11], [3, 13], [5, 11], [5, 13]],
  YELLOW: [[12, 11], [12, 13], [14, 11], [14, 13]],
  BLUE: [[12, 3], [12, 5], [14, 3], [14, 5]]
};

const Pawn = ({ pawnId, color, isSelectable, onClick, gridPosition, indexInCell, totalInCell }) => {
  const getTransform = (idx, total) => {
    if (total <= 1) return { transform: 'scale(0.85)' };
    
    // Position offsets for multiple pawns in one cell
    if (total === 2) {
      return { transform: `translate(${idx === 0 ? '-22%' : '22%'}, 0) scale(0.65)` };
    }
    
    // 3 or 4 pawns use a 2x2 grid approach inside the cell
    const offsets = [
      { transform: 'translate(-22%, -22%) scale(0.55)' },
      { transform: 'translate(22%, -22%) scale(0.55)' },
      { transform: 'translate(-22%, 22%) scale(0.55)' },
      { transform: 'translate(22%, 22%) scale(0.55)' }
    ];
    return offsets[idx % 4];
  };

  const transformStyle = getTransform(indexInCell, totalInCell);

  const [r, c] = gridPosition || [1, 1];

  const variants = {
    move: {
      scale: isSelectable ? 1.15 : 1,
      boxShadow: isSelectable ? "0 0 15px rgba(255,255,255,0.4)" : "none"
    }
  };

  const itemStyle = gridPosition ? {
    gridArea: `${r} / ${c} / ${r + 1} / ${c + 1}`,
    placeSelf: 'center',
    zIndex: isSelectable ? 200 : 100,
    ...transformStyle
  } : {
    position: 'relative',
    zIndex: isSelectable ? 200 : 10,
    ...transformStyle
  };

  return (
    <motion.div
      layoutId={pawnId}
      className={`${styles.pawn} ${isSelectable ? styles.selectable : ''} ${totalInCell > 1 ? styles.multiplePawns : ''}`}
      data-color={color}
      data-cell-index={indexInCell}
      onClick={onClick}
      style={itemStyle}
      initial={false}
      animate="move"
      variants={variants}
      transition={{ 
        type: "tween", 
        ease: "linear",
        duration: 0.18 
      }}
    />
  );
};

const Board = () => {
  const { pawns, movePawn, currentTurn, turnState, diceValue, playerConfig, isMoving, getValidMoves } = useGame();
  
  const currentColor = PLAYERS[currentTurn];
  const validPawnIds = new Set(
    (diceValue && turnState === 'WAITING_FOR_MOVE')
      ? getValidMoves(pawns[currentColor], diceValue).map(p => p.id)
      : []
  );
  
  const getPawnsAtTrackPosition = (index) => {
    let list = [];
    Object.keys(pawns).forEach(color => {
      list.push(...pawns[color].filter(p => p.state === 'TRACK' && p.position === index));
    });
    return list;
  };

  const getPawnsAtBase = (color) => {
    return pawns[color].filter(p => p.state === 'BASE');
  };

  const getPawnsAtHomeStretch = (color, index) => {
    return pawns[color].filter(p => p.state === 'HOME_STRETCH' && p.position === index);
  };

  const isCurrentPlayerColor = (color) => PLAYERS[currentTurn] === color;

  const handlePawnClick = (color, pawnId) => {
    if (turnState === 'WAITING_FOR_MOVE' && isCurrentPlayerColor(color) && !isMoving && validPawnIds.has(pawnId)) {
      movePawn(color, pawnId);
    }
  };

  return (
    <div className={styles.boardContainer}>
      <div className={styles.grid}>
        
        {/* Render base areas */}
        {['RED', 'GREEN', 'YELLOW', 'BLUE'].map((color) => {
          const colorClass = styles[`${color.toLowerCase()}Base`];
          const pawnsAtBase = pawns[color].filter(p => p.state === 'BASE');
          
          return (
            <div key={`${color}-base`} className={`${styles.base} ${colorClass}`}>
              <div className={styles.baseInner}>
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className={styles.baseSpot}>
                    {pawnsAtBase[i] && (
                      <Pawn 
                        pawnId={pawnsAtBase[i].id}
                        color={color}
                        isSelectable={turnState === 'WAITING_FOR_MOVE' && !isMoving && isCurrentPlayerColor(color) && validPawnIds.has(pawnsAtBase[i].id)}
                        onClick={() => handlePawnClick(color, pawnsAtBase[i].id)}
                        totalInCell={1}
                        indexInCell={0}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Center */}
        <div className={styles.homeCenter}>
           <div className={`${styles.homeTriangle} ${styles.homeTriangleRed}`}></div>
           <div className={`${styles.homeTriangle} ${styles.homeTriangleGreen}`}></div>
           <div className={`${styles.homeTriangle} ${styles.homeTriangleYellow}`}></div>
           <div className={`${styles.homeTriangle} ${styles.homeTriangleBlue}`}></div>
        </div>

        {/* Render Track & Safe Spot Styles purely visual */}
        {TRACK_PATH.map(([r, c], index) => {
          const isSafe = SAFE_ZONES.includes(index);
          let specialClass = '';
          if (index === 0) specialClass = styles.startRed;
          if (index === 13) specialClass = styles.startGreen;
          if (index === 26) specialClass = styles.startYellow;
          if (index === 39) specialClass = styles.startBlue;

          return (
            <div 
              key={`track-vis-${index}`} 
              className={`${styles.trackSquare} ${specialClass}`}
              style={{ gridArea: `${r} / ${c} / ${r + 1} / ${c + 1}`, pointerEvents: 'none' }}
            >
              {isSafe && !specialClass && <div className={styles.safeZone}><svg viewBox="0 0 24 24" className={styles.safeZoneIcon}><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg></div>}
            </div>
          );
        })}

        {/* Render Home Stretches Visuals */}
        {['RED', 'GREEN', 'YELLOW', 'BLUE'].map(color => {
          return HOME_STRETCHES[color].map(([r, c], index) => {
             return (
               <div
                 key={`home-vis-${color}-${index}`}
                 className={`${styles.trackSquare} ${styles[`homeStretch${color.charAt(0) + color.slice(1).toLowerCase()}`]}`}
                 style={{ gridArea: `${r} / ${c} / ${r + 1} / ${c + 1}`, pointerEvents: 'none' }}
               />
             );
          });
        })}

        {/* Render Pawns dynamically on top */}
        {Object.keys(pawns).map(color => {
           if (playerConfig[color] === 'NONE') return null;
           return pawns[color].map((pawn, pIdx) => {
              if (pawn.state === 'BASE' || pawn.state === 'HOME') return null;
              
              let coords = [1, 1];
              if (pawn.state === 'TRACK') coords = TRACK_PATH[pawn.position];
              else if (pawn.state === 'HOME_STRETCH') coords = HOME_STRETCHES[color][pawn.position];

              // Overlap check: 
              // For TRACK: any pawn on the same position overlaps.
              // For HOME_STRETCH: only pawns of the same COLOR on the same position overlap.
              const siblings = Object.values(pawns).flat().filter(p => {
                if (p.state !== pawn.state || p.position !== pawn.position) return false;
                if (p.state === 'HOME_STRETCH') return p.color === pawn.color;
                return true;
              });
              const indexInCell = siblings.findIndex(s => s.id === pawn.id);

              return (
                 <Pawn 
                    key={pawn.id}
                    pawnId={pawn.id}
                    color={pawn.color}
                    gridPosition={coords}
                    indexInCell={indexInCell === -1 ? 0 : indexInCell}
                    totalInCell={siblings.length}
                    isSelectable={turnState === 'WAITING_FOR_MOVE' && !isMoving && isCurrentPlayerColor(color) && validPawnIds.has(pawn.id)}
                    onClick={() => handlePawnClick(color, pawn.id)}
                 />
              );
           });
        })}
      </div>
    </div>
  );
}

const SetupMenu = () => {
  const { startGame } = useGame();
  const [config, setConfig] = React.useState({
    RED: { type: 'HUMAN', name: 'RED' },
    GREEN: { type: 'HUMAN', name: 'GREEN' },
    YELLOW: { type: 'HUMAN', name: 'YELLOW' },
    BLUE: { type: 'HUMAN', name: 'BLUE' },
  });

  const toggleType = (color) => {
    setConfig(prev => {
      const types = ['HUMAN', 'AI', 'NONE'];
      const currentIndex = types.indexOf(prev[color].type);
      return { 
        ...prev, 
        [color]: { ...prev[color], type: types[(currentIndex + 1) % types.length] } 
      };
    });
  };

  const updateName = (color, name) => {
    setConfig(prev => ({
      ...prev,
      [color]: { ...prev[color], name: name.toUpperCase() }
    }));
  };

  const startValid = Object.values(config).filter(c => c.type !== 'NONE').length >= 2;

  return (
    <div className={styles.setupMenu}>
      <h2>Setup Players</h2>
      <div className={styles.playerList}>
        {['RED', 'GREEN', 'YELLOW', 'BLUE'].map(color => (
          <div key={color} className={styles.setupRow}>
             <input 
               type="text"
               value={config[color].name}
               onChange={(e) => updateName(color, e.target.value)}
               className={styles.setupInput}
               style={{ color: `var(--${color.toLowerCase()}-color)` }}
             />
             <button 
               onClick={() => toggleType(color)} 
               className={`${styles.setupAction} ${styles[config[color].type]}`}
             >
               {config[color].type}
             </button>
          </div>
        ))}
      </div>
      <button   
        className={styles.startButton} 
        disabled={!startValid} 
        onClick={() => startGame(config)}
      >
        START GAME
      </button>
    </div>
  );
};

const RankingModal = () => {
  const { finishedPlayers, resetGame } = useGame();
  
  return (
    <div className={styles.modalOverlay}>
      <motion.div 
        initial={{ scale: 0.8, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className={styles.rankingModal}
      >
        <h2 className={styles.modalTitle}>🏆 Hall of Fame</h2>
        <div className={styles.rankingList}>
          {finishedPlayers.map((color, i) => {
            const rank = i + 1;
            const rankText = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : '4th';
            const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🎗️';
            
            return (
              <div key={color} className={`${styles.rankingRow} ${styles[`rank${rank}`]}`}>
                <div className={styles.rankInfo}>
                  <span className={styles.rankNum}>{rankEmoji} {rankText}</span>
                  <span className={styles.rankName} style={{ color: `var(--${color.toLowerCase()}-color)` }}>{color}</span>
                </div>
                <span className={styles.rankStatus}>{rank === 1 ? 'WINNER!' : 'FINISHED'}</span>
              </div>
            );
          })}
        </div>
        <button onClick={resetGame} className={styles.modalRestartBtn}>
          PLAY AGAIN
        </button>
      </motion.div>
    </div>
  );
};

const GameBoardContent = () => {
  const { gamePhase, resetGame, isMusicEnabled, setIsMusicEnabled } = useGame();
  
  if (gamePhase === 'SETUP') {
    return (
      <div className={styles.setupContainer}>
         <SetupMenu />
      </div>
    );
  }

  return (
    <div className={styles.gameWrapper}>
      <PlayerPanel color="RED" position="top-left" />
      <PlayerPanel color="GREEN" position="top-right" />
      <PlayerPanel color="BLUE" position="bot-left" />
      <div className={styles.boardCenter}>
        <Board />
        <div className={styles.resetRow}>
          <button onClick={resetGame} className={styles.resetBtn}>🔄 Restart</button>
        </div>
      </div>
      <PlayerPanel color="YELLOW" position="bot-right" />
      
      {gamePhase === 'FINISHED' && <RankingModal />}
    </div>
  );
}

export default function GameBoard() {
  return <GameBoardContent />;
}

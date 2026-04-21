import { useState, useEffect, useRef } from 'react';
import PokerCard from './PokerCard';

export default function PlayerSeat({
  player,
  position,
  isMe,
  isDealer,
  isCurrentPlayer,
  turnTime,
  turnStartTime,
  showCards
}) {
  const [timeLeft, setTimeLeft] = useState(turnTime);
  const [showMyCards, setShowMyCards] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isCurrentPlayer && turnStartTime) {
      const update = () => {
        const elapsed = (Date.now() - turnStartTime) / 1000;
        const remaining = Math.max(0, turnTime - elapsed);
        setTimeLeft(Math.ceil(remaining));
      };
      update();
      intervalRef.current = setInterval(update, 100);
      return () => clearInterval(intervalRef.current);
    } else {
      setTimeLeft(turnTime);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [isCurrentPlayer, turnStartTime, turnTime]);

  const timerPercent = isCurrentPlayer ? (timeLeft / turnTime) * 100 : 100;
  const timerColor = timeLeft <= 5 ? '#ef4444' : timeLeft <= 10 ? '#f59e0b' : '#00d4ff';

  return (
    <div
      className={`player-seat ${isMe ? 'seat-me' : ''} ${isCurrentPlayer ? 'seat-active' : ''} ${player.folded && !player.sittingOut ? 'seat-folded' : ''} ${player.sittingOut ? 'seat-waiting' : ''} ${player.allIn ? 'seat-allin' : ''} ${player.disconnected ? 'seat-disconnected' : ''}`}
      style={{
        left: `${position.left}%`,
        top: `${position.top}%`
      }}
    >
      <div className="seat-profile-group" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Timer ring */}
      {isCurrentPlayer && (
        <svg className="timer-ring" viewBox="0 0 44 44">
          <circle
            cx="22" cy="22" r="20"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="2"
          />
          <circle
            cx="22" cy="22" r="20"
            fill="none"
            stroke={timerColor}
            strokeWidth="2.5"
            strokeDasharray={`${timerPercent * 1.257} 125.7`}
            strokeLinecap="round"
            transform="rotate(-90 22 22)"
            className="timer-progress"
          />
        </svg>
      )}

      {/* Avatar */}
      <div className="seat-avatar">
        <span>{player.username[0].toUpperCase()}</span>
      </div>

      {/* Info */}
      <div className="seat-info">
        <span className="seat-name">{isMe ? 'Vous' : player.username}</span>
        <span className="seat-chips">
          <span className="chip-mini">🪙</span> {player.chips}
        </span>
      </div>

      {/* Badges */}
      {isDealer && <div className="dealer-chip">D</div>}
      {player.allIn && <div className="allin-badge">ALL IN</div>}
      {player.sittingOut && <div className="waiting-badge">⏳ Prochaine main</div>}
      {player.folded && !player.sittingOut && <div className="folded-badge">FOLD</div>}
      {player.disconnected && !player.sittingOut && <div className="disconnected-badge">📡</div>}
      </div>

      {/* Bet */}
      {player.bet > 0 && (
        <div className="seat-bet">
          <span className="bet-chips">🪙</span>
          <span className="bet-amount">{player.bet}</span>
        </div>
      )}

      {/* Hole cards */}
      {player.holeCards?.length > 0 && !isMe && (
        <div className="seat-cards">
          {showCards ? (
            player.holeCards.map((c, i) => (
              <PokerCard key={i} card={c} size="xs" />
            ))
          ) : (
            player.holeCards.map((_, i) => (
              <PokerCard key={`fd-${i}`} faceDown size="xs" />
            ))
          )}
        </div>
      )}
      {/* My Cards & Hold to reveal hint */}
      {isMe && player.holeCards?.length > 0 && (
        <div 
          className="my-cards-inline"
          onPointerDown={() => setShowMyCards(true)}
          onPointerUp={() => setShowMyCards(false)}
          onPointerLeave={() => setShowMyCards(false)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {player.holeCards.map((card, i) => (
              <PokerCard key={i} card={card} size="lg" faceDown={!showMyCards} />
            ))}
          </div>
          {!showMyCards && <div className="hold-to-reveal-hint">Maintenir pour voir</div>}
        </div>
      )}
    </div>
  );
}

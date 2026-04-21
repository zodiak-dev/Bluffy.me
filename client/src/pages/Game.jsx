import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';
import { useSocket } from '../context/SocketContext';
import PokerCard from '../components/PokerCard';
import PlayerSeat from '../components/PlayerSeat';
import ActionBar from '../components/ActionBar';
import DiscardSelector from '../components/DiscardSelector';
import Chat from '../components/Chat';
import EventLog from '../components/EventLog';

const SEAT_POSITIONS = [
  // Positions around an oval table (percentages), starting from bottom center
  { left: 50, top: 88 },   // 0 - bottom (you)
  { left: 15, top: 75 },   // 1
  { left: 3, top: 45 },    // 2
  { left: 15, top: 18 },   // 3
  { left: 42, top: 5 },    // 4
  { left: 58, top: 5 },    // 5
  { left: 85, top: 18 },   // 6
  { left: 97, top: 45 },   // 7
];

function getPlayerPositions(players, myId) {
  const myIndex = players.findIndex(p => p.id === myId);
  const n = players.length;
  const positions = [];

  // Evenly space players, with "me" always at seat 0
  for (let i = 0; i < n; i++) {
    const playerIdx = (myIndex + i) % n;
    const seatIdx = Math.round((i / n) * 8) % 8;
    positions.push({
      player: players[playerIdx],
      seat: SEAT_POSITIONS[seatIdx],
      seatIndex: seatIdx
    });
  }

  return positions;
}

export default function Game() {
  const { pin } = useParams();
  const { user } = useAuth();
  const { gameState, showdown, gameOver, restartVotes, events, chat, botMessage, playerAction, sendChat, leaveRoom, joinRoom, voteRestart, requestBlindsVote, voteBlinds } = useGame();
  const { socket, connected } = useSocket();
  const navigate = useNavigate();
  const [showChat, setShowChat] = useState(false);
  const [showMyCards, setShowMyCards] = useState(false);
  const [hasVotedRestart, setHasVotedRestart] = useState(false);
  const [hasVotedBlinds, setHasVotedBlinds] = useState(false);
  const [error, setError] = useState('');

  // Auto-join if navigating directly
  useEffect(() => {
    if (!connected || !pin) return;
    if (gameState?.pin === pin) return;

    // Reset local restart vote state if we join a new room
    setHasVotedRestart(false);

    async function autoJoin() {
      const result = await joinRoom(pin);
      if (result?.error) {
        setError(result.error);
        setTimeout(() => navigate('/'), 2000);
      }
    }
    autoJoin();
  }, [connected, pin]);

  // Redirect to lobby if game goes back to waiting
  useEffect(() => {
    if (gameState?.phase === 'waiting' && gameState?.pin) {
      // Don't redirect during showdown transition
    }
  }, [gameState?.phase]);

  useEffect(() => {
    if (!gameOver) {
      setHasVotedRestart(false);
    }
  }, [gameOver]);

  // Reset blinds vote local state
  useEffect(() => {
    if (gameState?.phase !== 'blinds_vote') {
      setHasVotedBlinds(false);
    }
  }, [gameState?.phase]);

  async function handleLeave() {
    await leaveRoom();
    navigate('/');
  }

  if (!gameState) {
    return (
      <div className="game-page">
        <div className="loading-screen"><div className="spinner" /><p>Connexion à la table...</p></div>
      </div>
    );
  }

  const players = gameState.players || [];
  const positions = getPlayerPositions(players, user.id);
  const myPlayer = players.find(p => p.id === user.id);
  const isMyTurn = gameState.actions?.length > 0;

  return (
    <div className={`game-page ${isMyTurn ? 'my-turn' : ''}`}>
      {/* Bot Alert Toast */}
      {botMessage && (
        <div className="bot-alert" style={{
          position: 'fixed', top: '10%', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--warning)', color: '#000', padding: '1rem 2rem',
          borderRadius: 'var(--radius-lg)', fontWeight: 'bold', zIndex: 2000,
          boxShadow: '0 4px 20px rgba(245, 158, 11, 0.4)', textAlign: 'center', animation: 'slideDown 0.4s ease'
        }}>
          🤖 {botMessage}
        </div>
      )}

      {/* Top bar */}
      <div className="game-topbar">
        <button className="btn-icon-round" onClick={handleLeave} title="Quitter">
          ✕
        </button>
        <div className="topbar-info">
          {gameState.settings?.isQuickMatch ? (
            <span className="room-badge quick-match">⚡ Rapide</span>
          ) : (
            <span className="room-badge private-match">🔒 Privé : {gameState.pin}</span>
          )}
          <span className="hand-number">Main #{gameState.handNumber}</span>
          <span className="blinds-info">{gameState.settings?.smallBlind}/{gameState.settings?.bigBlind}</span>
          {!gameState.blindsVoteRequested && gameState.phase !== 'blinds_vote' && (
            <button className="btn-icon-tiny" onClick={requestBlindsVote} title="Demander un vote pour augmenter les blindes" style={{ cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text-muted)' }}>
               ⬆️ Vote
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn-icon-round"
            onClick={() => navigate('/cosmetics')}
            title="Cosmétiques"
          >
            🎨
          </button>
          <button
            className={`btn-icon-round ${showChat ? 'active' : ''}`}
            onClick={() => setShowChat(!showChat)}
          >
            💬
          </button>
        </div>
      </div>

      {/* Poker Table */}
      <div className="table-container">
        <div className={`poker-table theme-${user?.tableTheme ?? 'default'}`}>
          <div className="table-felt">
            {/* Pot */}
            {gameState.pot > 0 && (
              <div className="pot-display">
                <div className="pot-chips">
                  <span className="chip-icon">🪙</span>
                </div>
                <span className="pot-amount">{gameState.pot}</span>
              </div>
            )}

            {/* Community cards */}
            <div className="community-cards">
              {gameState.communityCards?.map((card, i) => (
                <PokerCard key={i} card={card} delay={i * 150} />
              ))}
              {/* Empty slots */}
              {Array.from({ length: 5 - (gameState.communityCards?.length || 0) }).map((_, i) => (
                <div key={`empty-${i}`} className="card-slot" />
              ))}
            </div>

            {/* Phase indicator */}
            {gameState.phase !== 'waiting' && (
              <div className="phase-badge">
                {gameState.phase === 'preflop' ? 'Pré-Flop' :
                 gameState.phase === 'flop' ? 'Flop' :
                 gameState.phase === 'turn' ? 'Turn' :
                 gameState.phase === 'river' ? 'River' :
                 gameState.phase === 'showdown' ? 'Abattage' : ''}
              </div>
            )}
          </div>

          {/* Player seats */}
          {positions.map(({ player, seat, seatIndex }) => (
            <PlayerSeat
              key={player.id}
              player={player}
              position={seat}
              isMe={player.id === user.id}
              isDealer={player.isDealer}
              isCurrentPlayer={player.isCurrentPlayer}
              turnTime={gameState.turnTime}
              turnStartTime={gameState.turnStartTime}
              showCards={player.id === user.id || gameState.phase === 'showdown'}
            />
          ))}
        </div>
      </div>

      {/* Showdown overlay */}
      {showdown && (
        <div className="showdown-overlay">
          <div className="showdown-content">
            <h2 className="showdown-title">🏆 Résultat</h2>
            
            {/* Display Board / Flop */}
            {showdown.communityCards?.length > 0 && (
              <div className="showdown-board" style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {showdown.communityCards.map((c, i) => (
                  <PokerCard key={i} card={c} size="sm" />
                ))}
              </div>
            )}

            {showdown.winners?.map(w => (
              <div key={w.playerId} className="winner-info">
                <span className="winner-name">{w.username}</span>
                <span className="winner-hand">{w.hand?.name}</span>
                <span className="winner-amount">+{w.amount} 🪙</span>
              </div>
            ))}
            {showdown.playerHands?.map(ph => (
              <div key={ph.playerId} className="showdown-hand">
                <span className="sh-name">{ph.username}</span>
                <div className="sh-cards">
                  {ph.holeCards?.map((c, i) => (
                    <PokerCard key={i} card={c} size="sm" />
                  ))}
                </div>
                <span className="sh-rank">{ph.hand?.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action bar */}
      {isMyTurn && (
        <ActionBar
          actions={gameState.actions}
          currentBet={gameState.currentBet}
          myBet={myPlayer?.bet || 0}
          myChips={myPlayer?.chips || 0}
          minRaise={gameState.minRaise}
          onAction={playerAction}
        />
      )}

      {/* Discard Phase */}
      {gameState.phase === 'discardWait' && myPlayer && !myPlayer.folded && !myPlayer.hasDiscarded && (
        <DiscardSelector holeCards={myPlayer.holeCards} communityCards={gameState.communityCards} />
      )}

      {/* Waiting state */}
      {gameState.phase === 'waiting' && !showdown && !gameOver && (
        <div className="waiting-overlay">
          <p>En attente de la prochaine main...</p>
        </div>
      )}

      {/* Game Over Overlay */}
      {gameOver && (
        <div className="showdown-overlay">
          <div className="showdown-content">
            <h2 className="showdown-title">🏁 Fin de Partie</h2>
            <p style={{ textAlign: 'center', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
              {gameOver.roundsPlayed} mains jouées
            </p>
            <div className="ranking-list" style={{ marginBottom: '1.5rem' }}>
              {[...gameOver.players].sort((a,b) => b.chips - a.chips).map((p, index) => (
                <div key={p.username} className="winner-info" style={{ background: index === 0 ? 'rgba(255, 215, 0, 0.15)' : 'rgba(255,255,255,0.05)', borderColor: index === 0 ? 'rgba(255, 215, 0, 0.3)' : 'var(--border)' }}>
                  <span className="winner-name">#{index + 1} {p.username} {index === 0 && '👑'}</span>
                  <span className="winner-amount">{p.chips} 🪙</span>
                </div>
              ))}
            </div>
            
            {hasVotedRestart ? (
              <button className="btn btn-accent btn-lg btn-block" disabled style={{ opacity: 0.8 }}>
                ⏳ En attente ({restartVotes.count}/{restartVotes.total})
              </button>
            ) : (
              <button 
                className="btn btn-accent btn-lg btn-block" 
                onClick={() => {
                  setHasVotedRestart(true);
                  voteRestart();
                }}
              >
                🗳️ Voter pour Recommencer
              </button>
            )}
            
            <button className="btn btn-ghost btn-block" onClick={handleLeave} style={{ marginTop: '0.5rem' }}>
              Quitter la table
            </button>
          </div>
        </div>
      )}

      {/* Blinds Vote Overlay */}
      {gameState.phase === 'blinds_vote' && (
        <div className="showdown-overlay">
          <div className="showdown-content" style={{ textAlign: 'center' }}>
            <h2 className="showdown-title">📈 Vote des Blindes</h2>
            <p style={{ marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
              Blindes actuelles : <strong style={{color: 'white'}}>{gameState.settings?.smallBlind} / {gameState.settings?.bigBlind} 🪙</strong>
            </p>
            <p style={{ marginBottom: '1.5rem' }}>
              Souhaitez-vous doubler les blindes pour la prochaine main ?
            </p>
            
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
              <button 
                className="btn btn-accent" 
                style={{ flex: 1 }}
                disabled={hasVotedBlinds}
                onClick={() => { setHasVotedBlinds(true); voteBlinds('increase'); }}
              >
                👍 Doubler ({gameState.blindsVotes?.increase || 0})
              </button>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1 }}
                disabled={hasVotedBlinds}
                onClick={() => { setHasVotedBlinds(true); voteBlinds('keep'); }}
              >
                👎 Garder ({gameState.blindsVotes?.keep || 0})
              </button>
            </div>
            
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              En attente : {gameState.blindsVotes?.votedPlayers?.length || 0} / {players.filter(p => !p.disconnected && p.chips > 0).length} joueurs...
            </div>
          </div>
        </div>
      )}

      {/* Chat panel */}
      {showChat && (
        <Chat messages={chat} onSend={sendChat} onClose={() => setShowChat(false)} />
      )}

      {/* Event log */}
      <EventLog events={events} />

      {error && <div className="error-toast">{error}</div>}
    </div>
  );
}

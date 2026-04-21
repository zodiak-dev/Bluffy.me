import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';
import { useSocket } from '../context/SocketContext';

export default function Lobby() {
  const { pin: urlPin } = useParams();
  const { user } = useAuth();
  const { gameState, setReady, startGame, leaveRoom, updateSettings, kickPlayer, joinRoom, createRoom } = useGame();
  const { connected } = useSocket();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState({
    variant: 'texas',
    smallBlind: 5,
    bigBlind: 10,
    startingChips: 1000,
    turnTime: 30
  });

  // Auto-join room from URL
  useEffect(() => {
    if (!connected || !urlPin) return;
    if (gameState?.pin === urlPin) return;

    async function autoJoin() {
      const result = await joinRoom(urlPin);
      if (result.error) {
        setError(result.error);
        setTimeout(() => navigate('/'), 2000);
      }
    }
    autoJoin();
  }, [connected, urlPin]);

  // Redirect to game when started
  useEffect(() => {
    if (gameState?.phase && gameState.phase !== 'waiting' && gameState.pin) {
      navigate(`/game/${gameState.pin}`);
    }
  }, [gameState?.phase]);

  const isHost = gameState?.hostId === user?.id;
  const myPlayer = gameState?.players?.find(p => p.id === user?.id);
  const allReady = gameState?.players?.length >= 2 && gameState?.players?.every(p => p.isReady);

  async function handleStart() {
    setError('');
    const result = await startGame();
    if (result?.error) setError(result.error);
  }

  async function handleLeave() {
    await leaveRoom();
    navigate('/');
  }

  function copyPin() {
    navigator.clipboard.writeText(gameState?.pin || urlPin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSettingsChange(key, value) {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    if (isHost) await updateSettings(newSettings);
  }

  useEffect(() => {
    if (gameState?.settings) {
      setSettings(gameState.settings);
    }
  }, [gameState?.settings]);

  if (!gameState && !error) {
    return (
      <div className="lobby-page">
        <div className="bg-effects"><div className="bg-orb bg-orb-1" /><div className="bg-orb bg-orb-2" /></div>
        <div className="loading-screen"><div className="spinner" /><p>Connexion au salon...</p></div>
      </div>
    );
  }

  return (
    <div className="lobby-page">
      <div className="bg-effects">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="floating-cards">
          <img src="/images/cards1.png" alt="" className="float-card fc-2" />
          <img src="/images/cards_rain2.png" alt="" className="float-card fc-4" />
        </div>
      </div>

      <div className="lobby-content">
        <header className="lobby-header">
          <button className="btn-back" onClick={handleLeave}>⬅️ Quitter</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h2 className="lobby-title">Salon de poker</h2>
            {gameState?.settings?.mode === 'ranked' && (
              <span className="host-badge" style={{ background: 'var(--accent)', color: '#fff', fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}>
                🏆 Ranked
              </span>
            )}
          </div>
        </header>

        {/* PIN Display */}
        <div className="pin-display" onClick={copyPin}>
          <span className="pin-label">Code PIN</span>
          <span className="pin-value">{gameState?.pin || urlPin}</span>
          <span className="pin-copy">{copied ? '✅ Copié !' : '📋 Copier'}</span>
        </div>

        {error && <div className="error-toast">{error}</div>}

        {/* Players List */}
        <div className="lobby-section">
          <h3 className="section-title">
            Joueurs ({gameState?.players?.length || 0}/{gameState?.settings?.maxPlayers || 8})
          </h3>
          <div className="players-list">
            {gameState?.players?.map(player => (
              <div key={player.id} className={`player-item ${player.isReady ? 'ready' : ''}`}>
                <div className="player-avatar-lobby">
                  {player.username[0].toUpperCase()}
                </div>
                <div className="player-info">
                  <span className="player-name">
                    {player.username}
                    {player.id === gameState.hostId && <span className="host-badge">👑 Hôte</span>}
                  </span>
                  <span className={`ready-status ${player.isReady ? 'is-ready' : ''}`}>
                    {player.isReady ? '✅ Prêt' : '⏳ En attente'}
                  </span>
                </div>
                {isHost && player.id !== user.id && (
                  <button className="btn-icon-sm" onClick={() => kickPlayer(player.id)} title="Expulser">
                    🚫
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Settings (host only) */}
        {isHost && (
          <div className="lobby-section">
            <h3 className="section-title">⚙️ Paramètres</h3>
            <div className="settings-grid">
              <div className="setting-item full-width">
                <label>Variante</label>
                <select
                  value={settings.variant}
                  onChange={e => handleSettingsChange('variant', e.target.value)}
                >
                  <option value="texas">Texas Hold'em (Standard)</option>
                  <option value="omaha">Omaha (4 cartes)</option>
                  <option value="courchevel">Courchevel (5 cartes + Spit)</option>
                  <option value="pineapple">Pineapple (3 cartes, défausse 1)</option>
                  <option value="irish">Irish Poker (4 cartes, défausse 2 après Flop)</option>
                </select>
              </div>
              <div className="setting-item">
                <label>Small Blind</label>
                <select
                  value={settings.smallBlind}
                  onChange={e => handleSettingsChange('smallBlind', parseInt(e.target.value))}
                >
                  {[1, 2, 5, 10, 25, 50].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="setting-item">
                <label>Big Blind</label>
                <select
                  value={settings.bigBlind}
                  onChange={e => handleSettingsChange('bigBlind', parseInt(e.target.value))}
                >
                  {[2, 4, 10, 20, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="setting-item">
                <label>Jetons de départ</label>
                <select
                  value={settings.startingChips}
                  onChange={e => handleSettingsChange('startingChips', parseInt(e.target.value))}
                >
                  {[500, 1000, 2000, 5000, 10000].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="setting-item">
                <label>Temps par tour</label>
                <select
                  value={settings.turnTime}
                  onChange={e => handleSettingsChange('turnTime', parseInt(e.target.value))}
                >
                  {[15, 20, 30, 45, 60].map(v => <option key={v} value={v}>{v}s</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="lobby-actions">
          {!myPlayer?.isReady ? (
            <button className="btn btn-primary btn-lg btn-block" onClick={() => setReady(true)}>
              ✅ Je suis prêt
            </button>
          ) : (
            <button className="btn btn-secondary btn-lg btn-block" onClick={() => setReady(false)}>
              ❌ Annuler
            </button>
          )}

          {isHost && (
            <button
              className="btn btn-accent btn-lg btn-block"
              onClick={handleStart}
              disabled={!allReady}
            >
              🎮 Lancer la partie
              {!allReady && <span className="btn-sub"> - en attente des joueurs</span>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

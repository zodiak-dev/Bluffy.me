import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';
import PlayModal from '../components/PlayModal';

export default function Landing() {
  const { user, logout } = useAuth();
  const { createRoom, joinRoom, quickMatch, cancelQuickMatch, gameState } = useGame();
  const navigate = useNavigate();
  const [joinPin, setJoinPin] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [showPlayModal, setShowPlayModal] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isQuickMatching, setIsQuickMatching] = useState(false);

  // Navigate quand la partie quickmatch démarre
  useEffect(() => {
    if (isQuickMatching && gameState?.pin && gameState?.phase && gameState.phase !== 'waiting') {
      navigate(`/game/${gameState.pin}`);
    }
  }, [gameState, isQuickMatching]);

  async function handleCreate(settings = {}) {
    if (!user) return navigate('/auth');
    setLoading(true);
    setError('');
    try {
      const result = await createRoom(settings);
      if (result.error) throw new Error(result.error);
      navigate(`/lobby/${result.pin}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (!user) return navigate('/auth');
    if (joinPin.length !== 4) return setError('Le code PIN doit contenir 4 chiffres');
    setLoading(true);
    setError('');
    try {
      const result = await joinRoom(joinPin);
      if (result.error) throw new Error(result.error);
      navigate(`/lobby/${result.pin}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="landing-page">
      {/* Animated background */}
      <div className="bg-effects">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
        <div className="floating-cards">
          <img src="/images/ace.png" alt="" className="float-card fc-1" />
          <img src="/images/chips_stack1.png" alt="" className="float-card fc-2" />
          <img src="/images/cards_rain1.png" alt="" className="float-card fc-3" />
          <img src="/images/chips_stack2.png" alt="" className="float-card fc-4" />
          <img src="/images/chips1.png" alt="" className="float-card fc-5" />
        </div>
      </div>

      <div className="landing-content">
        {/* Header */}
        <header className="landing-header">
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                className="btn btn-ghost"
                style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}
                onClick={() => navigate('/stats')}
                title="Mes statistiques"
              >
                📊 Stats
              </button>
              <button
                className="btn btn-ghost"
                style={{ padding: '0.4rem', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => navigate('/cosmetics')}
                title="Cosmétiques"
              >
                🎨
              </button>
              <div className="user-badge" onClick={logout} title="Se déconnecter">
                <div className="user-avatar">{user.username[0].toUpperCase()}</div>
                <span>{user.username}</span>
              </div>
            </div>
          )}
        </header>

        {/* Hero */}
        <div className="hero">
          <div className="logo-container">
            <h1 className="logo">
              <span className="logo-icon">🃏</span>
              Bluffy
            </h1>
            <p className="tagline">Poker entre amis — en ligne</p>
          </div>

          <div className="hero-actions">
            <button
              className="btn btn-primary btn-lg btn-play-cta"
              onClick={() => setShowPlayModal(true)}
              disabled={loading}
            >
              <span className="btn-icon">🎮</span>
              Jouer
            </button>

            {!showJoin ? (
              <button
                className="btn btn-secondary btn-lg"
                onClick={() => user ? setShowJoin(true) : navigate('/auth')}
              >
                <span className="btn-icon">🔗</span>
                Rejoindre une table
              </button>
            ) : (
              <form className="join-form" onSubmit={handleJoin}>
                <div className="pin-input-group">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="CODE PIN"
                    value={joinPin}
                    onChange={e => setJoinPin(e.target.value.replace(/\D/g, ''))}
                    className="pin-input"
                    autoFocus
                  />
                  <button type="submit" className="btn btn-accent" disabled={loading || joinPin.length !== 4}>
                    Rejoindre
                  </button>
                </div>
                <button type="button" className="btn-text" onClick={() => setShowJoin(false)}>
                  Annuler
                </button>
              </form>
            )}

            {!user && (
              <button className="btn btn-ghost" onClick={() => navigate('/auth')}>
                Se connecter / S'inscrire
              </button>
            )}
          </div>

          {error && <div className="error-toast">{error}</div>}
        </div>

        <PlayModal
          isOpen={showPlayModal}
          onClose={() => setShowPlayModal(false)}
          onCreateTable={() => {
            setShowPlayModal(false);
            handleCreate({ mode: 'casual' });
          }}
          onQuickMatch={Object.assign(async (variantId) => {
            setIsQuickMatching(true);
            const res = await quickMatch(variantId);
            if (res?.error) {
              setError(res.error);
              setIsQuickMatching(false);
              return false;
            }
            return true;
          }, { cancel: () => { cancelQuickMatch(); setIsQuickMatching(false); } })}
        />

        {/* Features */}
        <div className="features">
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>Instantané</h3>
            <p>Créez une table en 1 clic et partagez le code PIN</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🎯</div>
            <h3>Texas Hold'em</h3>
            <p>Le poker classique avec toutes les règles officielles</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📱</div>
            <h3>Multi-plateforme</h3>
            <p>Jouez sur mobile, tablette ou PC — aucune app requise</p>
          </div>
        </div>

        <footer className="landing-footer">
          <p>bluffy.me — Poker gratuit entre amis</p>
        </footer>
      </div>
    </div>
  );
}

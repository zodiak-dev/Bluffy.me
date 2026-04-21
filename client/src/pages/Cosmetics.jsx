import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const THEMES = [
  {
    id: 'default',
    name: 'Classique',
    description: 'La table emblématique de Bluffy',
    icon: '🃏',
    requiredWins: 0,
    color: '#1a6b3c',
    accent: '#22c55e',
  },
  {
    id: 'bronze',
    name: 'Bronze',
    description: 'Un feutrine chaude pour les combattants',
    icon: '🥉',
    requiredWins: 5,
    color: '#7c4b1c',
    accent: '#cd7f32',
  },
  {
    id: 'silver',
    name: 'Argent',
    description: 'Élégance froide pour les stratèges',
    icon: '🥈',
    requiredWins: 10,
    color: '#2a3a4a',
    accent: '#a8b8c8',
  },
  {
    id: 'gold',
    name: 'Or',
    description: 'Pour ceux qui savent gagner',
    icon: '🥇',
    requiredWins: 25,
    color: '#4a3200',
    accent: '#fbbf24',
  },
  {
    id: 'diamond',
    name: 'Diamant',
    description: 'Table des légendes cristallines',
    icon: '💎',
    requiredWins: 50,
    color: '#0a2040',
    accent: '#67e8f9',
  },
  {
    id: 'legend',
    name: 'Légende',
    description: 'Réservé aux maîtres absolus du poker',
    icon: '👑',
    requiredWins: 100,
    color: '#1a0030',
    accent: '#a855f7',
  },
];

export default function Cosmetics() {
  const { user, updateTableTheme } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const wins = user?.stats?.gamesWon ?? 0;
  const activeTheme = user?.tableTheme ?? 'default';

  async function handleSelect(themeId) {
    if (saving) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await updateTableTheme(themeId);
      setSuccess('Thème appliqué !');
      setTimeout(() => setSuccess(''), 2000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cosmetics-page">
      <div className="cosmetics-header">
        <button className="btn-icon-round" onClick={() => navigate(-1)} title="Retour">
          ←
        </button>
        <div>
          <h1 className="cosmetics-title">🎨 Cosmétiques</h1>
          <p className="cosmetics-subtitle">
            Personnalise ta table • <span className="wins-count">{wins} victoire{wins !== 1 ? 's' : ''}</span>
          </p>
        </div>
      </div>

      {error && <div className="error-toast" style={{ position: 'relative', margin: '0 1.5rem 1rem' }}>{error}</div>}
      {success && <div className="success-toast">{success}</div>}

      <div className="themes-grid">
        {THEMES.map(theme => {
          const unlocked = wins >= theme.requiredWins;
          const isActive = activeTheme === theme.id;

          return (
            <div
              key={theme.id}
              className={`theme-card ${isActive ? 'theme-active' : ''} ${!unlocked ? 'theme-locked' : ''}`}
              style={{ '--theme-color': theme.color, '--theme-accent': theme.accent }}
            >
              <div className="theme-preview">
                <div className="theme-felt" style={{ background: theme.color }}>
                  <div className="theme-oval" style={{ borderColor: theme.accent }} />
                  <div className="theme-cards">
                    <div className="mini-card" style={{ borderColor: theme.accent }} />
                    <div className="mini-card" style={{ borderColor: theme.accent }} />
                    <div className="mini-card" style={{ borderColor: theme.accent }} />
                  </div>
                </div>
                {!unlocked && (
                  <div className="theme-lock-overlay">
                    <span className="lock-icon">🔒</span>
                    <span className="lock-text">{theme.requiredWins} victoires</span>
                  </div>
                )}
              </div>

              <div className="theme-info">
                <div className="theme-name-row">
                  <span className="theme-icon">{theme.icon}</span>
                  <span className="theme-name">{theme.name}</span>
                  {isActive && <span className="theme-badge-active">Actif</span>}
                </div>
                <p className="theme-desc">{theme.description}</p>

                {unlocked ? (
                  <button
                    className={`btn ${isActive ? 'btn-secondary' : 'btn-accent'} btn-sm btn-block`}
                    disabled={isActive || saving}
                    onClick={() => handleSelect(theme.id)}
                  >
                    {isActive ? '✓ Sélectionné' : 'Choisir'}
                  </button>
                ) : (
                  <div className="theme-progress">
                    <div className="progress-bar-bg">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${Math.min(100, (wins / theme.requiredWins) * 100)}%`,
                          background: theme.accent
                        }}
                      />
                    </div>
                    <span className="progress-label">{wins} / {theme.requiredWins}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

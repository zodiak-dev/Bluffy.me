import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/* ─── helpers ─── */
function fmt(n, decimals = 0) {
  const num = Number(n);
  if (isNaN(num)) return '—';
  return decimals > 0 ? num.toFixed(decimals) : num.toLocaleString('fr-FR');
}

function pct(n) {
  return `${fmt(n, 1)} %`;
}

function duration(secs) {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/* ─── radial gauge ─── */
function Gauge({ value, max = 100, color, label, sublabel }) {
  const radius = 36;
  const stroke = 6;
  const safe   = isNaN(value) || value == null || !isFinite(value) ? 0 : value;
  const norm   = Math.min(Math.max(safe, 0), max);
  const circ   = 2 * Math.PI * radius;
  // Ensure division by max is safe and final value is a number
  const ratio  = max > 0 ? (norm / max) : 0;
  let offset = circ - (ratio * circ);
  if (isNaN(offset) || !isFinite(offset)) offset = circ;

  return (
    <div className="stats-gauge">
      <svg viewBox="0 0 90 90" width="90" height="90">
        <circle cx="45" cy="45" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle
          cx="45" cy="45" r={radius} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 45 45)"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        <text x="45" y="49" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--text-primary)">
          {fmt(safe, max === 100 ? 1 : 2)}
          {max === 100 ? '%' : 'x'}
        </text>
      </svg>
      <div className="gauge-label">{label}</div>
      {sublabel && <div className="gauge-sublabel">{sublabel}</div>}
    </div>
  );
}


/* ─── rank card ─── */
function RankCard({ elo, rank, ranked }) {
  const isUnranked = elo === 0;

  // Progress bar : % vers le prochain palier
  let progress = 0;
  if (!isUnranked && rank.max !== null) {
    const range = rank.max - rank.min + 1;
    if (range > 0) {
      progress = Math.min(100, Math.round(((elo - rank.min) / range) * 100));
    }
  } else if (!isUnranked && rank.max === null) {
    progress = 100; // Mythic
  }

  return (
    <div className="rank-card" style={{ '--rank-color': rank.color }}>
      <div className="rank-card-inner">
        <div className="rank-emoji">{rank.emoji}</div>
        <div className="rank-info">
          <div className="rank-name" style={{ color: rank.color }}>{rank.name}</div>
          <div className="rank-elo">
            {isUnranked ? 'Jouez en ranked pour obtenir un rang' : `${elo} ELO`}
          </div>
        </div>
        {!isUnranked && (
          <div className="rank-peak" title="ELO maximum atteint">
            <span>⬆️</span>
            <span>{ranked.peakElo}</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {!isUnranked && rank.max !== null && (
        <div className="rank-bar-wrap">
          <div className="rank-bar-track">
            <div
              className="rank-bar-fill"
              style={{ width: `${progress}%`, background: rank.color }}
            />
          </div>
          <span className="rank-bar-label">{elo} / {rank.max + 1}</span>
        </div>
      )}
      {!isUnranked && rank.max === null && (
        <div className="rank-bar-wrap">
          <div className="rank-bar-track">
            <div className="rank-bar-fill rank-bar-mythic" style={{ width: '100%' }} />
          </div>
          <span className="rank-bar-label">Rang maximal ✨</span>
        </div>
      )}

      {/* Ranked stats */}
      <div className="rank-stats-row">
        <div className="rank-stat">
          <span className="rank-stat-val">{ranked.gamesPlayed}</span>
          <span className="rank-stat-lbl">Parties</span>
        </div>
        <div className="rank-stat">
          <span className="rank-stat-val">{ranked.gamesWon}</span>
          <span className="rank-stat-lbl">Victoires</span>
        </div>
        <div className="rank-stat">
          <span className="rank-stat-val">{ranked.winRate}%</span>
          <span className="rank-stat-lbl">Win Rate</span>
        </div>
      </div>
    </div>
  );
}

/* ─── stat card ─── */
function StatCard({ icon, label, value, sub, highlight }) {
  return (
    <div className={`stat-card${highlight ? ' stat-card--highlight' : ''}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-body">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

/* ─── recent game row ─── */
function GameRow({ game, index }) {
  const d = game.startedAt ? new Date(game.startedAt) : null;
  const dateStr = d && !isNaN(d) 
    ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    : '—';
  return (
    <div className={`game-row ${game.won ? 'game-row--won' : 'game-row--lost'}`} style={{ animationDelay: `${index * 0.05}s` }}>
      <div className="game-row-badge">{game.won ? '🏆' : '💀'}</div>
      <div className="game-row-info">
        <span className="game-row-date">{dateStr}</span>
        <span className="game-row-hands">{game.totalHands} mains</span>
      </div>
      <div className="game-row-mid">
        {game.won
          ? <span className="game-row-result won">Victoire</span>
          : <span className="game-row-result lost">Éliminé · {game.winnerUsername}</span>
        }
      </div>
      <div className="game-row-right">
        <span className="game-row-chips">{fmt(game.myChips)} 🪙</span>
        <span className="game-row-dur">{duration(game.duration)}</span>
      </div>
    </div>
  );
}

/* ─── main page ─── */
export default function Statistics() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    fetch('/api/stats/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [user, token, navigate]);

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
      <p>Chargement des statistiques…</p>
    </div>
  );

  if (error) return (
    <div className="loading-screen">
      <p style={{ color: 'var(--danger)' }}>Erreur : {error}</p>
      <button className="btn btn-ghost" onClick={() => navigate('/')}>Retour</button>
    </div>
  );

  const { stats, recentGames, elo, rank, ranked } = data;

  return (
    <div className="stats-page">
      {/* Animated bg */}
      <div className="bg-effects">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
      </div>

      <div className="stats-layout">
        {/* ── Header ── */}
        <header className="stats-header">
          <button className="btn-back" onClick={() => navigate('/')}>
            ⬅️ Accueil
          </button>
          <div className="stats-title-block">
            <div className="stats-avatar">{user.username[0].toUpperCase()}</div>
            <div>
              <h1 className="stats-username">{user.username}</h1>
              <p className="stats-tagline">Mes statistiques de poker</p>
            </div>
          </div>
        </header>

        {/* ── Rank card ── */}
        <section className="stats-section">
          <h2 className="section-title">🏅 Rang Classé</h2>
          <RankCard elo={elo ?? 0} rank={rank ?? { name: 'Unranked', emoji: '❓', color: '#6b7280', min: 0, max: 0 }} ranked={ranked ?? { gamesPlayed: 0, gamesWon: 0, peakElo: 0, winRate: 0 }} />
        </section>

        {/* ── General cards ── */}
        <section className="stats-section">
          <h2 className="section-title">📊 Résumé Général</h2>
          <div className="stat-cards-grid">
            <StatCard icon="🎲" label="Mains distribuées"  value={fmt(stats.handsDealt)} />
            <StatCard icon="🃏" label="Mains jouées"       value={fmt(stats.handsPlayed)} />
            <StatCard icon="🏆" label="Mains gagnées"      value={fmt(stats.handsWon)} />
            <StatCard icon="🎮" label="Parties jouées"     value={fmt(stats.gamesPlayed)} />
            <StatCard
              icon="💰"
              label="Plus gros pot gagné"
              value={`${fmt(stats.biggestPot)} 🪙`}
              highlight
            />
            <StatCard
              icon="🎯"
              label="Pourcentage de victoire"
              value={pct(stats.winRate)}
              sub={`${fmt(stats.gamesWon)} / ${fmt(stats.gamesPlayed)} parties`}
              highlight
            />
          </div>
        </section>

        {/* ── HUD gauges ── */}
        <section className="stats-section">
          <h2 className="section-title">📈 Statistiques HUD</h2>
          <div className="gauges-grid">
            <Gauge
              value={stats.pfr}
              color="var(--accent)"
              label="PFR"
              sublabel="Relance préflop"
            />
            <Gauge
              value={stats.vpip}
              color="#7c3aed"
              label="VPIP"
              sublabel="Mise volontaire"
            />
            <Gauge
              value={stats.ats}
              color="var(--accent-3)"
              label="ATS"
              sublabel="Tentative de vol"
            />
            <Gauge
              value={stats.wtsd}
              color="#00ff88"
              label="WTSD"
              sublabel="Allé au showdown"
            />
            <Gauge
              value={stats.wssd}
              color="#f59e0b"
              label="WSSD"
              sublabel="Gains au showdown"
            />
            <Gauge
              value={stats.aggression}
              max={10}
              color="#ef4444"
              label="Agression"
              sublabel="Facteur d'agression"
            />
          </div>

          {/* Legend table */}
          <div className="hud-legend">
            <div className="hud-row">
              <span className="hud-key" style={{ color: 'var(--accent)' }}>PFR</span>
              <span className="hud-desc">PreFlop Raise — % des mains où vous relancez avant le flop</span>
              <span className="hud-val">{pct(stats.pfr)}</span>
            </div>
            <div className="hud-row">
              <span className="hud-key" style={{ color: '#7c3aed' }}>VPIP</span>
              <span className="hud-desc">Voluntarily Put Money in Pot — % de participation volontaire</span>
              <span className="hud-val">{pct(stats.vpip)}</span>
            </div>
            <div className="hud-row">
              <span className="hud-key" style={{ color: 'var(--accent-3)' }}>ATS</span>
              <span className="hud-desc">Attempt To Steal — % de tentatives de vol des blindes</span>
              <span className="hud-val">{pct(stats.ats)}</span>
            </div>
            <div className="hud-row">
              <span className="hud-key" style={{ color: '#00ff88' }}>WTSD</span>
              <span className="hud-desc">Went To ShowDown — % des mains jouées jusqu'au showdown</span>
              <span className="hud-val">{pct(stats.wtsd)}</span>
            </div>
            <div className="hud-row">
              <span className="hud-key" style={{ color: '#f59e0b' }}>WSSD</span>
              <span className="hud-desc">Won at ShowDown — % de victoires lors des showdowns</span>
              <span className="hud-val">{pct(stats.wssd)}</span>
            </div>
            <div className="hud-row">
              <span className="hud-key" style={{ color: '#ef4444' }}>AF</span>
              <span className="hud-desc">Aggression Factor — ratio mises+relances / appels</span>
              <span className="hud-val">{fmt(stats.aggression, 2)}x</span>
            </div>
          </div>
        </section>

        {/* ── Recent games ── */}
        <section className="stats-section">
          <h2 className="section-title">🕹️ Dernières Parties</h2>
          {recentGames.length === 0
            ? <p className="no-games">Aucune partie terminée pour l'instant. Jouez votre première partie !</p>
            : (
              <div className="games-list">
                {recentGames.map((g, i) => <GameRow key={i} game={g} index={i} />)}
              </div>
            )
          }
        </section>

        <footer className="stats-footer">
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            <span className="btn-icon">🃏</span>
            Jouer une partie
          </button>
        </footer>
      </div>
    </div>
  );
}

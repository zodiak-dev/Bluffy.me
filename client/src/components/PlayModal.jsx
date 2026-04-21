import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PokerTable3D from './PokerTable3D';

const VARIANT_RULES = {
  texas: {
    title: "Texas Hold'em",
    desc: "La variante la plus populaire au monde.",
    rules: [
      "Chaque joueur reçoit 2 cartes privées.",
      "5 cartes communes sont dévoilées sur la table (Flop, Turn, River).",
      "Objectif : Faire la meilleure main de 5 cartes en utilisant n'importe quelle combinaison de vos cartes et celles du plateau."
    ]
  },
  omaha: {
    title: "Omaha",
    desc: "Plus de cartes, plus de combinaisons folles.",
    rules: [
      "Chaque joueur reçoit 4 cartes privées.",
      "5 cartes communes sur la table.",
      "ATTENTION : Vous DEVEZ utiliser EXACTEMENT 2 de vos cartes privées et 3 cartes du plateau pour faire votre main."
    ]
  },
  courchevel: {
    title: "Courchevel",
    desc: "Une variante de l'Omaha avec une surprise au démarrage.",
    rules: [
      "Chaque joueur reçoit 5 cartes privées.",
      "Avant même les premières enchères, la 1ère carte du Flop est dévoilée (le Spit).",
      "Comme en Omaha, vous devez utiliser EXACTEMENT 2 de vos cartes et 3 du plateau."
    ]
  },
  pineapple: {
    title: "Pineapple",
    desc: "Une variante nerveuse où il faut jeter une carte.",
    rules: [
      "Chaque joueur reçoit 3 cartes privées.",
      "Après les premières enchères, juste avant le Flop, chaque joueur DOIT défausser 1 carte.",
      "La partie continue ensuite exactement comme du Texas Hold'em avec vos 2 cartes restantes."
    ]
  },
  irish: {
    title: "Irish Poker",
    desc: "Mix entre le Texas Hold'em et l'Omaha.",
    rules: [
      "Chaque joueur reçoit 4 cartes privées.",
      "Les enchères se font pré-flop puis au Flop (3 cartes).",
      "Juste après les enchères du Flop, chaque joueur DOIT défausser 2 cartes.",
      "La Turn et la River se jouent avec les 2 cartes restantes, comme au Texas Hold'em."
    ]
  }
};

export default function PlayModal({ isOpen, onClose, onCreateTable, onQuickMatch }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const overlayRef = useRef(null);
  const [searching, setSearching] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [selectingVariant, setSelectingVariant] = useState(false);
  const [infoVariant, setInfoVariant] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectingVariant(false);
      setSearching(false);
      setInfoVariant(null);
      return;
    }
    const handleKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Countdown while searching
  useEffect(() => {
    if (!searching) { setCountdown(5); return; }
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [searching, countdown]);

  function handleClose() {
    setSearching(false);
    setSelectingVariant(false);
    setInfoVariant(null);
    onClose();
  }

  async function handleVariantSelect(variantId) {
    setSelectingVariant(false);
    setSearching(true);
    const success = await onQuickMatch(variantId);
    // Ne ferme pas le loading screen si succès (on attend la navigation)
    if (success === false) {
      setSearching(false);
    }
  }

  function handleCancel() {
    setSearching(false);
    onQuickMatch?.cancel?.();
  }

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current && !searching) handleClose();
  };

  return (
    <div
      ref={overlayRef}
      className="play-modal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Choisir un mode de jeu"
    >
      <div className="play-modal">
        <div className="play-modal-header">
          <h2 className="play-modal-title">
            <span className="play-modal-title-icon">🃏</span>
            Jouer
          </h2>
          {!searching && (
            <button className="play-modal-close" onClick={handleClose} aria-label="Fermer">✖️</button>
          )}
        </div>

        {searching ? (
          <div className="quickmatch-searching">
            <PokerTable3D />
            <p className="qm-text">Recherche d'un adversaire...</p>
            <div className="qm-bar-wrap">
              <div
                className="qm-bar"
                style={{ width: `${((5 - countdown) / 5) * 100}%` }}
              />
            </div>
            <p className="qm-sub">⏳ {countdown}s — si personne trouvé, tu joues contre un Bot</p>
            <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={handleCancel}>
              ✖ Annuler
            </button>
          </div>
        ) : infoVariant ? (
          <div className="variant-info">
            <h3 className="play-modal-subtitle" style={{ color: 'var(--accent)', marginBottom: '0.5rem' }}>{VARIANT_RULES[infoVariant].title}</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontStyle: 'italic', fontSize: '0.9rem' }}>
              {VARIANT_RULES[infoVariant].desc}
            </p>
            <ul style={{ color: 'var(--text-main)', fontSize: '0.9rem', paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1.5rem', lineHeight: '1.4' }}>
              {VARIANT_RULES[infoVariant].rules.map((rule, idx) => (
                <li key={idx}>{rule}</li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setInfoVariant(null)}>
                Retour
              </button>
              <button className="btn btn-accent" style={{ flex: 1 }} onClick={() => { handleVariantSelect(infoVariant); setInfoVariant(null); }}>
                Jouer 🔥
              </button>
            </div>
          </div>
        ) : selectingVariant ? (
          <div className="variant-selection">
            <p className="play-modal-subtitle">Choisis ta variante pour la Partie Rapide</p>
            <div className="play-modal-options">
              
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button className="play-option" onClick={() => handleVariantSelect('texas')} style={{ flex: 1 }}>
                  <div className="play-option-icon">🎯</div>
                  <div className="play-option-body">
                    <span className="play-option-title">Texas Hold'em</span>
                    <span className="play-option-desc">Classique (2 cartes)</span>
                  </div>
                </button>
                <button className="btn-icon-round" aria-label="Infos Texas Hold'em" style={{ width: '40px', height: '40px', flexShrink: 0, background: 'var(--bg-glass-light)' }} onClick={() => setInfoVariant('texas')}>ℹ️</button>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button className="play-option" onClick={() => handleVariantSelect('omaha')} style={{ flex: 1 }}>
                  <div className="play-option-icon">🍀</div>
                  <div className="play-option-body">
                    <span className="play-option-title">Omaha</span>
                    <span className="play-option-desc">Folie à 4 cartes</span>
                  </div>
                </button>
                <button className="btn-icon-round" aria-label="Infos Omaha" style={{ width: '40px', height: '40px', flexShrink: 0, background: 'var(--bg-glass-light)' }} onClick={() => setInfoVariant('omaha')}>ℹ️</button>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button className="play-option" onClick={() => handleVariantSelect('courchevel')} style={{ flex: 1 }}>
                  <div className="play-option-icon">❄️</div>
                  <div className="play-option-body">
                    <span className="play-option-title">Courchevel</span>
                    <span className="play-option-desc">5 cartes + 1 Spit</span>
                  </div>
                </button>
                <button className="btn-icon-round" aria-label="Infos Courchevel" style={{ width: '40px', height: '40px', flexShrink: 0, background: 'var(--bg-glass-light)' }} onClick={() => setInfoVariant('courchevel')}>ℹ️</button>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button className="play-option" onClick={() => handleVariantSelect('pineapple')} style={{ flex: 1 }}>
                  <div className="play-option-icon">🍍</div>
                  <div className="play-option-body">
                    <span className="play-option-title">Pineapple</span>
                    <span className="play-option-desc">Jeter 1 carte au Flop</span>
                  </div>
                </button>
                <button className="btn-icon-round" aria-label="Infos Pineapple" style={{ width: '40px', height: '40px', flexShrink: 0, background: 'var(--bg-glass-light)' }} onClick={() => setInfoVariant('pineapple')}>ℹ️</button>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button className="play-option" onClick={() => handleVariantSelect('irish')} style={{ flex: 1 }}>
                  <div className="play-option-icon">🍻</div>
                  <div className="play-option-body">
                    <span className="play-option-title">Irish Poker</span>
                    <span className="play-option-desc">Jeter 2 cartes au Turn</span>
                  </div>
                </button>
                <button className="btn-icon-round" aria-label="Infos Irish Poker" style={{ width: '40px', height: '40px', flexShrink: 0, background: 'var(--bg-glass-light)' }} onClick={() => setInfoVariant('irish')}>ℹ️</button>
              </div>

            </div>
            <button className="btn btn-secondary btn-block" style={{ marginTop: '1rem' }} onClick={() => setSelectingVariant(false)}>
              Retour
            </button>
          </div>
        ) : (
          <>
            <p className="play-modal-subtitle">Choisis ton mode de jeu</p>

            <div className="play-modal-options">
              <button className="play-option play-option--quick" onClick={() => {
                if (!user) return navigate('/auth');
                setSelectingVariant(true);
              }}>
                <div className="play-option-icon">⚡</div>
                <div className="play-option-body">
                  <span className="play-option-title">Quick Match</span>
                  <span className="play-option-desc">Rejoins une partie instantanément</span>
                </div>
                <div className="play-option-arrow">➡️</div>
              </button>

              <button className="play-option play-option--ranked" disabled>
                <div className="play-option-icon">🏆</div>
                <div className="play-option-body">
                  <span className="play-option-title">Ranked</span>
                  <span className="play-option-desc">Grimpe dans le classement ELO</span>
                </div>
                <div className="play-option-badge play-option-badge--gold">Bientôt</div>
                <div className="play-option-arrow">➡️</div>
              </button>

              <div className="play-modal-divider"><span>ou</span></div>

              <button className="play-option play-option--create" onClick={onCreateTable}>
                <div className="play-option-icon">🪙</div>
                <div className="play-option-body">
                  <span className="play-option-title">Créer une table</span>
                  <span className="play-option-desc">Invite tes amis avec un code PIN</span>
                </div>
                <div className="play-option-arrow">➡️</div>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

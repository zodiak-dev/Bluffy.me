import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Auth() {
  const { login, register, user } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    navigate('/');
    return null;
  }

  function handleChange(e) {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        if (formData.username.length < 3) throw new Error('Le pseudo doit contenir au moins 3 caractères');
        await register(formData.username, formData.email, formData.password);
      }
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="bg-effects">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="floating-cards">
          <img src="/images/cards1.png" alt="" className="float-card fc-1" />
          <img src="/images/cards_rain2.png" alt="" className="float-card fc-3" />
        </div>
      </div>

      <div className="auth-container">
        <button className="btn-back" onClick={() => navigate('/')}>
          ← Retour
        </button>

        <div className="auth-card">
          <div className="auth-header">
            <h1 className="logo logo-sm">
              <span className="logo-icon">🃏</span>
              Bluffy
            </h1>
            <p className="auth-subtitle">
              {isLogin ? 'Connectez-vous pour jouer' : 'Créez votre compte'}
            </p>
          </div>

          <div className="auth-tabs">
            <button
              className={`auth-tab ${isLogin ? 'active' : ''}`}
              onClick={() => { setIsLogin(true); setError(''); }}
            >
              Connexion
            </button>
            <button
              className={`auth-tab ${!isLogin ? 'active' : ''}`}
              onClick={() => { setIsLogin(false); setError(''); }}
            >
              Inscription
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {!isLogin && (
              <div className="input-group">
                <label>Pseudo</label>
                <input
                  type="text"
                  name="username"
                  placeholder="Votre pseudo unique"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  autoComplete="username"
                />
              </div>
            )}

            <div className="input-group">
              <label>{isLogin ? 'Email ou pseudo' : 'Email'}</label>
              <input
                type={isLogin ? 'text' : 'email'}
                name="email"
                placeholder={isLogin ? 'Email ou pseudo' : 'votre@email.com'}
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
              />
            </div>

            <div className="input-group">
              <label>Mot de passe</label>
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={6}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
            </div>

            {error && <div className="form-error">{error}</div>}

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? (
                <span className="spinner-sm" />
              ) : (
                isLogin ? 'Se connecter' : 'Créer mon compte'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

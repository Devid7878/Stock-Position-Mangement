import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { Upload, Camera, Building } from 'lucide-react';

const DEFAULT_COMPANY = process.env.REACT_APP_COMPANY_NAME || 'Trade Intelligence';
const DEFAULT_LOGO = process.env.REACT_APP_LOGO_URL;

export default function AuthPage() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } = useAuth();
  const [mode, setMode] = useState('login'); // login | signup | forgot
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const uploadLogo = async (userId) => {
    if (!logoFile) return null;
    const fileExt = logoFile.name.split('.').pop();
    const fileName = `${userId}/logo-${Math.random()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from('vvv_icons')
      .upload(fileName, logoFile);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('vvv_icons').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else if (mode === 'signup') {
        // Sign up with basic info first
        const { data: { user }, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { 
              full_name: fullName,
              company_name: companyName || DEFAULT_COMPANY
            },
          },
        });

        if (signUpError) throw signUpError;

        if (user && logoFile) {
          const logoUrl = await uploadLogo(user.id);
          await supabase.auth.updateUser({
            data: { company_logo: logoUrl }
          });
        }

        setSuccess('Check your email to confirm your account!');
      } else if (mode === 'forgot') {
        await resetPassword(email);
        setSuccess('Password reset link sent to your email!');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-mark">
            {DEFAULT_LOGO ? (
              <img src={DEFAULT_LOGO} alt="Branding" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" fill="#6366f1" />
                <path d="M8 22L14 10L20 18L24 14" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <div className="logo-text">
            <span className="logo-brand">{DEFAULT_COMPANY}</span>
            <span className="logo-sub">Position Manager</span>
          </div>
        </div>

        <h2 className="auth-title">
          {mode === 'login' && 'Welcome back'}
          {mode === 'signup' && 'Register Trading Firm'}
          {mode === 'forgot' && 'Reset password'}
        </h2>

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && (
            <>
              <div className="form-group">
                <label>Company Name</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Valvo Intel"
                    required
                    style={{ paddingLeft: 36 }}
                  />
                  <Building size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                </div>
              </div>

              <div className="form-group">
                <label>Company Logo</label>
                <div className="logo-upload-box" onClick={() => document.getElementById('logo-input').click()}>
                  {logoPreview ? (
                    <img src={logoPreview} alt="Preview" className="logo-preview-img" />
                  ) : (
                    <div className="upload-placeholder">
                      <Upload size={20} />
                      <span>Upload Logo</span>
                    </div>
                  )}
                  <input id="logo-input" type="file" accept="image/*" onChange={handleFileChange} hidden />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: 20 }}>
                <label>Owner Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          {mode !== 'forgot' && (
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 12 }}>
            {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Get Reset Link'}
          </button>
        </form>

        {mode === 'login' && (
          <div className="auth-footer-links">
             <button className="forgot-link" onClick={() => setMode('forgot')}>Forgot password?</button>
             <div className="auth-divider"><span>or</span></div>
             <button className="btn-google" onClick={signInWithGoogle} disabled={loading}>
              Continue with Google
            </button>
          </div>
        )}

        <p className="auth-switch">
          {mode === 'login' ? (
            <>New firm? <button onClick={() => setMode('signup')}>Register now</button></>
          ) : (
            <>Already registered? <button onClick={() => setMode('login')}>Sign in</button></>
          )}
        </p>
      </div>
    </div>
  );
}

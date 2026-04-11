import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { X, Camera, Save, User as UserIcon, Building, Upload } from 'lucide-react';

export default function ProfileSettingsModal({ onClose }) {
  const { user, updateProfile } = useAuth();
  
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
  const [companyName, setCompanyName] = useState(user?.user_metadata?.company_name || '');
  const [companyLogo, setCompanyLogo] = useState(user?.user_metadata?.company_logo || '');
  
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const uploadLogo = async (userId) => {
    if (!logoFile) return companyLogo;
    const fileExt = logoFile.name.split('.').pop();
    const fileName = `${userId}/logo-${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('vvv_icons')
      .upload(fileName, logoFile);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('vvv_icons').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      let logoUrl = companyLogo;
      if (logoFile) {
        logoUrl = await uploadLogo(user.id);
      }

      await updateProfile({
        full_name: fullName,
        company_name: companyName,
        company_logo: logoUrl
      });
      
      // Update Favicon
      const favicon = document.getElementById('favicon');
      if (favicon && logoUrl) favicon.href = logoUrl;
      
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="add-position-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
        <div className="modal-header">
          <div className="header-title-group">
            <Building className="header-icon" />
            <div>
              <h3>Settings & Branding</h3>
              <p>Configure your firm's identity</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSave} className="modal-body">
          {error && <div className="error-message" style={{ marginBottom: 16 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
            <div className="logo-edit-section" style={{ flex: '0 0 100px' }}>
              <div className="sub-label" style={{ marginBottom: 8 }}>LOGO</div>
              <div 
                className="logo-upload-box small" 
                onClick={() => document.getElementById('logo-update').click()}
                style={{ height: 100, width: 100 }}
              >
                {(logoPreview || companyLogo) ? (
                  <img src={logoPreview || companyLogo} alt="Logo" className="logo-preview-img" />
                ) : (
                  <Camera size={24} opacity={0.5} />
                )}
                <div className="upload-overlay"><Camera size={16} /></div>
                <input id="logo-update" type="file" accept="image/*" onChange={handleFileChange} hidden />
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
               <div className="form-group">
                <label>Company Name</label>
                <input
                  type="text"
                  className="modal-input"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Firm Name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Owner Name</label>
                <input
                  type="text"
                  className="modal-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your Name"
                  required
                />
              </div>
            </div>
          </div>

          <div className="info-tip" style={{ padding: '12px 16px', borderRadius: 8, background: 'var(--blue-dim)', border: '1px solid var(--blue)', color: 'var(--blue)', fontSize: 12, fontWeight: 600 }}>
             Tip: Your company logo will automatically be used as the browser favicon for a professional experience.
          </div>

          <div className="modal-actions" style={{ marginTop: 24 }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Updating...' : <><Save size={16} style={{ marginRight: 8 }} /> Save Settings</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

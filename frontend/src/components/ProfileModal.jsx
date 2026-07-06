import { useChat } from "../state/ChatContext.jsx";
import { X } from 'lucide-react';

const COLORS = ["#2aabee", "#19a974", "#7c3aed", "#f97316", "#e11d48", "#0891b2"];

export function ProfileModal() {
  const { profileOpen, setProfileOpen, profileForm, setProfileForm, updateProfile, user } = useChat();

  if (!profileOpen) return null;

  return (
    <div className="profile-overlay" role="presentation">
      <section className="profile-modal" role="dialog" aria-modal="true" aria-label="Cập nhật hồ sơ">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0 }}>Hồ sơ cá nhân</h2>
          <button className="icon-button" onClick={() => setProfileOpen(false)}><X size={24} /></button>
        </header>
        <form onSubmit={updateProfile}>
          <div className="form-group">
            <label>ID của bạn (Copy gửi cho bạn bè để kết bạn)</label>
            <input
              value={user?.chat_id || ""}
              readOnly
              onClick={e => { e.target.select(); navigator.clipboard.writeText(user?.chat_id || ""); }}
              title="Bấm để copy"
              style={{ cursor: 'pointer', background: 'rgba(0,0,0,0.3)', color: 'var(--neon-blue)', fontWeight: 'bold' }}
            />
          </div>
          <div className="form-group">
            <label>Tên hiển thị</label>
            <input
              value={profileForm.display_name}
              onChange={event => setProfileForm({ ...profileForm, display_name: event.target.value })}
              placeholder="Nhập tên hiển thị..."
            />
          </div>
          <div className="form-group">
            <label>Tiểu sử (Bio)</label>
            <input
              value={profileForm.bio}
              onChange={event => setProfileForm({ ...profileForm, bio: event.target.value })}
              placeholder="Một dòng giới thiệu ngắn..."
            />
          </div>
          <div className="form-group">
            <label>Màu đại diện (Avatar)</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {COLORS.map(color => (
                <button
                  key={color}
                  style={{ 
                    background: color, 
                    width: 40, 
                    height: 40, 
                    borderRadius: '50%', 
                    border: profileForm.avatar_color === color ? '2px solid white' : 'none',
                    cursor: 'pointer',
                    boxShadow: profileForm.avatar_color === color ? '0 0 10px ' + color : 'none',
                    transform: profileForm.avatar_color === color ? 'scale(1.1)' : 'scale(1)',
                    transition: 'all 0.2s'
                  }}
                  type="button"
                  aria-label={color}
                  onClick={() => setProfileForm({ ...profileForm, avatar_color: color })}
                />
              ))}
            </div>
          </div>
          <button className="neon-button" type="submit" style={{ marginTop: '16px' }}>Lưu hồ sơ</button>
        </form>
      </section>
    </div>
  );
}

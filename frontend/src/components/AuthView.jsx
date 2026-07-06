import { useChat } from "../state/ChatContext.jsx";
import { Lock, LogIn, UserPlus } from 'lucide-react';

export function AuthView() {
  const { authMode, setAuthMode, authForm, setAuthForm, submitAuth, status, notice } = useChat();
  const isWorking = status === "loading";

  return (
    <div className="auth-view">
      <div className="profile-modal">
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Lock size={48} color="#00f0ff" style={{ margin: '0 auto 16px auto' }} />
          <h2>{authMode === "login" ? "Đăng Nhập" : "Đăng Ký"}</h2>
        </div>

        <form onSubmit={submitAuth}>
          <div className="form-group">
            <label>Tên đăng nhập</label>
            <input
              type="text"
              value={authForm.username}
              onChange={e => setAuthForm(prev => ({ ...prev, username: e.target.value }))}
              required
              minLength={3}
              placeholder="Nhập tên đăng nhập..."
            />
          </div>
          <div className="form-group">
            <label>Mật khẩu</label>
            <input
              type="password"
              value={authForm.password}
              onChange={e => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
              required
              minLength={6}
              placeholder="Nhập mật khẩu..."
            />
          </div>

          <button className="neon-button" type="submit" disabled={isWorking} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            {authMode === "login" ? <LogIn size={20} /> : <UserPlus size={20} />}
            {isWorking ? "Đang xử lý..." : (authMode === "login" ? "Đăng nhập" : "Đăng ký")}
          </button>
        </form>

        {notice && <p className="notice-banner error" style={{ marginTop: '16px' }}>{notice}</p>}

        <p style={{ marginTop: "24px", textAlign: "center", color: 'var(--text-secondary)' }}>
          {authMode === "login" ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
          <button 
            type="button" 
            style={{ background: 'transparent', border: 'none', color: 'var(--neon-blue)', cursor: 'pointer', fontWeight: 'bold' }} 
            onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthForm({ username: "", password: "" }); }}
          >
            {authMode === "login" ? "Đăng ký ngay" : "Đăng nhập"}
          </button>
        </p>
      </div>
    </div>
  );
}

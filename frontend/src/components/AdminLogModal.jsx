import { useEffect, useState } from "react";
import { RefreshCw, ShieldCheck, X } from "lucide-react";
import { useChat } from "../state/ChatContext.jsx";
import { apiGet, readApiError } from "../services/api.js";

export function AdminLogModal() {
  const { adminLogOpen, setAdminLogOpen, token } = useChat();
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!adminLogOpen) return undefined;
    loadSnapshot();
    const timerId = window.setInterval(loadSnapshot, 2000);
    return () => window.clearInterval(timerId);
  }, [adminLogOpen]);

  if (!adminLogOpen) return null;

  async function loadSnapshot() {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet("/api/admin/demo-state", token);
      setSnapshot(data);
    } catch (err) {
      setError(readApiError(err));
    } finally {
      setLoading(false);
    }
  }

  const events = snapshot?.events || [];
  const users = snapshot?.users || [];

  return (
    <div className="profile-overlay" role="presentation">
      <section className="admin-log-modal" role="dialog" aria-modal="true" aria-label="Admin security logs">
        <header className="admin-log-header">
          <div>
            <ShieldCheck color="#00f0ff" />
            <div>
              <h2>Admin Logs</h2>
              <p>Hiển thị trực tiếp public key, gói mã hóa, relay và ACK/NACK để demo.</p>
            </div>
          </div>
          <div className="admin-log-actions">
            <button className="icon-button" type="button" title="Tải lại log" onClick={loadSnapshot}>
              <RefreshCw size={20} className={loading ? "spin" : ""} />
            </button>
            <button className="icon-button" type="button" title="Đóng" onClick={() => setAdminLogOpen(false)}>
              <X size={22} />
            </button>
          </div>
        </header>

        {error && <p className="notice-banner error">{error}</p>}

        <div className="admin-dashboard">
          <section className="admin-card">
            <h3>Thuật toán</h3>
            <dl>
              {Object.entries(snapshot?.crypto || fallbackCrypto()).map(([key, value]) => (
                <div key={key}>
                  <dt>{labelOf(key)}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="admin-card">
            <h3>Server hiện tại</h3>
            <dl>
              <div>
                <dt>Admin</dt>
                <dd>{snapshot?.admin || "Đang tải..."}</dd>
              </div>
              <div>
                <dt>Kết nối WS</dt>
                <dd>{snapshot?.server?.active_connection_count ?? 0}</dd>
              </div>
              <div>
                <dt>User online</dt>
                <dd>{(snapshot?.server?.active_users || []).join(", ") || "Chưa có"}</dd>
              </div>
              <div>
                <dt>Số log</dt>
                <dd>{snapshot?.server?.stored_event_count ?? events.length}</dd>
              </div>
            </dl>
          </section>
        </div>

        <section className="admin-section">
          <h3>Public key đang lưu trên server</h3>
          <div className="admin-user-grid">
            {users.length === 0 && <p className="admin-log-empty">Chưa có user trong database.</p>}
            {users.map(user => (
              <article className="admin-user-card" key={user.chat_id}>
                <header>
                  <strong>{user.username}</strong>
                  <span>{user.chat_id}</span>
                </header>
                <dl>
                  <div>
                    <dt>SHA-256</dt>
                    <dd>{user.public_key.sha256}</dd>
                  </div>
                  <div>
                    <dt>Độ dài PEM</dt>
                    <dd>{user.public_key.len}</dd>
                  </div>
                </dl>
                <details>
                  <summary>Xem public key PEM</summary>
                  <pre>{user.public_key.public_key_pem}</pre>
                </details>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-section admin-events-section">
          <h3>Luồng mã hóa và relay</h3>
          <div className="admin-log-list">
            {events.length === 0 && (
              <p className="admin-log-empty">Chưa có event. Gửi tin nhắn, ảnh hoặc ghi âm để log xuất hiện tại đây.</p>
            )}
            {events.map((event, index) => (
              <article className="admin-log-item" key={`${event.time}-${event.type}-${index}`}>
                <header>
                  <strong>{event.type}</strong>
                  <time>{formatTime(event.time)}</time>
                </header>
                <pre>{JSON.stringify(stripEventHeader(event), null, 2)}</pre>
              </article>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

function stripEventHeader(event) {
  const { time, type, ...details } = event;
  return details;
}

function fallbackCrypto() {
  return {
    content_encryption: "AES-256-CBC",
    key_exchange: "RSA-2048 encrypt AES key with PKCS#1 v1.5",
    authentication: "RSA-2048 digital signature + SHA-256",
    integrity: "SHA-256(IV || ciphertext)",
    server_visibility: "Server không thấy plaintext/private key/raw AES key."
  };
}

function labelOf(value) {
  return value.replaceAll("_", " ");
}

function formatTime(value) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value || Date.now()));
}

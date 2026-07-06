import React, { useState } from "react";
import { useChat } from "../state/ChatContext.jsx";
import { useGroup } from "../state/GroupContext.jsx";
import { Users, X } from 'lucide-react';
import { readApiError } from "../services/api.js";

export function GroupModal() {
  const { friends, groupModalOpen, setGroupModalOpen, setActiveFriend } = useChat();
  const { createGroup } = useGroup();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!groupModalOpen) return null;

  const handleCreate = async (e) => {
    e.preventDefault();
    const members = Object.keys(selected).filter(id => selected[id]);
    if (members.length === 0) {
      setError("Please select at least one friend.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const group = await createGroup(name, members);
      setGroupModalOpen(false);
      setName("");
      setSelected({});
      // Select the newly created group in UI (we need to construct a friend-like object)
      setActiveFriend({
        chat_id: `group:${group.id}`,
        display_name: group.name,
        avatar_color: "#7c3aed",
        type: "group"
      });
    } catch (err) {
      setError(readApiError(err) || "Failed to create group");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-overlay">
      <div className="profile-modal">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users color="#00f0ff" />
            <h2 style={{ margin: 0 }}>Tạo Nhóm Mới</h2>
          </div>
          <button type="button" className="icon-button" onClick={() => setGroupModalOpen(false)}><X size={24} /></button>
        </header>

        {error && <p className="notice-banner error">{error}</p>}
        
        <form onSubmit={handleCreate} className="profile-form">
          <div className="form-group">
            <label>Tên Nhóm</label>
            <input value={name} onChange={e => setName(e.target.value)} required placeholder="Ví dụ: Dự án mật..." />
          </div>
          <div className="form-group">
            <label>Chọn thành viên ({Object.values(selected).filter(Boolean).length})</label>
            <div style={{ maxHeight: '180px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {friends.map(f => (
                <label key={f.chat_id} style={{ display: 'flex', gap: '12px', alignItems: 'center', cursor: 'pointer', padding: '8px', background: selected[f.chat_id] ? 'rgba(0,240,255,0.1)' : 'transparent', borderRadius: '8px', border: selected[f.chat_id] ? '1px solid var(--neon-blue)' : '1px solid transparent', transition: 'all 0.2s' }}>
                  <input type="checkbox" checked={!!selected[f.chat_id]} onChange={e => setSelected({...selected, [f.chat_id]: e.target.checked})} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                  <div className="avatar" style={{ background: f.avatar_color, width: '32px', height: '32px', fontSize: '14px', margin: 0 }}>
                    {(f.display_name || f.username).slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <strong style={{ display: 'block', fontSize: '14px', color: 'white' }}>{f.display_name || f.username}</strong>
                    <small style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{f.chat_id}</small>
                  </div>
                </label>
              ))}
              {friends.length === 0 && <span className="muted" style={{ fontSize: '14px', textAlign: 'center' }}>Chưa có bạn bè nào. Hãy kết bạn trước!</span>}
            </div>
          </div>
          <button className="neon-button" type="submit" disabled={loading} style={{ marginTop: '24px' }}>
            {loading ? "Đang xử lý..." : "Xác nhận Tạo Nhóm"}
          </button>
        </form>
      </div>
    </div>
  );
}

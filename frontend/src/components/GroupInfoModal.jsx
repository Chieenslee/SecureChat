import React, { useState, useEffect } from "react";
import { useChat } from "../state/ChatContext.jsx";
import { useGroup } from "../state/GroupContext.jsx";
import { Info, X, UserMinus, UserPlus } from 'lucide-react';
import { readApiError } from "../services/api.js";

export function GroupInfoModal() {
  const { groupInfoOpen, setGroupInfoOpen, activeFriend, setActiveFriend, friends, user } = useChat();
  const { groups, addMember, removeMember, deleteGroup } = useGroup();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [newMemberId, setNewMemberId] = useState("");

  useEffect(() => {
    setError("");
    setSuccess("");
    setNewMemberId("");
  }, [groupInfoOpen]);

  if (!groupInfoOpen || !activeFriend?.chat_id?.startsWith("group:")) return null;

  const groupId = parseInt(activeFriend.chat_id.split(":")[1]);
  const group = groups.find(g => g.id === groupId);

  if (!group) return null;

  const me = group.members.find(m => m.user_id === user.chat_id);
  const isAdmin = me && me.role === 'admin';

  const handleAddMember = async () => {
    if (!newMemberId) return;
    setLoading(true); setError(""); setSuccess("");
    try { 
      await addMember(group.id, newMemberId); 
      setSuccess("Đã thêm thành viên thành công!");
      setNewMemberId("");
    }
    catch (e) { setError(readApiError(e) || "Failed to add member"); }
    finally { setLoading(false); }
  };

  const handleRemoveMember = async (userId) => {
    setLoading(true); setError(""); setSuccess("");
    try { 
      await removeMember(group.id, userId); 
      setSuccess("Đã xóa thành viên thành công!");
    }
    catch (e) { setError(readApiError(e) || "Failed to remove member"); }
    finally { setLoading(false); }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn giải tán nhóm này? Hành động này không thể hoàn tác.")) return;
    setLoading(true); setError("");
    try {
      await deleteGroup(group.id);
      setGroupInfoOpen(false);
      setActiveFriend(null);
    }
    catch (e) { setError(readApiError(e) || "Failed to delete group"); }
    finally { setLoading(false); }
  };

  return (
    <div className="profile-overlay">
      <div className="profile-modal">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info color="#00f0ff" />
            <h2 style={{ margin: 0 }}>Thông tin Nhóm</h2>
          </div>
          <button type="button" className="icon-button" onClick={() => setGroupInfoOpen(false)}><X size={24} /></button>
        </header>
        
        {error && <p className="notice-banner error">{error}</p>}
        {success && <p className="notice-banner">{success}</p>}

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div className="avatar" style={{ background: '#7c3aed', width: '64px', height: '64px', fontSize: '28px', margin: '0 auto 12px auto', boxShadow: '0 0 20px rgba(124, 58, 237, 0.4)' }}>
            {group.name.slice(0, 1).toUpperCase()}
          </div>
          <h3 style={{ fontSize: '20px', margin: '0 0 4px 0' }}>{group.name}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
            {group.members.length} thành viên {isAdmin && <span style={{ color: '#10b981' }}>(Bạn là Quản trị)</span>}
          </p>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Thành viên</span>
          </label>
          <div style={{ maxHeight: '200px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {group.members.map(m => {
              const uObj = m.user_id === user.chat_id ? user : friends.find(f => f.chat_id === m.user_id) || { display_name: 'Unknown', avatar_color: '#ccc' };
              const mName = uObj.display_name || uObj.username || m.user_id;
              
              return (
              <div key={m.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '8px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div className="avatar" style={{ background: uObj.avatar_color, width: '32px', height: '32px', fontSize: '14px', margin: 0 }}>
                    {mName.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <strong style={{ display: 'block', fontSize: '14px' }}>
                      {mName} {m.user_id === user.chat_id && "(Bạn)"}
                    </strong>
                    <small style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{m.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}</small>
                  </div>
                </div>
                {isAdmin && m.user_id !== user.chat_id && (
                  <button 
                    className="icon-button" 
                    style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' }} 
                    onClick={() => handleRemoveMember(m.user_id)} 
                    disabled={loading}
                    title="Xóa thành viên"
                  >
                    <UserMinus size={16} />
                  </button>
                )}
              </div>
            )})}
          </div>
        </div>

        {isAdmin && (
          <div className="form-group" style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--glass-border)' }}>
            <label>Thêm thành viên mới</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                value={newMemberId} 
                onChange={e => setNewMemberId(e.target.value)} 
                placeholder="Nhập ID người dùng..." 
                disabled={loading}
                style={{ flex: 1 }}
              />
              <button className="primary-button" style={{ width: 'auto', padding: '14px 20px', display: 'flex', gap: '8px', alignItems: 'center' }} onClick={handleAddMember} disabled={loading || !newMemberId}>
                <UserPlus size={18} /> Thêm
              </button>
            </div>
          </div>
        )}

        {isAdmin && (
          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <button className="icon-button" style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '12px 24px', width: 'auto', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold' }} onClick={handleDeleteGroup} disabled={loading}>
              Giải tán nhóm
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

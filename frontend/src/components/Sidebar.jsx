import { useChat } from "../state/ChatContext.jsx";
import { useGroup } from "../state/GroupContext.jsx";
import { ShieldCheck, Search, Users, Settings, Check, X, UserPlus, ScrollText } from 'lucide-react';
import { useState, useMemo } from "react";

export function Sidebar() {
  const {
    user,
    status,
    friendId,
    setFriendId,
    sendFriendRequest,
    searchFriend,
    notice,
    friendPreview,
    requests,
    acceptRequest,
    rejectRequest,
    friends,
    activeFriend,
    setActiveFriend,
    setProfileOpen,
    setAdminLogOpen,
    setGroupModalOpen
  } = useChat();
  const { groups } = useGroup();
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friends;
    const q = searchQuery.trim().toLowerCase();
    return friends.filter(f =>
      (f.display_name || f.username || "").toLowerCase().includes(q) ||
      (f.chat_id || "").toLowerCase().includes(q)
    );
  }, [friends, searchQuery]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim() || !groups) return groups;
    const q = searchQuery.trim().toLowerCase();
    return groups.filter(g => (g.name || "").toLowerCase().includes(q));
  }, [groups, searchQuery]);

  const isAdmin = ["ADMIN", "admin"].includes(user?.username);

  return (
    <aside className="telegram-sidebar">
      <header className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck color="#00f0ff" />
          <h2>SecureChat</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isAdmin && (
            <button className="icon-button admin-log-button" onClick={() => setAdminLogOpen(true)} title="Admin logs">
              <ScrollText size={20} />
            </button>
          )}
          <button className="icon-button" onClick={() => setProfileOpen(true)} title="Hồ sơ">
            <Settings size={20} />
          </button>
        </div>
      </header>

      <div className="sidebar-search">
        <div style={{ position: 'relative', display: 'flex', gap: '8px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '12px' }} />
            <input placeholder="Tìm kiếm..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ paddingLeft: '36px' }} />
          </div>
          <button className="icon-button" style={{ background: 'rgba(255,255,255,0.05)' }} onClick={() => setShowAdd(!showAdd)}>
            <UserPlus size={18} />
          </button>
        </div>
        
        {showAdd && (
          <div style={{ marginTop: '12px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                value={friendId} 
                onChange={e => setFriendId(e.target.value)} 
                placeholder="#12345678" 
                style={{ flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '8px' }} 
              />
              <button className="primary-button" style={{ padding: '8px 12px', width: 'auto' }} onClick={searchFriend}>Tìm</button>
            </div>
            {friendPreview && (
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="avatar" style={{ width: 36, height: 36, fontSize: 16, background: friendPreview.avatar_color, margin: 0 }}>
                  {(friendPreview.display_name || friendPreview.username).slice(0, 1).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <strong style={{ display: 'block', fontSize: '14px' }}>{friendPreview.display_name || friendPreview.username}</strong>
                  <small style={{ color: 'var(--text-secondary)' }}>{friendPreview.is_friend ? "Đã là bạn bè" : "Chưa kết bạn"}</small>
                </div>
                {!friendPreview.is_friend && <button className="secondary-button" style={{ padding: '6px 10px' }} onClick={sendFriendRequest}>Thêm</button>}
              </div>
            )}
            {notice && <p style={{ color: 'var(--neon-blue)', fontSize: '13px', marginTop: '8px' }}>{notice}</p>}
          </div>
        )}
      </div>

      <div className="friend-list">
        {requests.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Lời mời</h4>
            {requests.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '12px', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>{item.requester_username}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="icon-button" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }} onClick={() => acceptRequest(item.id)}><Check size={16} /></button>
                  <button className="icon-button" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }} onClick={() => rejectRequest(item.id)}><X size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        <h4 style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '16px' }}>Nhóm bảo mật</h4>
        <button className="friend-item" onClick={() => setGroupModalOpen(true)}>
          <div className="avatar" style={{ background: 'var(--neon-gradient)', boxShadow: '0 0 15px rgba(0,240,255,0.3)', margin: 0, marginRight: '16px' }}><Users size={24} /></div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <strong style={{ display: 'block', fontSize: '15px' }}>Tạo Nhóm Mới</strong>
            <small style={{ color: 'var(--text-secondary)' }}>Nhóm chat E2EE</small>
          </div>
        </button>

        {filteredGroups && filteredGroups.map(group => {
          const groupIdStr = `group:${group.id}`;
          return (
            <button
              className={`friend-item ${groupIdStr === activeFriend?.chat_id ? "active" : ""}`}
              key={groupIdStr}
              onClick={() => setActiveFriend({chat_id: groupIdStr, display_name: group.name, avatar_color: "#7c3aed", type: "group"})}
            >
              <div className="avatar" style={{ background: "#7c3aed", margin: 0, marginRight: '16px' }}>
                {group.name.slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <strong style={{ display: 'block', fontSize: '15px' }}>{group.name}</strong>
                <small style={{ color: 'var(--text-secondary)' }}>{group.members.length} thành viên</small>
              </div>
            </button>
          )
        })}

        <h4 style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '16px' }}>Tin nhắn riêng</h4>

        {filteredFriends.map(friend => (
          <button
            className={`friend-item ${friend.chat_id === activeFriend?.chat_id ? "active" : ""}`}
            key={friend.chat_id}
            onClick={() => setActiveFriend(friend)}
          >
            <div className="avatar" style={{ background: friend.avatar_color, margin: 0, marginRight: '16px' }}>
              {(friend.display_name || friend.username).slice(0, 1).toUpperCase()}
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <strong style={{ display: 'block', fontSize: '15px' }}>{friend.display_name || friend.username}</strong>
              <small style={{ color: 'var(--text-secondary)' }}>{friend.chat_id}</small>
            </div>
          </button>
        ))}
        {filteredFriends.length === 0 && searchQuery.trim() && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '12px' }}>Không tìm thấy kết quả.</p>
        )}
      </div>
    </aside>
  );
}

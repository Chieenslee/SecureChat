import React from 'react';
import { useChat } from '../state/ChatContext.jsx';
import { MessageSquare, Users, User, Settings } from 'lucide-react';

export function BottomNav() {
  const { setProfileOpen, setGroupModalOpen, activeFriend, setActiveFriend } = useChat();

  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        <button 
          className={`nav-item ${!activeFriend ? 'active' : ''}`}
          onClick={() => { setActiveFriend(null); setProfileOpen(false); setGroupModalOpen(false); }}
        >
          <MessageSquare />
          <span>Chats</span>
        </button>
        <button 
          className="nav-item"
          onClick={() => { setGroupModalOpen(true); setProfileOpen(false); }}
        >
          <Users />
          <span>Nhóm</span>
        </button>
        <button 
          className="nav-item"
          onClick={() => { setProfileOpen(true); setGroupModalOpen(false); }}
        >
          <User />
          <span>Hồ sơ</span>
        </button>
      </div>
    </nav>
  );
}

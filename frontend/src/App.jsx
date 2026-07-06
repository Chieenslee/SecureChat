import { AuthView } from "./components/AuthView.jsx";
import { ChatWindow } from "./components/ChatWindow.jsx";
import { ProfileModal } from "./components/ProfileModal.jsx";
import { Sidebar } from "./components/Sidebar.jsx";
import { GroupModal } from "./components/GroupModal.jsx";
import { GroupInfoModal } from "./components/GroupInfoModal.jsx";
import { BottomNav } from "./components/BottomNav.jsx";
import { AdminLogModal } from "./components/AdminLogModal.jsx";
import { ChatProvider, useChat } from "./state/ChatContext.jsx";
import { GroupProvider } from "./state/GroupContext.jsx";

function AppContent() {
  const { token, user, keys, activeFriend } = useChat();

  if (!token || !user || !keys) {
    return <AuthView />;
  }

  return (
    <GroupProvider>
      <main className={activeFriend ? "telegram-shell chat-open" : "telegram-shell"}>
        <Sidebar />
        <ChatWindow />
        <ProfileModal />
        <GroupModal />
        <GroupInfoModal />
        <AdminLogModal />
        <BottomNav />
      </main>
    </GroupProvider>
  );
}

export function App() {
  return (
    <ChatProvider>
      <AppContent />
    </ChatProvider>
  );
}

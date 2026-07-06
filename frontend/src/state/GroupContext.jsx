import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiGet, apiPost, apiDelete, readApiError } from "../services/api.js";
import { useChat } from "./ChatContext.jsx";
import { generateGroupKey, encryptGroupKeyForMembers } from "../secureCrypto.js";

const GroupContext = createContext(null);

export function GroupProvider({ children }) {
  const { token, user, getPublicKeys, addSystemMessage } = useChat();
  const [groups, setGroups] = useState([]);
  const [notice, setNotice] = useState("");

  const refreshGroups = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiGet("/api/groups", token);
      setGroups(data.groups);
    } catch (error) {
      console.error("Failed to fetch groups:", error);
    }
  }, [token]);

  useEffect(() => {
    refreshGroups();
    const intervalId = window.setInterval(refreshGroups, 5000);
    return () => window.clearInterval(intervalId);
  }, [refreshGroups]);

  async function rotateGroupKey(groupId, members) {
    try {
      const groupKey = await generateGroupKey();
      const memberKeysMap = {};
      for (const member of members) {
        const peerKeys = await getPublicKeys(member.user_id);
        memberKeysMap[member.user_id] = peerKeys.publicKeyBundle;
      }
      
      const encryptedKeys = await encryptGroupKeyForMembers(groupKey, memberKeysMap);
      await apiPost(`/api/groups/${groupId}/rotate-key`, { encrypted_keys: encryptedKeys }, token);
      addSystemMessage(`group:${groupId}`, "Khóa nhóm đã được thay đổi an toàn.");
    } catch (error) {
      console.error("Rotate key failed", error);
      throw error;
    }
  }

  async function createGroup(name, memberIds) {
    try {
      setNotice("");
      const group = await apiPost("/api/groups", { name, member_ids: memberIds }, token);
      await rotateGroupKey(group.id, group.members);
      await refreshGroups();
      return group;
    } catch (error) {
      setNotice(readApiError(error));
      throw error;
    }
  }

  async function deleteGroup(groupId) {
    try {
      setNotice("");
      await apiDelete(`/api/groups/${groupId}`, token);
      await refreshGroups();
    } catch (error) {
      setNotice(readApiError(error));
      throw error;
    }
  }

  async function addMember(groupId, userId) {
    try {
      setNotice("");
      await apiPost(`/api/groups/${groupId}/members`, { user_id: userId }, token);
      const group = await apiGet(`/api/groups/${groupId}`, token);
      await rotateGroupKey(groupId, group.members);
      await refreshGroups();
    } catch (error) {
      setNotice(readApiError(error));
      throw error;
    }
  }

  async function removeMember(groupId, userId) {
    try {
      setNotice("");
      await apiDelete(`/api/groups/${groupId}/members/${encodeURIComponent(userId)}`, token);
      const group = await apiGet(`/api/groups/${groupId}`, token);
      await rotateGroupKey(groupId, group.members);
      await refreshGroups();
    } catch (error) {
      setNotice(readApiError(error));
      throw error;
    }
  }

  const value = {
    groups,
    notice,
    setNotice,
    refreshGroups,
    createGroup,
    deleteGroup,
    addMember,
    removeMember
  };

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
}

export function useGroup() {
  const context = useContext(GroupContext);
  if (!context) throw new Error("useGroup must be used within GroupProvider");
  return context;
}

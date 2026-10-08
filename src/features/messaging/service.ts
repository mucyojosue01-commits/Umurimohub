import { db } from "@/lib/pending-db";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Conversation = import("@/lib/pending-db").ConversationRow & {
  otherUserId: string;
  otherName: string;
  lastMessage?: import("@/lib/pending-db").MessageRow | undefined;
  unreadCount: number;
};

export type Message = import("@/lib/pending-db").MessageRow & { read: boolean };

export async function listConversations(userId: string): Promise<Conversation[]> {
  const { data: memberships, error: memberError } = await db
    .from("conversation_members")
    .select("conversation_id,user_id")
    .eq("user_id", userId);
  if (memberError) throw memberError;
  const ids = (memberships ?? []).map((m: any) => m.conversation_id);
  if (!ids.length) return [];

  const { data: conversations, error: conversationError } = await db
    .from("conversations")
    .select("*")
    .in("id", ids)
    .order("created_at", { ascending: false });
  if (conversationError) throw conversationError;

  const { data: allMembers, error: allMembersError } = await db
    .from("conversation_members")
    .select("conversation_id,user_id")
    .in("conversation_id", ids);
  if (allMembersError) throw allMembersError;

  const otherIds = [...new Set((allMembers ?? []).filter((m: any) => m.user_id !== userId).map((m: any) => m.user_id))];
  const { data: profiles, error: profilesError } = otherIds.length
    ? await db.from("profiles").select("id,display_name").in("id", otherIds)
    : { data: [], error: null };
  if (profilesError) throw profilesError;

  const profileNames = new Map((profiles ?? []).map((p: any) => [p.id, p.display_name]));
  const result: Conversation[] = [];
  for (const conversation of conversations ?? []) {
    const other = (allMembers ?? []).find(
      ((m: any) => m.conversation_id === conversation.id && m.user_id !== userId,
    );
    if (!other) continue;
    const { data: last } = await db
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: incoming } = await db
      .from("messages")
      .select("id")
      .eq("conversation_id", conversation.id)
      .neq("sender_id", userId);
    const incomingIds = (incoming ?? []).map((m: any) => m.id);
    const { data: reads } = incomingIds.length
      ? await db
          .from("message_reads")
          .select("message_id")
          .eq("user_id", userId)
          .in("message_id", incomingIds)
      : { data: [] };
    const readIds = new Set((reads ?? []).map((r: any) => r.message_id));
    result.push({
      ...conversation,
      otherUserId: other.user_id,
      otherName: profileNames.get(other.user_id) ?? "UmurimoHub member",
      lastMessage: last ?? undefined,
      unreadCount: incomingIds.filter((id: any) => !readIds.has(id)).length,
    });
  }
  return result;
}

export async function listMessages(conversationId: string, userId: string): Promise<Message[]> {
  const { data, error } = await db
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const ids = (data ?? []).map((m: any) => m.id);
  if (!ids.length) return [];
  const { data: reads, error: readsError } = await db
    .from("message_reads")
    .select("message_id")
    .eq("user_id", userId)
    .in("message_id", ids);
  if (readsError) throw readsError;
  const readIds = new Set((reads ?? []).map((r: any) => r.message_id));
  return (data ?? []).map((m: any) => ({ ...m, read: readIds.has(m.id) }));
}

export async function getOrCreateDirectConversation(otherUserId: string, opportunityId?: string, subject?: string) {
  const { data, error } = await db.rpc("get_or_create_direct_conversation", {
    _other_user: otherUserId,
    ...(opportunityId ? { _opportunity_id: opportunityId } : {}),
    ...(subject ? { _subject: subject } : {}),
  });
  if (error) throw error;
  return data as string;
}

export async function sendMessage(conversationId: string, senderId: string, body: string) {
  const clean = body.trim();
  if (!clean) throw new Error("Message cannot be empty.");
  if (clean.length > 5000) throw new Error("Message is too long.");
  const { data, error } = await db
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: senderId, body: clean })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function markMessageRead(messageId: string) {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;
  const { error } = await db.from("message_reads").upsert(
    { message_id: messageId, user_id: userId },
    { onConflict: "message_id,user_id", ignoreDuplicates: true },
  );
  if (error) throw error;
}

export async function markMessagesRead(messageIds: string[]) {
  if (!messageIds.length) return;
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return;
  const { error } = await db.from("message_reads").upsert(
    messageIds.map((message_id) => ({ message_id, user_id: userId })),
    { onConflict: "message_id,user_id", ignoreDuplicates: true },
  );
  if (error) throw error;
}

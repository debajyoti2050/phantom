import { invoke } from "@tauri-apps/api/core";

export interface ConversationStorageInfo {
  folderPath: string;
  databasePath: string;
  defaultFolderPath: string;
  isDefault: boolean;
}

export async function getConversationStorageInfo(): Promise<ConversationStorageInfo> {
  return invoke<ConversationStorageInfo>("get_conversation_storage_info");
}

export async function chooseConversationStorageFolder(): Promise<ConversationStorageInfo> {
  return invoke<ConversationStorageInfo>("choose_conversation_storage_folder");
}

export async function resetConversationStorageFolder(): Promise<ConversationStorageInfo> {
  return invoke<ConversationStorageInfo>("reset_conversation_storage_folder");
}

export async function openConversationStorageFolder(): Promise<ConversationStorageInfo> {
  return invoke<ConversationStorageInfo>("open_conversation_storage_folder");
}

import { invoke } from "@/lib/electron/tauri-core";

export type ProviderKeyKind = "ai" | "stt";

export interface ProviderApiKeyProfile {
  id: string;
  name: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

export type ProviderApiKeyVault = Record<
  ProviderKeyKind,
  Record<string, ProviderApiKeyProfile[]>
>;

const emptyVault = (): ProviderApiKeyVault => ({ ai: {}, stt: {} });

const createId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `key-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function normalizeVault(vault?: Partial<ProviderApiKeyVault> | null) {
  const normalized = emptyVault();
  if (!vault || typeof vault !== "object") return normalized;

  for (const kind of ["ai", "stt"] as ProviderKeyKind[]) {
    const providers = vault[kind];
    if (!providers || typeof providers !== "object") continue;
    for (const [providerId, profiles] of Object.entries(providers)) {
      if (!providerId || !Array.isArray(profiles)) continue;
      normalized[kind][providerId] = profiles
        .filter((profile): profile is ProviderApiKeyProfile =>
          Boolean(profile && typeof profile === "object")
        )
        .map((profile) => ({
          id: String(profile.id || createId()),
          name: String(profile.name || "API key"),
          value: String(profile.value || ""),
          createdAt: String(profile.createdAt || new Date().toISOString()),
          updatedAt: String(profile.updatedAt || new Date().toISOString()),
        }))
        .filter((profile) => profile.value.trim());
    }
  }

  return normalized;
}

export async function getProviderApiKeyVault() {
  const vault = await invoke<Partial<ProviderApiKeyVault>>(
    "provider_key_vault_get"
  );
  return normalizeVault(vault);
}

export async function saveProviderApiKeyVault(vault: ProviderApiKeyVault) {
  const savedVault = await invoke<Partial<ProviderApiKeyVault>>(
    "provider_key_vault_save",
    { vault }
  );
  return normalizeVault(savedVault);
}

export async function getProviderApiKeyProfiles(
  kind: ProviderKeyKind,
  providerId: string
) {
  if (!providerId) return [];
  const vault = await getProviderApiKeyVault();
  return vault[kind][providerId] || [];
}

export async function saveProviderApiKeyProfile(
  kind: ProviderKeyKind,
  providerId: string,
  input: {
    id?: string;
    name: string;
    value: string;
  }
) {
  const vault = await getProviderApiKeyVault();
  const currentProfiles = vault[kind][providerId] || [];
  const now = new Date().toISOString();
  const existing = input.id
    ? currentProfiles.find((profile) => profile.id === input.id)
    : undefined;
  const profile: ProviderApiKeyProfile = {
    id: existing?.id || input.id || createId(),
    name: input.name.trim() || existing?.name || "API key",
    value: input.value,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  vault[kind][providerId] = currentProfiles
    .filter((item) => item.id !== profile.id)
    .concat(profile)
    .filter((item) => item.value.trim());

  await saveProviderApiKeyVault(vault);
  return profile;
}

export async function deleteProviderApiKeyProfile(
  kind: ProviderKeyKind,
  providerId: string,
  profileId: string
) {
  const vault = await getProviderApiKeyVault();
  vault[kind][providerId] = (vault[kind][providerId] || []).filter(
    (profile) => profile.id !== profileId
  );
  await saveProviderApiKeyVault(vault);
  return vault[kind][providerId];
}

import {
  Button,
  Header,
  Input,
  Label,
  Selection,
  Switch,
  TextInput,
} from "@/components";
import {
  deleteProviderApiKeyProfile,
  getProviderApiKeyProfiles,
  ProviderApiKeyProfile,
  saveProviderApiKeyProfile,
} from "@/lib/storage/provider-api-keys";
import { cn } from "@/lib/utils";
import { UseSettingsReturn } from "@/types";
import anthropicLogo from "@lobehub/icons-static-svg/icons/anthropic.svg?url";
import cohereLogo from "@lobehub/icons-static-svg/icons/cohere-color.svg?url";
import geminiLogo from "@lobehub/icons-static-svg/icons/gemini-color.svg?url";
import grokLogo from "@lobehub/icons-static-svg/icons/grok.svg?url";
import groqLogo from "@lobehub/icons-static-svg/icons/groq.svg?url";
import mistralLogo from "@lobehub/icons-static-svg/icons/mistral-color.svg?url";
import nvidiaLogo from "@lobehub/icons-static-svg/icons/nvidia-color.svg?url";
import ollamaLogo from "@lobehub/icons-static-svg/icons/ollama.svg?url";
import openAiLogo from "@lobehub/icons-static-svg/icons/openai.svg?url";
import openRouterLogo from "@lobehub/icons-static-svg/icons/openrouter.svg?url";
import perplexityLogo from "@lobehub/icons-static-svg/icons/perplexity-color.svg?url";
import curl2Json, { ResultJSON } from "@bany/curl-to-json";
import {
  CheckIcon,
  ChevronDownIcon,
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
  PlusIcon,
  RadioIcon,
  SaveIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  TrashIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type ProviderVisual = {
  label: string;
  mark: string;
  logoSrc?: string;
  logoClassName?: string;
  accent: string;
  glow: string;
  recommended?: boolean;
};

const PROVIDER_VISUALS: Record<string, ProviderVisual> = {
  openai: {
    label: "OpenAI Compatible",
    mark: "AI",
    logoSrc: openAiLogo,
    accent: "from-sky-400 via-indigo-400 to-violet-500",
    glow: "shadow-cyan-400/30",
    recommended: true,
  },
  gemini: {
    label: "Gemini",
    mark: "G",
    logoSrc: geminiLogo,
    accent: "from-blue-300 via-cyan-300 to-violet-400",
    glow: "shadow-blue-400/30",
  },
  claude: {
    label: "Anthropic",
    mark: "A",
    logoSrc: anthropicLogo,
    logoClassName: "scale-110",
    accent: "from-slate-200 via-cyan-300 to-violet-400",
    glow: "shadow-violet-400/25",
  },
  groq: {
    label: "Groq",
    mark: "g",
    logoSrc: groqLogo,
    accent: "from-cyan-300 via-blue-400 to-violet-500",
    glow: "shadow-cyan-400/30",
  },
  "nvidia-nim": {
    label: "NVIDIA NIM",
    mark: "N",
    logoSrc: nvidiaLogo,
    logoClassName: "scale-125",
    accent: "from-lime-300 via-green-400 to-emerald-500",
    glow: "shadow-lime-400/30",
  },
  ollama: {
    label: "Ollama",
    mark: "O",
    logoSrc: ollamaLogo,
    accent: "from-zinc-200 via-slate-300 to-cyan-300",
    glow: "shadow-cyan-200/25",
  },
  openrouter: {
    label: "OpenRouter",
    mark: "OR",
    logoSrc: openRouterLogo,
    accent: "from-fuchsia-300 via-violet-400 to-blue-400",
    glow: "shadow-violet-400/30",
  },
  mistral: {
    label: "Mistral",
    mark: "M",
    logoSrc: mistralLogo,
    accent: "from-sky-300 via-indigo-400 to-violet-500",
    glow: "shadow-blue-400/30",
  },
  cohere: {
    label: "Cohere",
    mark: "C",
    logoSrc: cohereLogo,
    accent: "from-emerald-300 via-teal-400 to-sky-400",
    glow: "shadow-emerald-400/30",
  },
  perplexity: {
    label: "Perplexity",
    mark: "P",
    logoSrc: perplexityLogo,
    accent: "from-cyan-300 via-teal-300 to-blue-500",
    glow: "shadow-cyan-400/30",
  },
  grok: {
    label: "xAI Grok",
    mark: "x",
    logoSrc: grokLogo,
    accent: "from-slate-100 via-zinc-300 to-violet-300",
    glow: "shadow-violet-300/25",
  },
};

export const Providers = ({
  allAiProviders,
  selectedAIProvider,
  onSetSelectedAIProvider,
  variables,
}: UseSettingsReturn) => {
  const [localSelectedProvider, setLocalSelectedProvider] =
    useState<ResultJSON | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyProfiles, setApiKeyProfiles] = useState<
    ProviderApiKeyProfile[]
  >([]);
  const [selectedApiKeyId, setSelectedApiKeyId] = useState("");
  const [apiKeyProfileName, setApiKeyProfileName] = useState("");
  const [apiKeyStatus, setApiKeyStatus] = useState("");

  const selectedProvider = allAiProviders?.find(
    (p) => p?.id === selectedAIProvider?.provider
  );
  const selectedProviderName =
    selectedProvider?.name || selectedAIProvider?.provider || "AI provider";
  const selectedProviderVisual = getProviderVisual(selectedProvider);
  const apiKeyVar = findVariable(variables, "api_key");
  const modelVar = findVariable(variables, "model");
  const extraVariables = variables.filter(
    (variable) =>
      variable.key !== apiKeyVar?.key && variable.key !== modelVar?.key
  );
  const apiKeyValue = getVariableValue(selectedAIProvider, apiKeyVar?.key);
  const modelValue = getVariableValue(selectedAIProvider, modelVar?.key);
  const hasRequiredConfig =
    (!apiKeyVar || Boolean(apiKeyValue.trim())) &&
    (!modelVar || Boolean(modelValue.trim()));
  const endpoint = localSelectedProvider?.url || "Endpoint unavailable";

  const providerOptions = useMemo(
    () =>
      allAiProviders?.map((provider) => {
        const json = curl2Json(provider?.curl);
        return {
          label: provider?.isCustom
            ? json?.url || "Custom Provider"
            : getProviderVisual(provider).label,
          value: provider?.id || "Custom Provider",
          isCustom: provider?.isCustom,
        };
      }) || [],
    [allAiProviders]
  );

  useEffect(() => {
    if (selectedAIProvider?.provider) {
      const provider = allAiProviders?.find(
        (p) => p?.id === selectedAIProvider?.provider
      );
      if (provider) {
        const json = curl2Json(provider?.curl);
        setLocalSelectedProvider(json as ResultJSON);
      }
    }
  }, [allAiProviders, selectedAIProvider?.provider]);

  const getNextApiKeyProfileName = useCallback(
    (profiles = apiKeyProfiles) =>
      `${selectedProviderVisual.label} key ${profiles.length + 1}`,
    [apiKeyProfiles, selectedProviderVisual.label]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadApiKeyProfiles() {
      if (!apiKeyVar || !selectedAIProvider?.provider) {
        setApiKeyProfiles([]);
        setSelectedApiKeyId("");
        setApiKeyProfileName("");
        return;
      }

      const profiles = await getProviderApiKeyProfiles(
        "ai",
        selectedAIProvider.provider
      );
      if (!isMounted) return;

      const matchingProfile = profiles.find(
        (profile) => profile.value === apiKeyValue
      );
      setApiKeyProfiles(profiles);
      setSelectedApiKeyId(matchingProfile?.id || "");
      setApiKeyProfileName(
        matchingProfile?.name || getNextApiKeyProfileName(profiles)
      );
    }

    void loadApiKeyProfiles();

    return () => {
      isMounted = false;
    };
  }, [
    apiKeyVar?.key,
    apiKeyValue,
    getNextApiKeyProfileName,
    selectedAIProvider?.provider,
  ]);

  const setSelectedProvider = (provider: string) => {
    const nextProvider = allAiProviders?.find((p) => p?.id === provider);
    const defaultModel = nextProvider?.defaultModel?.trim();
    onSetSelectedAIProvider({
      provider,
      variables: defaultModel ? { model: defaultModel } : {},
    });
    setShowApiKey(false);
  };

  const setVariableValue = (key: string | undefined, value: string) => {
    if (!key || !selectedAIProvider) return;

    onSetSelectedAIProvider({
      ...selectedAIProvider,
      variables: {
        ...selectedAIProvider.variables,
        [key]: value,
      },
    });
  };

  const persistApiKeyProfile = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!apiKeyVar || !selectedAIProvider?.provider || !apiKeyValue.trim()) {
        return;
      }

      const profile = await saveProviderApiKeyProfile(
        "ai",
        selectedAIProvider.provider,
        {
          id: selectedApiKeyId || undefined,
          name: apiKeyProfileName || getNextApiKeyProfileName(),
          value: apiKeyValue.trim(),
        }
      );

      setApiKeyProfiles((profiles) =>
        profiles
          .filter((item) => item.id !== profile.id)
          .concat(profile)
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setSelectedApiKeyId(profile.id);
      setApiKeyProfileName(profile.name);
      setApiKeyStatus(silent ? "Auto-saved" : "Saved");
      window.setTimeout(() => setApiKeyStatus(""), 1800);
    },
    [
      apiKeyProfileName,
      apiKeyValue,
      apiKeyVar?.key,
      getNextApiKeyProfileName,
      selectedAIProvider?.provider,
      selectedApiKeyId,
    ]
  );

  useEffect(() => {
    if (!apiKeyVar || !selectedAIProvider?.provider || !apiKeyValue.trim()) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void persistApiKeyProfile({ silent: true });
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [
    apiKeyValue,
    apiKeyProfileName,
    apiKeyVar?.key,
    persistApiKeyProfile,
    selectedAIProvider?.provider,
  ]);

  const handleApiKeyProfileSelect = (profileId: string) => {
    const profile = apiKeyProfiles.find((item) => item.id === profileId);
    if (!profile || !apiKeyVar) return;

    setSelectedApiKeyId(profile.id);
    setApiKeyProfileName(profile.name);
    setVariableValue(apiKeyVar.key, profile.value);
    setApiKeyStatus("Selected");
    window.setTimeout(() => setApiKeyStatus(""), 1600);
  };

  const handleCreateNewApiKeyProfile = () => {
    setSelectedApiKeyId("");
    setApiKeyProfileName(getNextApiKeyProfileName());
    if (apiKeyVar) {
      setVariableValue(apiKeyVar.key, "");
    }
    setShowApiKey(false);
    setApiKeyStatus("New key");
    window.setTimeout(() => setApiKeyStatus(""), 1600);
  };

  const handleDeleteSelectedApiKey = async () => {
    if (!apiKeyVar || !selectedAIProvider?.provider) return;

    if (!selectedApiKeyId) {
      setVariableValue(apiKeyVar.key, "");
      setApiKeyProfileName(getNextApiKeyProfileName());
      return;
    }

    const deletedProfile = apiKeyProfiles.find(
      (profile) => profile.id === selectedApiKeyId
    );
    const nextProfiles = await deleteProviderApiKeyProfile(
      "ai",
      selectedAIProvider.provider,
      selectedApiKeyId
    );
    setApiKeyProfiles(nextProfiles);
    setSelectedApiKeyId("");
    setApiKeyProfileName(getNextApiKeyProfileName(nextProfiles));

    if (deletedProfile?.value === apiKeyValue) {
      setVariableValue(apiKeyVar.key, "");
    }

    setApiKeyStatus("Deleted");
    window.setTimeout(() => setApiKeyStatus(""), 1600);
  };

  return (
    <div className="relative overflow-hidden rounded-[26px] border border-cyan-200/20 bg-[linear-gradient(135deg,rgba(6,10,20,0.92),rgba(12,16,34,0.76)_48%,rgba(11,8,27,0.86))] p-5 shadow-[0_0_0_1px_rgba(125,211,252,0.12),0_0_52px_rgba(56,189,248,0.12),0_28px_90px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent" />
      <div className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full bg-cyan-500/14 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 left-8 size-96 rounded-full bg-violet-500/14 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-12 h-28 w-2/3 -translate-x-1/2 rounded-full bg-blue-500/8 blur-3xl" />

      <div className="relative space-y-5">
        <div className="flex flex-col gap-3 border-b border-white/10 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <Header
            title="Providers"
            description="Connect and manage the AI models you want to use with Phantom."
            titleClassName="text-2xl"
            descriptionClassName="text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium",
                hasRequiredConfig
                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                  : "border-violet-300/20 bg-violet-300/10 text-violet-100"
              )}
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  hasRequiredConfig ? "bg-emerald-400" : "bg-violet-300"
                )}
              />
              {hasRequiredConfig ? "Configured" : "Needs setup"}
            </span>
            <span
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-foreground"
              title="Run a prompt from the overlay to test this provider."
            >
              <RadioIcon className="size-4" />
              Test from overlay
            </span>
          </div>
        </div>

        <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">
              Active Provider
            </Label>
            <Selection
              selected={selectedAIProvider?.provider}
              options={providerOptions}
              placeholder="Choose your AI provider"
              onChange={setSelectedProvider}
            />
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-cyan-200/15 bg-white/[0.055] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl">
            <ProviderLogo visual={selectedProviderVisual} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {selectedProviderVisual.label}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {selectedProvider?.streaming ? "Streaming enabled" : "Standard response"}
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">
            Choose a Provider
          </Label>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {allAiProviders?.map((provider) => {
              const visual = getProviderVisual(provider);
              const isSelected = provider?.id === selectedAIProvider?.provider;

              return (
                <button
                  key={provider?.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() =>
                    provider?.id && provider?.id !== selectedAIProvider.provider
                      ? setSelectedProvider(provider.id)
                      : undefined
                  }
                  className={cn(
                    "group relative min-h-[142px] overflow-hidden rounded-2xl border bg-white/[0.045] p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl transition-all duration-300",
                    "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_0%,rgba(125,211,252,0.18),transparent_42%)] before:opacity-0 before:transition-opacity hover:before:opacity-100",
                    "hover:-translate-y-0.5 hover:border-cyan-300/55 hover:bg-white/[0.075] hover:shadow-[0_0_42px_rgba(34,211,238,0.14),0_18px_50px_rgba(0,0,0,0.22)]",
                    isSelected
                      ? "border-cyan-300/75 shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_0_32px_rgba(56,189,248,0.20),0_18px_60px_rgba(99,102,241,0.22)]"
                      : "border-white/10"
                  )}
                >
                  <div className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <div
                    className={cn(
                      "absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r opacity-60 transition-opacity",
                      visual.accent,
                      isSelected ? "opacity-100" : "group-hover:opacity-90"
                    )}
                  />
                  {isSelected ? (
                    <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-violet-500 text-white shadow-[0_0_18px_rgba(139,92,246,0.5)]">
                      <CheckIcon className="size-3.5" />
                    </span>
                  ) : null}

                  <ProviderLogo visual={visual} />

                  <div className="space-y-1">
                    <p className="min-h-[36px] text-sm font-semibold leading-tight text-foreground">
                      {visual.label}
                    </p>
                    {visual.recommended ? (
                      <span className="inline-flex rounded-md border border-violet-300/20 bg-violet-300/10 px-2 py-0.5 text-[10px] font-medium text-violet-200">
                        Recommended
                      </span>
                    ) : provider?.isCustom ? (
                      <span className="inline-flex rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-medium text-cyan-100">
                        Custom
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">
                        Built-in
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-cyan-200/15 bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl">
          <div className="grid gap-4 lg:grid-cols-2">
            {apiKeyVar ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">
                  API Key
                </Label>
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_220px_auto]">
                  <div className="space-y-1">
                    <Selection
                      selected={selectedApiKeyId}
                      options={apiKeyProfiles.map((profile) => ({
                        label: profile.name,
                        value: profile.id,
                      }))}
                      placeholder={
                        apiKeyProfiles.length
                          ? "Select a saved key"
                          : "No saved keys yet"
                      }
                      onChange={handleApiKeyProfileSelect}
                      disabled={!apiKeyProfiles.length}
                    />
                  </div>
                  <Input
                    value={apiKeyProfileName}
                    onChange={(event) =>
                      setApiKeyProfileName(event.target.value)
                    }
                    placeholder="API key 1"
                    className="h-11 rounded-xl border-cyan-200/15 bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] focus-visible:border-cyan-300/50 focus-visible:ring-cyan-300/20"
                  />
                  <Button
                    type="button"
                    onClick={handleCreateNewApiKeyProfile}
                    size="icon"
                    variant="outline"
                    className="size-11"
                    title="Create a new saved API key"
                  >
                    <PlusIcon className="size-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      placeholder="Paste your provider key"
                      value={apiKeyValue}
                      onChange={(event) =>
                        setVariableValue(apiKeyVar.key, event.target.value)
                      }
                      className="h-11 rounded-xl border-cyan-200/15 bg-black/25 pr-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] focus-visible:border-cyan-300/50 focus-visible:ring-cyan-300/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey((value) => !value)}
                      className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
                      title={showApiKey ? "Hide API key" : "Show API key"}
                    >
                      {showApiKey ? (
                        <EyeOffIcon className="size-4" />
                      ) : (
                        <EyeIcon className="size-4" />
                      )}
                    </button>
                  </div>
                  <Button
                    type="button"
                    onClick={() => void persistApiKeyProfile()}
                    size="icon"
                    variant="outline"
                    disabled={!apiKeyValue.trim()}
                    className="size-11"
                    title="Save API key profile"
                  >
                    <SaveIcon className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleDeleteSelectedApiKey()}
                    size="icon"
                    variant={apiKeyValue || selectedApiKeyId ? "destructive" : "outline"}
                    disabled={!apiKeyValue && !selectedApiKeyId}
                    className="size-11"
                    title={
                      selectedApiKeyId
                        ? "Delete saved API key"
                        : "Clear current API key"
                    }
                  >
                    {apiKeyValue || selectedApiKeyId ? (
                      <TrashIcon className="size-4" />
                    ) : (
                      <KeyRoundIcon className="size-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Saved keys are stored locally in Phantom's secure vault when
                  available. {apiKeyProfiles.length} saved for{" "}
                  {selectedProviderVisual.label}
                  {apiKeyStatus ? (
                    <span className="ml-2 text-cyan-200">{apiKeyStatus}</span>
                  ) : null}
                </p>
              </div>
            ) : null}

            {modelVar ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">
                  Model Name
                </Label>
                <TextInput
                  placeholder="gpt-4o-mini, moonshotai/kimi-k2.6, llama3.2"
                  value={modelValue}
                  onChange={(value) => setVariableValue(modelVar.key, value)}
                  notes={`Used as {{${modelVar.value}}} for ${selectedProviderName}.`}
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">
                Endpoint
              </Label>
              <Input
                value={endpoint}
                readOnly
                className="h-11 rounded-xl border-cyan-200/15 bg-black/25 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
              />
              <p className="text-xs text-muted-foreground">
                Create a custom provider if you want to edit the base URL.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-cyan-200/15 bg-black/25 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div>
                <Label className="text-sm font-medium text-foreground">
                  Streaming
                </Label>
                <p className="text-xs text-muted-foreground">
                  Enable streaming responses for faster visible output.
                </p>
              </div>
              <Switch checked={Boolean(selectedProvider?.streaming)} disabled />
            </div>
          </div>

          {extraVariables.length > 0 ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {extraVariables.map((variable) => (
                <TextInput
                  key={variable.key}
                  label={variable.value}
                  placeholder={`Enter ${variable.key.replace(/_/g, " ")}`}
                  value={getVariableValue(selectedAIProvider, variable.key)}
                  onChange={(value) => setVariableValue(variable.key, value)}
                  notes={`Used as {{${variable.value}}} for ${selectedProviderName}.`}
                />
              ))}
            </div>
          ) : null}

          <details className="group mt-4 rounded-xl border border-cyan-200/15 bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <summary
              className="flex cursor-pointer list-none items-center justify-between px-3 py-3 text-left"
              title="Advanced provider details."
            >
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <SlidersHorizontalIcon className="size-4 text-cyan-200" />
                Advanced Options
                <span className="text-xs font-normal text-muted-foreground">
                  Headers, endpoint, response path, vision and more
                </span>
              </span>
              <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="grid gap-3 border-t border-white/10 px-3 py-3 text-xs text-muted-foreground md:grid-cols-3">
              <div>
                <p className="font-medium text-foreground">Method</p>
                <p>{localSelectedProvider?.method || "POST"}</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Response Path</p>
                <p>{selectedProvider?.responseContentPath || "Not set"}</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Vision</p>
                <p>{selectedProvider?.curl?.includes("{{IMAGE}}") ? "Supported" : "Text only"}</p>
              </div>
            </div>
          </details>
        </section>
      </div>
    </div>
  );
};

function findVariable(
  variables: { key: string; value: string }[],
  key: string
) {
  return variables.find((variable) => variable.key === key);
}

function getVariableValue(
  selectedAIProvider: UseSettingsReturn["selectedAIProvider"],
  key?: string
) {
  if (!key || !selectedAIProvider?.variables) return "";
  return selectedAIProvider.variables[key] || "";
}

function ProviderLogo({
  visual,
  size = "md",
}: {
  visual: ProviderVisual;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "relative mb-3 grid place-items-center overflow-hidden rounded-2xl bg-gradient-to-br text-base font-bold text-black shadow-lg",
        visual.accent,
        visual.glow,
        size === "sm" ? "mb-0 size-10 rounded-xl" : "size-14"
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgba(255,255,255,0.65),transparent_34%)]" />
      <div className="absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_1px_rgba(255,255,255,0.55),inset_0_-12px_22px_rgba(0,0,0,0.18)]" />
      {visual.logoSrc ? (
        <img
          src={visual.logoSrc}
          alt=""
          aria-hidden="true"
          className={cn(
            "relative size-7 object-contain drop-shadow-[0_3px_10px_rgba(0,0,0,0.25)]",
            size === "sm" && "size-5",
            visual.logoClassName
          )}
        />
      ) : (
        <SparklesIcon
          className={cn("relative size-6", size === "sm" && "size-4")}
        />
      )}
    </div>
  );
}

function getProviderVisual(
  provider?: UseSettingsReturn["allAiProviders"][number]
): ProviderVisual {
  if (!provider?.id) {
    return {
      label: "AI Provider",
      mark: "AI",
      accent: "from-cyan-300 via-blue-400 to-violet-500",
      glow: "shadow-cyan-400/30",
    };
  }

  if (provider.isCustom) {
    return {
      label: provider.name || "Custom",
      mark: "+",
      accent: "from-slate-200 via-cyan-300 to-violet-400",
      glow: "shadow-cyan-300/25",
    };
  }

  return (
    PROVIDER_VISUALS[provider.id] || {
      label: provider.name || provider.id,
      mark: provider.name?.slice(0, 2).toUpperCase() || "AI",
      accent: "from-cyan-300 via-blue-400 to-violet-500",
      glow: "shadow-cyan-400/30",
    }
  );
}

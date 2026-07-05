export interface TYPE_PROVIDER {
  id?: string;
  name?: string;
  defaultModel?: string;
  streaming?: boolean;
  responseContentPath?: string;
  isCustom?: boolean;
  curl: string;
}

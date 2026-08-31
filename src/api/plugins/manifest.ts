/** Plugin manifest — contents of plugin.json. */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  /** Entry file relative to the plugin folder. */
  main: string;
  author?: string;
  permissions?: string[];
}

export interface PluginRecord {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  baseUrl: string;
  manifest: PluginManifest;
}

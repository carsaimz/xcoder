/**
 * Boot facade consumed by src/main.ts.
 */
import { pluginsManager } from './manager';

export const pluginManager = {
  loadEnabled: () => pluginsManager.loadEnabled(),
  mountPages: () => pluginsManager.mountPages()
};

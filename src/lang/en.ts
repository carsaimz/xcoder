/** English (source of truth) locale. All other locales fall back to these keys. */
export default {
  // general
  'ok': 'OK',
  'cancel': 'Cancel',
  'save': 'Save',
  'close': 'Close',
  'delete': 'Delete',
  'confirm': 'Confirm',
  'name': 'Name',
  'rename': 'Rename',
  'download': 'Download',
  'apply': 'Apply',
  'none': 'None',
  'error': 'Error',
  'success': 'Success',
  'loading': 'Loading…',
  'empty': 'Nothing here yet',

  // header
  'header.menu': 'Menu',
  'header.palette': 'Command palette',
  'header.quickOpen': 'Quick open file',
  'header.terminal': 'Terminal',
  'header.agent': 'AI agent',
  'header.settings': 'Settings',
  'header.plugins': 'Plugins',
  'header.save': 'Save file',

  // file tree
  'tree.empty': 'No files yet. Create one to start.',
  'tree.newFile': 'New file',
  'tree.newFolder': 'New folder',
  'tree.refresh': 'Refresh',
  'tree.rename': 'Rename',
  'tree.deleteConfirm': 'Delete {path}?',
  'tree.rootLabel': 'Workspace',

  // tabs & editor
  'editor.untitled': 'untitled',
  'editor.format': 'Format document',
  'editor.formatOk': 'Formatted {path}',
  'editor.formatSkip': 'No formatter for {ext} files',
  'editor.quickOpenHint': 'Type to search workspace files…',
  'editor.saved': 'Saved {path}',
  'editor.saveFailed': 'Failed to save {path}',
  'editor.openFailed': 'Cannot open {path}: {reason}',

  // terminal
  'terminal.title': 'Terminal',
  'terminal.hint': 'Type help for available commands',
  'terminal.clear': 'Clear',

  // command palette
  'palette.placeholder': 'Type a command…',
  'palette.noResults': 'No matching commands',

  // settings
  'settings.title': 'Settings',
  'settings.general': 'General',
  'settings.editor': 'Editor',
  'settings.ai': 'AI providers',
  'settings.agent': 'Agent',
  'settings.theme': 'Theme',
  'settings.locale': 'Language',
  'settings.fontSize': 'Font size',
  'settings.tabSize': 'Tab size',
  'settings.wordWrap': 'Word wrap',
  'settings.lineNumbers': 'Line numbers',
  'settings.autoSave': 'Auto save',
  'settings.autoSaveDelay': 'Auto save delay (ms)',
  'settings.saved': 'Settings saved',

  // AI providers
  'providers.title': 'AI providers',
  'providers.add': 'Add provider',
  'providers.group': 'Group',
  'providers.group.free': 'Free',
  'providers.group.freemium': 'Paid with free tier',
  'providers.group.premium': 'Premium (enterprise)',
  'providers.preset': 'Preset',
  'providers.custom': 'Custom (OpenAI-compatible)',
  'providers.apiKey': 'API key',
  'providers.baseUrl': 'Base URL',
  'providers.model': 'Model',
  'providers.apiStyle': 'API style',
  'providers.active': 'Active',
  'providers.setActive': 'Use this provider',
  'providers.test': 'Test connection',
  'providers.testOk': 'Connected: {models}',
  'providers.testFail': 'Connection failed: {reason}',
  'providers.docs': 'Get API key',
  'providers.empty': 'No providers configured. Add one from a preset to enable the AI agent.',
  'providers.activeBadge': 'Active',
  'providers.deleteConfirm': 'Remove provider "{label}"?',
  'providers.profileLabel': '{preset} profile',
  'providers.keyMissing': 'No API key set — the agent will fail until you add one.',

  // agent
  'agent.title': 'AI Agent',
  'agent.placeholder': 'Describe a task, e.g. "create utils/date.ts with a formatDate helper"',
  'agent.run': 'Run',
  'agent.stop': 'Stop',
  'agent.newChat': 'New chat',
  'agent.thinking': 'Thinking…',
  'agent.working': 'Working…',
  'agent.mode': 'Mode',
  'agent.mode.main': 'Main agent',
  'agent.mode.coder': 'Subagent: coder',
  'agent.mode.analyzer': 'Subagent: analyzer',
  'agent.mode.ops': 'Subagent: ops',
  'agent.toolCall': 'Tool call',
  'agent.toolDenied': 'Denied by user',
  'agent.permissionTitle': 'Agent permission',
  'agent.permissionMsg': 'Agent wants to run {tool} — {summary}',
  'agent.allow': 'Allow',
  'agent.allowAll': 'Always allow',
  'agent.deny': 'Deny',
  'agent.done': 'Done ({steps} steps)',
  'agent.failed': 'Agent failed: {reason}',
  'agent.noProvider': 'No AI provider configured. Open Settings → AI providers.',
  'agent.maxSteps': 'Stopped after {steps} steps — increase the limit in settings if needed.',
  'agent.cleared': 'Conversation cleared',

  // plugins
  'plugins.title': 'Plugins',
  'plugins.install': 'Install from .zip',
  'plugins.installed': 'Installed',
  'plugins.empty': 'No plugins installed.',
  'plugins.invalid': 'Invalid plugin package: {reason}',
  'plugins.installedOk': 'Plugin "{name}" installed',
  'plugins.uninstalledOk': 'Plugin "{name}" removed',
  'plugins.enable': 'Enabled',
  'plugins.uninstall': 'Uninstall',
  'plugins.invalidPluginJson': 'missing or malformed plugin.json',

  // dialogs
  'dialog.alertTitle': 'XCoder',
  'dialog.confirmTitle': 'Please confirm',
  'dialog.promptTitle': 'Input',
  'dialog.selectTitle': 'Select',

  // workspace
  'ws.newFilePrompt': 'New file path',
  'ws.newFolderPrompt': 'New folder path',
  'ws.fileExists': 'A file named {path} already exists',

  // git
  'git.notRepo': '{dir} is not a git repository — run git init first',
} as const;

export type LocaleKey = keyof typeof import('./en').default;

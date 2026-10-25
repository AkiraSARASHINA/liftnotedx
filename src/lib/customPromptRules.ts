import { triggerAutoUpload } from './syncManager';

const STORAGE_KEY = 'custom_prompt_rules';
const STORAGE_UPDATED_AT_KEY = 'custom_prompt_rules_updated_at';
const EVENT_NAME = 'custom_prompt_rules_updated';

type RulesChangeListener = (rules: string) => void;
const listeners = new Set<RulesChangeListener>();

/**
 * 現在保存されている独自追加ルールを取得
 */
export const getCustomPromptRules = (): string => {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

/**
 * 独自追加ルールの最終更新日時を取得
 */
export const getCustomPromptRulesUpdatedAt = (): string => {
  try {
    return localStorage.getItem(STORAGE_UPDATED_AT_KEY) || '';
  } catch {
    return '';
  }
};

/**
 * 独自追加ルールを保存し、クラウド同期（自動アップロード）をトリガー
 */
export const saveCustomPromptRules = (rules: string, notifySync = true): void => {
  try {
    const trimmed = rules;
    localStorage.setItem(STORAGE_KEY, trimmed);
    const now = new Date().toISOString();
    localStorage.setItem(STORAGE_UPDATED_AT_KEY, now);

    // リスナーに通知
    listeners.forEach(l => l(trimmed));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: trimmed }));

    // クラウド同期をトリガー
    if (notifySync) {
      triggerAutoUpload();
    }
  } catch (err) {
    console.error('Failed to save custom prompt rules:', err);
  }
};

/**
 * 独自追加ルールの変更を購読
 */
export const addCustomPromptRulesListener = (listener: RulesChangeListener): (() => void) => {
  listeners.add(listener);

  const handleCustomEvent = (e: Event) => {
    const customEvent = e as CustomEvent<string>;
    listener(customEvent.detail ?? getCustomPromptRules());
  };

  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      listener(e.newValue || '');
    }
  };

  window.addEventListener(EVENT_NAME, handleCustomEvent);
  window.addEventListener('storage', handleStorageEvent);

  return () => {
    listeners.delete(listener);
    window.removeEventListener(EVENT_NAME, handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
  };
};

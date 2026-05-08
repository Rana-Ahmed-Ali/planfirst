/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ApiKeys {
  gemini?: string;
  openrouter?: string;
}

const STORAGE_KEY = "planfirst_api_keys";

export function getApiKeys(): ApiKeys {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

export function saveApiKeys(keys: ApiKeys) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function clearApiKeys() {
  localStorage.removeItem(STORAGE_KEY);
}

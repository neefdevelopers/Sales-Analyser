// src/hooks/useSessionState.js
import { useState, useEffect } from 'react';

/**
 * Custom hook to synchronize state with sessionStorage,
 * preserving user filtration choices within the session across page switches and reloads.
 */
export function useSessionState(key, defaultValue) {
  const [state, setState] = useState(() => {
    try {
      const stored = sessionStorage.getItem(key);
      if (stored !== null) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn(`Error reading sessionStorage for key "${key}":`, e);
    }
    return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
  });

  useEffect(() => {
    try {
      if (state === undefined) {
        sessionStorage.removeItem(key);
      } else {
        sessionStorage.setItem(key, JSON.stringify(state));
      }
    } catch (e) {
      console.warn(`Error saving sessionStorage for key "${key}":`, e);
    }
  }, [key, state]);

  return [state, setState];
}

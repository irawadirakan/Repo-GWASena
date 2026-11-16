import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { useAuthStore } from '../store/useAuthStore.js';
import { useAnalysisStore } from '../store/useAnalysisStore.js';

// Polyfill DOM APIs missing in jsdom
if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
  }

  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  }
  if (!window.URL.revokeObjectURL) {
    window.URL.revokeObjectURL = vi.fn();
  }

  if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  useAnalysisStore.getState().reset();
  useAuthStore.setState({
    token: null,
    user: null,
    isAuthenticated: false,
    isLoading: false,
    isInitialized: true,
    error: null,
  });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

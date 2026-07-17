/**
 * Vitest setup file for frontend tests
 * Provides jsdom localStorage mock and DOM matchers
 */
import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock localStorage for jsdom environment
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});
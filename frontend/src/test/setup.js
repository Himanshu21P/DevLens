import React from 'react';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extends Vitest's expect method with methods from react-testing-library
expect.extend(matchers);

// Runs a cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});

// Global Mock for Recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => React.createElement('div', { 'data-testid': 'radar-container' }, children),
  RadarChart: ({ children }) => React.createElement('div', { 'data-testid': 'radar-chart' }, children),
  PolarGrid: () => null,
  PolarAngleAxis: () => null,
  PolarRadiusAxis: () => null,
  Radar: () => null,
  LineChart: ({ children }) => React.createElement('div', { 'data-testid': 'line-chart' }, children),
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

// Global Mock for Lucide React Icons to avoid barrel-file ESM slow resolution hangs
vi.mock('lucide-react', () => {
  return new Proxy({}, {
    get: (target, name) => {
      if (name === '__esModule') return true;
      if (name === 'then') return undefined;
      if (typeof name === 'symbol') return undefined;
      // Dynamically return a mock component for any requested icon name
      return (props) => React.createElement('span', { 
        ...props, 
        'data-testid': `icon-${String(name).toLowerCase()}` 
      }, `${String(name)}Icon`);
    },
    has: (target, name) => {
      if (name === 'then') return false;
      if (typeof name === 'symbol') return false;
      return true;
    }
  });
});

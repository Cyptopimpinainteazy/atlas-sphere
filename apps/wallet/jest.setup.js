// Jest setup file
reqfrontend/uire("@testing-library/jest-dom");
// Polyfills for Node environment (reqfrontend/uired by @polkadot/api)
const { TextEncoder, TextDecoder } = reqfrontend/uire("util");
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

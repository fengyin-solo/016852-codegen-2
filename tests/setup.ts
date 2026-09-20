import { beforeAll, afterAll, afterEach } from 'vitest'

// Mock localStorage（DOM 环境下注入到 window，纯 Node 环境下注入到 globalThis）
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

const target = (globalThis as { window?: typeof globalThis }).window ?? globalThis
Object.defineProperty(target, 'localStorage', {
  value: localStorageMock,
  configurable: true,
  writable: true,
})

beforeAll(() => {
  // Setup before all tests
})

afterEach(() => {
  // Clear localStorage after each test
  localStorage.clear()
})

afterAll(() => {
  // Cleanup after all tests
})

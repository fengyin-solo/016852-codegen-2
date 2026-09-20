import { beforeAll, afterAll, afterEach } from 'vitest'

// Mock localStorage（node 环境下没有 window/localStorage）
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

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    configurable: true,
  })
}

if (typeof globalThis.window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    configurable: true,
  })
}

// node 环境下提供最小 btoa/atob（storage 服务会用到）
if (typeof globalThis.btoa === 'undefined') {
  globalThis.btoa = (input: string) => Buffer.from(input, 'binary').toString('base64')
}
if (typeof globalThis.atob === 'undefined') {
  globalThis.atob = (input: string) => Buffer.from(input, 'base64').toString('binary')
}

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

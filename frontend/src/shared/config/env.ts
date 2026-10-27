/** Typed access to build-time environment. Read env only through this module. */
export const env = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api',
  useMocks: import.meta.env.VITE_USE_MOCKS === 'true',
  /** Show the sample-account sign-in buttons (mock mode, or a seeded staging API). */
  showDemo: import.meta.env.VITE_USE_MOCKS === 'true' || import.meta.env.VITE_SHOW_DEMO === 'true',
  mockLatencyMs: Number(import.meta.env.VITE_MOCK_LATENCY_MS ?? 450),
  isDev: import.meta.env.DEV,
  isTest: import.meta.env.MODE === 'test',
} as const;

declare global {
  interface Window {
    eeInfo?: {
      auth?: {
        login: (username: string, password: string, opts?: { forceWindow?: boolean; saveCredentials?: boolean }) => Promise<{ success: boolean; error?: string; data?: unknown }>;
        loginWithSavedCredentials?: (opts?: { forceWindow?: boolean }) => Promise<{ success: boolean; error?: string; data?: unknown }>;
        logout: () => Promise<{ ok: boolean }>;
        getStatus: () => Promise<{ loggedIn: boolean }>;
        hasCredentials: () => Promise<boolean>;
        clearCredentials: () => Promise<boolean>;
        openLoginInBrowser?: () => Promise<{ ok: boolean }>;
        getCookiesForCrawler?: () => Promise<{ cookieHeader: string | null }>;
      };
      storage?: {
        getDataPath: () => Promise<{ dataPath: string | null; effectivePath: string; defaultPath: string }>;
        setDataPath: (path: string | null) => Promise<{ ok: boolean }>;
        selectFolder: () => Promise<{ path: string | null }>;
      };
      crawler?: Record<string, (...args: unknown[]) => Promise<unknown>>;
      app?: { restart: () => Promise<{ ok: boolean }> };
      shell?: { openExternal: (url: string) => Promise<{ ok: boolean }> };
      llm?: { chat: (opts: unknown) => Promise<unknown> };
      agent?: Record<string, (...args: unknown[]) => Promise<unknown>>;
      courseSelection?: {
        fetchTrainingPlan?: () => Promise<{ success: boolean; html?: string; error?: string }>;
        getData?: () => Promise<unknown>;
        setData?: (data: unknown) => Promise<{ ok: boolean }>;
        getDataPath?: () => Promise<string>;
        loadFromHtmlFile?: () => Promise<{ success: boolean; html?: string; error?: string }>;
        loadFromFullHtmlFile?: () => Promise<{ success: boolean; html?: string; error?: string }>;
        onLog?: (cb: (msg: string) => void) => () => void;
      };
    };
  }
}

export {};

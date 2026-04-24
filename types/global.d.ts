export {};

declare global {
  interface Window {
    api?: {
      platform: NodeJS.Platform;
      settings: {
        get: (key: string) => Promise<unknown>;
        set: (key: string, value: unknown) => Promise<boolean>;
        has: (key: string) => Promise<boolean>;
      };
    };
  }
}

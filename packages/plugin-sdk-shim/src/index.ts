/** Re-exports the worker-side @paperclipai/plugin-sdk surface that op-omega
 *  plugins (onboarding, tier-router, flywheel-kernel) import. By routing
 *  through this shim, future SDK substitutions (e.g. wavex-native plugin
 *  host) only need to land in one place. */
export * from "@paperclipai/plugin-sdk";

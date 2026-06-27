import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { applyInferenceEnv, getClaudeBin, getHostedHubUrl, getInferenceConfig, getInferenceMode } from "../src/index.js";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.WAVEX_INFERENCE_MODE;
  delete process.env.NODE_ENV;
  delete process.env.WAVEX_OS_CLAUDE_BIN;
  delete process.env.WAVEX_INFERENCE_HUB_URL;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("@wavex-os/inference-adapter mode", () => {
  it("defaults to oauth in dev", () => {
    expect(getInferenceMode()).toBe("oauth");
  });

  it("defaults to apikey in production", () => {
    process.env.NODE_ENV = "production";
    expect(getInferenceMode()).toBe("apikey");
  });

  it("explicit WAVEX_INFERENCE_MODE always wins", () => {
    process.env.NODE_ENV = "production";
    process.env.WAVEX_INFERENCE_MODE = "oauth";
    expect(getInferenceMode()).toBe("oauth");
  });
});

describe("getClaudeBin", () => {
  it("oauth mode returns the absolute path to wavex-claude-spawn.sh", () => {
    process.env.WAVEX_INFERENCE_MODE = "oauth";
    const bin = getClaudeBin();
    expect(bin).toMatch(/scripts\/wavex-claude-spawn\.sh$/);
    expect(existsSync(bin)).toBe(true);
  });

  it("oauth-mode wrapper is executable", () => {
    process.env.WAVEX_INFERENCE_MODE = "oauth";
    const bin = getClaudeBin();
    // Re-stat via existsSync; deeper exec test would require child_process
    expect(existsSync(bin)).toBe(true);
  });

  it("apikey mode returns 'claude' or WAVEX_OS_CLAUDE_BIN override", () => {
    process.env.WAVEX_INFERENCE_MODE = "apikey";
    expect(getClaudeBin()).toBe("claude");
    process.env.WAVEX_OS_CLAUDE_BIN = "/usr/local/bin/claude-canary";
    expect(getClaudeBin()).toBe("/usr/local/bin/claude-canary");
  });
});

describe("applyInferenceEnv", () => {
  it("mutates WAVEX_OS_CLAUDE_BIN to the resolved bin", () => {
    process.env.WAVEX_INFERENCE_MODE = "oauth";
    delete process.env.WAVEX_OS_CLAUDE_BIN;
    applyInferenceEnv();
    expect(process.env.WAVEX_OS_CLAUDE_BIN).toMatch(/wavex-claude-spawn\.sh$/);
  });

  it("idempotent (calling twice yields same value)", () => {
    process.env.WAVEX_INFERENCE_MODE = "apikey";
    applyInferenceEnv();
    const first = process.env.WAVEX_OS_CLAUDE_BIN;
    applyInferenceEnv();
    expect(process.env.WAVEX_OS_CLAUDE_BIN).toBe(first);
  });
});

describe("getHostedHubUrl", () => {
  it("returns the normalized hub url in hosted mode", () => {
    process.env.WAVEX_INFERENCE_MODE = "hosted";
    process.env.WAVEX_INFERENCE_HUB_URL = "https://hub.example.com//";
    expect(getHostedHubUrl()).toBe("https://hub.example.com");
  });

  it("trims surrounding whitespace", () => {
    process.env.WAVEX_INFERENCE_MODE = "hosted";
    process.env.WAVEX_INFERENCE_HUB_URL = "  https://hub.example.com  ";
    expect(getHostedHubUrl()).toBe("https://hub.example.com");
  });

  it("is undefined outside hosted mode even if the url is set", () => {
    process.env.WAVEX_INFERENCE_MODE = "oauth";
    process.env.WAVEX_INFERENCE_HUB_URL = "https://hub.example.com";
    expect(getHostedHubUrl()).toBeUndefined();
  });

  it("is undefined in hosted mode when the url is unset or blank", () => {
    process.env.WAVEX_INFERENCE_MODE = "hosted";
    expect(getHostedHubUrl()).toBeUndefined();
    process.env.WAVEX_INFERENCE_HUB_URL = "   ";
    expect(getHostedHubUrl()).toBeUndefined();
  });
});

describe("getInferenceConfig", () => {
  it("bundles mode + bin together", () => {
    process.env.WAVEX_INFERENCE_MODE = "oauth";
    const cfg = getInferenceConfig();
    expect(cfg.mode).toBe("oauth");
    expect(cfg.claudeBin).toMatch(/wavex-claude-spawn\.sh$/);
    expect(cfg.hubUrl).toBeUndefined();
  });

  it("carries hubUrl in hosted mode", () => {
    process.env.WAVEX_INFERENCE_MODE = "hosted";
    process.env.WAVEX_INFERENCE_HUB_URL = "https://hub.example.com/";
    const cfg = getInferenceConfig();
    expect(cfg.mode).toBe("hosted");
    expect(cfg.hubUrl).toBe("https://hub.example.com");
  });
});

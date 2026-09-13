import { aiConfig } from '@/config/ai';

import { defaultModelFor } from './catalog';
import { ProviderError, isRetryableStatus } from './errors';
import type { Capability, ProjectModelConfig, ProviderAdapter, ProviderContext, ProviderRequest, ProviderResult } from './types';

const CAPABILITY_CONFIG_KEY: Record<Capability, keyof ProjectModelConfig> = {
  'llm-text': 'llmText',
  'text-to-image': 'textToImage',
  'image-to-image': 'imageToImage',
  'text-to-video': 'textToVideo',
  'image-to-video': 'imageToVideo',
  tts: 'tts',
  music: 'music',
  'video-assembly': 'videoAssembly',
};

export interface Selection {
  adapter: ProviderAdapter;
  provider: string;
  model: string;
  /** Which of the project owner's (possibly several) saved keys for `provider` to use. */
  apiKeyId?: string;
}

export interface SelectOptions {
  project?: ProjectModelConfig;
  override?: { provider: string; model: string; apiKeyId?: string };
}

export interface RunOptions extends SelectOptions {
  /** Resolves + decrypts the stored ApiKey for a provider (server-only). Not needed for local adapters (e.g. ffmpeg). */
  resolveApiKey?: (provider: string, apiKeyId?: string) => Promise<string>;
  signal?: AbortSignal;
}

class ProviderRegistry {
  private adaptersByCapability = new Map<Capability, ProviderAdapter[]>();
  private adaptersById = new Map<string, ProviderAdapter>();

  register(adapter: ProviderAdapter): void {
    this.adaptersById.set(adapter.id, adapter);
    for (const capability of adapter.capabilities) {
      const list = this.adaptersByCapability.get(capability) ?? [];
      list.push(adapter);
      this.adaptersByCapability.set(capability, list);
    }
  }

  reset(): void {
    this.adaptersByCapability.clear();
    this.adaptersById.clear();
  }

  private candidates(capability: Capability): ProviderAdapter[] {
    const list = this.adaptersByCapability.get(capability);
    if (!list?.length) throw new Error(`No provider adapter registered for capability "${capability}"`);
    return list;
  }

  /** Precedence: explicit override → project.modelConfig → aiConfig.defaults. */
  select(capability: Capability, opts: SelectOptions = {}): Selection {
    const configKey = CAPABILITY_CONFIG_KEY[capability];
    const target: { provider: string; model: string; apiKeyId?: string } | undefined =
      opts.override ?? opts.project?.[configKey] ?? aiConfig.defaults[configKey];
    if (!target) throw new Error(`No default provider configured for capability "${capability}"`);

    const candidates = this.candidates(capability);
    const adapter = candidates.find((a) => a.id === target.provider);
    if (!adapter) {
      throw new Error(`Provider "${target.provider}" is not registered for capability "${capability}"`);
    }
    return { adapter, provider: adapter.id, model: target.model, apiKeyId: target.apiKeyId };
  }

  /** Runs the selected provider; falls back to the next registered adapter for the capability on a retryable failure. */
  async run(capability: Capability, req: ProviderRequest, opts: RunOptions = {}): Promise<ProviderResult> {
    const primary = this.select(capability, opts);
    const candidates = this.candidates(capability);
    const fallbacks: Selection[] = candidates
      .filter((adapter) => adapter.id !== primary.provider)
      .map((adapter) => ({ adapter, provider: adapter.id, model: defaultModelFor(adapter.id, capability) ?? '' }))
      .filter((selection) => selection.model);
    const ordered = [primary, ...fallbacks];

    let lastError: unknown;
    for (const selection of ordered) {
      try {
        const apiKey = (await opts.resolveApiKey?.(selection.provider, selection.apiKeyId)) ?? '';
        const ctx: ProviderContext = { apiKey, model: selection.model, signal: opts.signal };
        return await selection.adapter.run(req, ctx);
      } catch (err) {
        lastError = err;
        const retryable = err instanceof ProviderError ? err.retryable : true;
        if (!retryable) break;
      }
    }
    // The bare "All providers exhausted" is unusable on its own: it names neither the model that
    // was tried nor why it failed, and the *only* interesting failure is usually the primary's —
    // the fallbacks typically die on a missing credential the user never configured. Carry the
    // last message into the text so the surface that renders it has something actionable.
    const detail = lastError instanceof Error ? lastError.message : String(lastError ?? 'no error recorded');
    throw new ProviderError(
      `All providers exhausted for capability "${capability}" (tried ${ordered
        .map((s) => `${s.provider}:${s.model}`)
        .join(', ')}) — last error: ${detail}`,
      { provider: primary.provider, retryable: false, cause: lastError },
    );
  }
}

export const providerRegistry = new ProviderRegistry();

export { isRetryableStatus, ProviderError };

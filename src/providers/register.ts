import { bridgeSpecs } from '@/config/bridges';

import { anthropicAdapter } from './adapters/anthropic.adapter';
import { deepseekAdapter } from './adapters/deepseek.adapter';
import { elevenlabsAdapter } from './adapters/elevenlabs.adapter';
import { falAdapter } from './adapters/fal.adapter';
import { ffmpegAssemblyAdapter } from './adapters/ffmpeg-assembly.adapter';
import { googleAdapter } from './adapters/google.adapter';
import { higgsfieldAdapter } from './adapters/higgsfield.adapter';
import { openaiAdapter } from './adapters/openai.adapter';
import { replicateAdapter } from './adapters/replicate.adapter';
import { seedanceAdapter } from './adapters/seedance.adapter';
import { sumopodAdapter } from './adapters/sumopod.adapter';
import { wavespeedAdapter } from './adapters/wavespeed.adapter';
import { createBridgeAdapter } from './bridge/adapter';
import { parseBridgeSpecs } from './bridge/types';
import { providerRegistry } from './registry';

let registered = false;

/** Idempotent — safe to call from any entry point (Inngest function, Server Action, MCP server). */
export function registerProviders(): void {
  if (registered) return;
  registered = true;

  providerRegistry.register(anthropicAdapter);
  providerRegistry.register(openaiAdapter);
  providerRegistry.register(deepseekAdapter);
  providerRegistry.register(sumopodAdapter);
  providerRegistry.register(googleAdapter);
  providerRegistry.register(falAdapter);
  providerRegistry.register(replicateAdapter);
  providerRegistry.register(wavespeedAdapter);
  providerRegistry.register(higgsfieldAdapter);
  providerRegistry.register(seedanceAdapter);
  providerRegistry.register(elevenlabsAdapter);
  providerRegistry.register(ffmpegAssemblyAdapter);

  // Declarative vendors from `src/config/bridges.ts`. Registered last so a bridge is only ever a
  // fallback *after* the hand-written adapters, and parsed here rather than at import time: a
  // malformed spec must stop a pipeline run, not the page that renders the model dropdown.
  for (const spec of parseBridgeSpecs(bridgeSpecs)) {
    providerRegistry.register(createBridgeAdapter(spec));
  }
}

export { providerRegistry } from './registry';
export { providerCatalog, providersFor, defaultModelFor } from './catalog';
export { createBridgeAdapter } from './bridge/adapter';
export { parseBridgeSpecs } from './bridge/types';
export type { BridgeSpec, BridgeSpecInput } from './bridge/types';
export type { Capability, ProviderRequest, ProviderResult, AssetRef, ProjectModelConfig } from './types';

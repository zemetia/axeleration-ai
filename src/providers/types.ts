export type Capability =
  | 'llm-text'
  | 'text-to-image'
  | 'image-to-image'
  | 'text-to-video'
  | 'image-to-video'
  | 'tts'
  | 'music'
  | 'video-assembly';

export type AssetType = 'CHARACTER' | 'PERSON' | 'STYLE' | 'LOCATION' | 'MAP' | 'PROP' | 'AMBIENCE' | 'VOICE';

export interface AssetRef {
  handle: string;
  type: AssetType;
  refUrl?: string; // reference image/audio (local storage URL) — shipped to the vendor
  voiceId?: string; // for TTS
  description?: string;
}

export interface ProviderRequest {
  capability: Capability;
  prompt?: string; // already mention-rewritten, see T06
  negativePrompt?: string;
  referenceImages?: AssetRef[]; // auto-attached from @mentions
  voiceId?: string; // TTS
  durationSeconds?: number;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  resolution?: '720p' | '1080p' | '4K';
  seed?: number;
  input?: Record<string, unknown>; // capability-specific extras / assembly manifest
}

export interface ProviderOutput {
  url: string; // local storage URL — never a raw vendor URL or in-memory bytes
  kind: 'image' | 'video' | 'audio' | 'text';
  meta?: Record<string, unknown>;
}

export interface ProviderResult {
  outputs: ProviderOutput[];
  costEstimate?: number; // USD
  providerMeta: { provider: string; model: string; latencyMs: number };
}

export interface ProviderContext {
  apiKey: string; // decrypted from ApiKey at call time
  model: string; // resolved model id
  signal?: AbortSignal;
}

export interface ProviderAdapter {
  readonly id: string; // "fal" | "replicate" | "wavespeed" | "higgsfield" | "seedance" | "google" | ...
  readonly capabilities: Capability[];
  supports(model: string): boolean;
  run(req: ProviderRequest, ctx: ProviderContext): Promise<ProviderResult>;
}

/** Matches `Project.modelConfig` (Prisma Json) — per-capability provider/model/key override. */
export type ProjectModelConfig = Partial<
  Record<
    'llmText' | 'textToImage' | 'imageToImage' | 'textToVideo' | 'imageToVideo' | 'tts' | 'music' | 'videoAssembly',
    /** `apiKeyId` picks which of the user's (possibly several) saved keys for `provider` to use. */
    { provider: string; model: string; apiKeyId?: string }
  >
>;

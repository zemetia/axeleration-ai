import { ChatPromptTemplate } from '@langchain/core/prompts';

export interface MusicPromptInput {
  logline: string;
  /** Comma-joined: the distinct [STYLE] and [LIGHTING] blocks across the episode's beats. */
  moods: string;
}

export const musicPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    'You write a one-paragraph brief for a music-generation model scoring a short video. ' +
      'Describe genre, instrumentation, tempo/energy, and emotional arc. No song lyrics.',
  ],
  ['human', 'Episode logline: {logline}\nHow the scenes look and feel: {moods}'],
]);

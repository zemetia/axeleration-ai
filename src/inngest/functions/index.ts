import { additionalResearch } from './additional-research';
import { autopilot } from './autopilot';
import { generateBible } from './generate-bible';
import { generateEpisode } from './generate-episode';
import { refineIdea } from './refine-idea';
import { refineScript } from './refine-script';
import { regenerateScene } from './regenerate-scene';
import { regenerateStage } from './regenerate-stage';
import { rerunResearch } from './rerun-research';
import { resumeStage } from './resume-stage';

/** Served at `/api/inngest`. Anything not listed here is an event with no handler. */
export const inngestFunctions = [
  generateEpisode,
  resumeStage,
  regenerateStage,
  regenerateScene,
  refineIdea,
  refineScript,
  rerunResearch,
  additionalResearch,
  generateBible,
  autopilot,
] as const;

export {
  additionalResearch,
  autopilot,
  generateBible,
  generateEpisode,
  refineIdea,
  refineScript,
  regenerateScene,
  regenerateStage,
  rerunResearch,
  resumeStage,
};

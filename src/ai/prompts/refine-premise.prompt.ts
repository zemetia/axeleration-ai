import { ChatPromptTemplate } from '@langchain/core/prompts';

export interface RefinePremisePromptInput {
  premise: string;
  projectType: string;
}

export const refinePremisePrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    'You sharpen one-paragraph story premises for a serialized {projectType} video series. ' +
      'Keep the author\'s core idea, characters and setting intact — tighten the language, add concrete ' +
      'sensory detail, and make the central conflict or hook explicit. One paragraph, three to five sentences. ' +
      'No preamble, no title, no quotes around the output — just the refined premise.',
  ],
  ['human', 'Premise to refine:\n{premise}'],
]);

import { ChatPromptTemplate } from '@langchain/core/prompts';
import { describe, expect, it } from 'vitest';

/**
 * Guards the one prompt failure that no other check in this repo can see.
 *
 * `ChatPromptTemplate.fromMessages()` parses its strings as f-strings **at module evaluation**, so a
 * literal `{` or `}` that is not doubled throws `Single '}' in template` the moment the module is
 * imported. That is a *runtime* error in a file with no runtime behaviour of its own: `tsc`, ESLint
 * and every existing unit test pass, because none of them import these modules. In production the
 * first thing to import one is `/api/inngest` (route → functions → nodes → prompts), which 500s the
 * endpoint — so every Inngest function silently stops running while the UI just keeps showing the
 * last error it recorded. That is exactly how it shipped once; see LEARN.md 2026-08-08.
 *
 * `import.meta.glob` rather than a hand-written list, deliberately: a prompt added later is covered
 * without anyone remembering to register it here, which is the only version of this test that stays
 * true.
 */
/*
 * Suppressed rather than typed via `vite/client`: `import.meta.glob` is a Vite/Vitest *transform*,
 * matched syntactically on this exact call shape — it cannot be destructured or aliased, and adding
 * `vite/client` to the project's types would advertise it to production code, where it does not
 * exist at runtime.
 */
// @ts-expect-error -- `import.meta.glob` is provided by the Vitest transform, not by ImportMeta.
const promptModules = import.meta.glob('./*.prompt.ts', { eager: true }) as Record<
  string,
  Record<string, unknown>
>;

function templatesIn(module: Record<string, unknown>): [string, ChatPromptTemplate][] {
  return Object.entries(module).filter(
    (entry): entry is [string, ChatPromptTemplate] => entry[1] instanceof ChatPromptTemplate,
  );
}

const cases = Object.entries(promptModules).flatMap(([path, module]) =>
  templatesIn(module).map(([name, template]) => ({ path, name, template })),
);

describe('prompt templates', () => {
  // A glob that silently matches nothing would make every assertion below vacuous.
  it('finds prompt templates to check', () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  it.each(cases)('$path → $name renders with its declared variables', async ({ template }) => {
    // Importing the module is already most of the test — an unescaped brace throws before this runs.
    // Formatting is the other half: it proves every `{placeholder}` is a real declared variable and
    // that no literal brace was doubled into a slot the caller is expected to fill.
    const values = Object.fromEntries(template.inputVariables.map((variable) => [variable, 'x']));
    const messages = await template.formatMessages(values);

    expect(messages.length).toBeGreaterThan(0);
    for (const message of messages) {
      expect(typeof message.content).toBe('string');
      expect(message.content as string).not.toContain('undefined');
    }
  });
});

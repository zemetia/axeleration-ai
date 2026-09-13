import type { SceneDialogueLineVO } from '@/types/value-objects';

/**
 * Dialogue as text, **scoped to one shot** — one line per row:
 *
 *     Nadia (whispered, out of breath): don't turn around
 *
 * The shot number is not written here because it is not typed here: a line is edited inside the
 * shot it is spoken over, so its position *is* the answer. That is the whole reason this moved —
 * a single list for the scene meant hand-maintaining "Shot 2" in prose and re-numbering every line
 * the moment a shot was inserted or removed above it.
 *
 * Both halves before the colon are optional, so `just say it` is a valid row and stores with no
 * speaker; that tolerance is the point, since the format has to survive being edited by hand. A
 * leading `Shot 3 —` is still *read* (pasted from the prompt, or from another shot's box) but the
 * shot it names is ignored in favour of the box the text is in.
 */
export function dialogueToText(dialogue: SceneDialogueLineVO[]): string {
  return dialogue
    .map((entry) => {
      const delivery = entry.delivery.trim() ? ` (${entry.delivery.trim()})` : '';
      return `${entry.speaker}${delivery}: ${entry.line}`;
    })
    .join('\n');
}

/** Leading `Shot 3 —` / `Shot 3:` / `Shot 3`, in any of the dashes the block format uses. */
const SHOT_PREFIX = /^shot\s*\d+\s*[—–\-|:.]?\s*/i;
/** A trailing `(whispered)` on the speaker half — how it is said, not what is said. */
const DELIVERY_SUFFIX = /\(([^)]*)\)\s*$/;

function parseRow(row: string, shot: number): SceneDialogueLineVO {
  let rest = row.replace(SHOT_PREFIX, '');

  let speaker = '';
  let delivery = '';
  const separator = rest.indexOf(':');
  if (separator !== -1) {
    let who = rest.slice(0, separator).trim();
    rest = rest.slice(separator + 1).trim();

    const deliveryMatch = DELIVERY_SUFFIX.exec(who);
    if (deliveryMatch?.[1] !== undefined) {
      delivery = deliveryMatch[1].trim();
      who = who.slice(0, deliveryMatch.index).trim();
    }
    speaker = who;
  }

  // The block format quotes the line; typing it back with the quotes must not store them twice.
  const line = rest.trim().replace(/^"([\s\S]*)"$/, '$1');
  return { shot, speaker, delivery, line };
}

export function textToDialogue(text: string, shot: number): SceneDialogueLineVO[] {
  return text
    .split('\n')
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => parseRow(row, shot))
    .filter((entry) => entry.line.length > 0);
}

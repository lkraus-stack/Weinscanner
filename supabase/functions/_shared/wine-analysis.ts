import { createVisionChatCompletion } from './ai.ts';
import { FULL_WINE_PROMPT, MINIMAL_WINE_PROMPT } from './prompts.ts';
import {
  extractJson,
  validateMinimalWineExtraction,
  validateWineExtraction,
  type ExtractWineRequest,
} from './wine-schema.ts';

type VisionPurpose = 'label' | 'adjudicator';

function parseVanteroJson(responseText: string, label: string) {
  try {
    return extractJson(responseText);
  } catch (error) {
    const preview = responseText.trim().slice(0, 300);
    const reason = error instanceof Error ? error.message : 'Unbekannter Fehler';

    throw new Error(`${label}: ${reason}. Antwort: ${preview}`);
  }
}

function buildFullUserText({ ocrText }: ExtractWineRequest) {
  if (ocrText) {
    return `Verbindliche Label-Evidenz aus der ersten Analyse:\n${ocrText}\n\nAnalysiere zusätzlich das Bild. Sichtbare Label-Evidenz darf durch Weinwissen nicht überschrieben werden.`;
  }

  return 'Analysiere das Wein-Etikett auf dem Bild.';
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

function fallbackPurposes(primaryPurpose: VisionPurpose): VisionPurpose[] {
  return primaryPurpose === 'label' ? ['label', 'adjudicator'] : [primaryPurpose];
}

export async function extractWineFull(
  payload: ExtractWineRequest,
  signal: AbortSignal
) {
  let lastError: unknown = null;

  for (const purpose of fallbackPurposes('label')) {
    try {
      const responseText = await createVisionChatCompletion({
        imageUrl: payload.imageUrl,
        maxTokens: 4000,
        purpose,
        secondaryImageUrl: payload.secondaryImageUrl,
        signal,
        system: FULL_WINE_PROMPT,
        userText: buildFullUserText(payload),
      });

      return validateWineExtraction(parseVanteroJson(responseText, 'Vollanalyse'));
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }

      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Vollanalyse fehlgeschlagen.');
}

export async function extractWineMinimal(
  imageUrl: string,
  signal: AbortSignal,
  secondaryImageUrl?: string,
  purpose: VisionPurpose = 'label'
) {
  let lastError: unknown = null;

  for (const currentPurpose of fallbackPurposes(purpose)) {
    try {
      const responseText = await createVisionChatCompletion({
        imageUrl,
        maxTokens: 2000,
        purpose: currentPurpose,
        secondaryImageUrl,
        signal,
        system: MINIMAL_WINE_PROMPT,
        userText:
          currentPurpose === 'adjudicator'
            ? 'Pruefe unabhaengig nur sichtbare Label-Evidenz. Achte besonders auf Cuvées, mehrere Rebsorten, Weinname und Verwechslungen innerhalb desselben Weinguts. Keine Weinwissen-Anreicherung.'
            : 'Extrahiere nur sichtbare Label-Evidenz. Keine Weinwissen-Anreicherung und keine Sortiments-Vermutung.',
      });

      return validateMinimalWineExtraction(
        parseVanteroJson(responseText, 'Minimalanalyse')
      );
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }

      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Minimalanalyse fehlgeschlagen.');
}

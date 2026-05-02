import { createVisionChatCompletion } from './ai.ts';
import { FULL_WINE_PROMPT, MINIMAL_WINE_PROMPT } from './prompts.ts';
import {
  extractJson,
  validateMinimalWineExtraction,
  validateWineExtraction,
  type ExtractWineRequest,
} from './wine-schema.ts';

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

export async function extractWineFull(
  payload: ExtractWineRequest,
  signal: AbortSignal
) {
  const responseText = await createVisionChatCompletion({
    imageUrl: payload.imageUrl,
    maxTokens: 4000,
    secondaryImageUrl: payload.secondaryImageUrl,
    signal,
    system: FULL_WINE_PROMPT,
    userText: buildFullUserText(payload),
  });

  return validateWineExtraction(parseVanteroJson(responseText, 'Vollanalyse'));
}

export async function extractWineMinimal(
  imageUrl: string,
  signal: AbortSignal,
  secondaryImageUrl?: string
) {
  const responseText = await createVisionChatCompletion({
    imageUrl,
    maxTokens: 2000,
    secondaryImageUrl,
    signal,
    system: MINIMAL_WINE_PROMPT,
    userText:
      'Extrahiere nur sichtbare Label-Evidenz. Keine Weinwissen-Anreicherung und keine Sortiments-Vermutung.',
  });

  return validateMinimalWineExtraction(
    parseVanteroJson(responseText, 'Minimalanalyse')
  );
}

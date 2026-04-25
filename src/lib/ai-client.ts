import { supabase } from '@/lib/supabase';
import type {
  ScanWineResult,
  WineExtraction,
} from '@/types/wine-extraction';

type ExtractWineErrorResponse = { error: string };

type EdgeFunctionResponse<T> = T | ExtractWineErrorResponse;

function isErrorResponse<T>(
  data: EdgeFunctionResponse<T>
): data is ExtractWineErrorResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof data.error === 'string'
  );
}

async function getFunctionErrorMessage(error: unknown): Promise<string> {
  if (
    error &&
    typeof error === 'object' &&
    'context' in error &&
    (error as { context?: unknown }).context instanceof Response
  ) {
    try {
      const errorBody = await (error as { context: Response }).context.json();

      if (
        errorBody &&
        typeof errorBody === 'object' &&
        'error' in errorBody &&
        typeof (errorBody as { error: unknown }).error === 'string'
      ) {
        return (errorBody as { error: string }).error;
      }
    } catch {
      return 'Etikett konnte nicht analysiert werden.';
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Etikett konnte nicht analysiert werden.';
}

export async function extractWineFromLabel(
  imageUrl: string,
  ocrText?: string
): Promise<WineExtraction> {
  const { data, error } = await supabase.functions.invoke<
    EdgeFunctionResponse<WineExtraction>
  >(
    'extract-wine',
    {
      body: {
        imageUrl,
        ocrText,
      },
    }
  );

  if (error) {
    throw new Error(await getFunctionErrorMessage(error));
  }

  if (!data) {
    throw new Error('Etikett konnte nicht analysiert werden.');
  }

  if (isErrorResponse(data)) {
    throw new Error(data.error);
  }

  return data;
}

export async function scanWineFromLabel(
  imageUrl: string
): Promise<ScanWineResult> {
  const { data, error } = await supabase.functions.invoke<
    EdgeFunctionResponse<ScanWineResult>
  >('scan-wine', {
    body: {
      imageUrl,
    },
  });

  if (error) {
    throw new Error(await getFunctionErrorMessage(error));
  }

  if (!data) {
    throw new Error('Etikett konnte nicht analysiert werden.');
  }

  if (isErrorResponse(data)) {
    throw new Error(data.error);
  }

  return data;
}

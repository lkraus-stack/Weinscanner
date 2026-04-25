import { supabase } from '@/lib/supabase';
import type {
  SaveScanPayload,
  SaveScanResult,
  ScanWineResult,
  WineExtraction,
} from '@/types/wine-extraction';

type ExtractWineErrorResponse = { error: string };

type EdgeFunctionResponse<T> = T | ExtractWineErrorResponse;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

      if (
        errorBody &&
        typeof errorBody === 'object' &&
        'message' in errorBody &&
        typeof (errorBody as { message: unknown }).message === 'string'
      ) {
        return (errorBody as { message: string }).message;
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

function getFunctionStatus(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'context' in error &&
    (error as { context?: unknown }).context instanceof Response
  ) {
    return (error as { context: Response }).context.status;
  }

  return null;
}

function isRetryableAnalysisError(error: unknown, message: string) {
  const status = getFunctionStatus(error);

  return (
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    message.includes('temporarily unavailable') ||
    message.includes('zu lange gedauert') ||
    message.includes('Request was aborted')
  );
}

async function invokeAnalysisFunction<T>(
  functionName: 'extract-wine' | 'scan-wine',
  body: Record<string, unknown>
): Promise<T> {
  let lastMessage = 'Etikett konnte nicht analysiert werden.';

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data, error } = await supabase.functions.invoke<
      EdgeFunctionResponse<T>
    >(functionName, { body });

    if (!error && data && !isErrorResponse(data)) {
      return data;
    }

    if (data && isErrorResponse(data)) {
      lastMessage = data.error;
    } else if (error) {
      lastMessage = await getFunctionErrorMessage(error);

      if (attempt < 3 && isRetryableAnalysisError(error, lastMessage)) {
        await sleep(1200 * (attempt + 1));
        continue;
      }
    }

    break;
  }

  throw new Error(lastMessage);
}

export async function extractWineFromLabel(
  imageUrl: string,
  ocrText?: string
): Promise<WineExtraction> {
  return invokeAnalysisFunction<WineExtraction>('extract-wine', {
    imageUrl,
    ocrText,
  });
}

export async function scanWineFromLabel(
  imageUrl: string
): Promise<ScanWineResult> {
  return invokeAnalysisFunction<ScanWineResult>('scan-wine', {
    imageUrl,
  });
}

export async function saveScan(
  payload: SaveScanPayload
): Promise<SaveScanResult> {
  const { data, error } = await supabase.functions.invoke<
    EdgeFunctionResponse<SaveScanResult>
  >('save-scan', {
    body: payload,
  });

  if (error) {
    throw new Error(await getFunctionErrorMessage(error));
  }

  if (!data) {
    throw new Error('Wein konnte nicht gespeichert werden.');
  }

  if (isErrorResponse(data)) {
    throw new Error(data.error);
  }

  return data;
}

import type { ExtractWineRequest } from './types.ts';

export const TEST_PAYLOADS: Record<string, ExtractWineRequest> = {
  ottellaLugana: {
    imageUrl: 'https://example.com/ottella-le-creete-label.jpg',
    ocrText: 'Ottella Le Creete Lugana DOC 2023',
  },
};

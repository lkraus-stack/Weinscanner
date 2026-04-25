import { supabase } from '@/lib/supabase';
import type { Tables, TablesUpdate } from '@/types/database';

export type InventoryRecord = Tables<'inventory_items'>;

export type InventoryFields = Pick<
  InventoryRecord,
  | 'notes'
  | 'purchase_price'
  | 'purchased_at'
  | 'quantity'
  | 'storage_location'
>;

type AddToInventoryParams = {
  notes?: string;
  purchasePrice?: number | null;
  purchasedAt?: string | null;
  quantity: number;
  storageLocation?: string;
  vintageId: string;
};

const MAX_QUANTITY = 999;

function normalizeOptionalText(value?: string | null) {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : null;
}

function normalizeOptionalPrice(value?: number | null) {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Bitte gib einen gültigen Kaufpreis ein.');
  }

  return Number(value.toFixed(2));
}

function normalizeOptionalDate(value?: string | null) {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : null;
}

function assertQuantity(value: number, { allowZero }: { allowZero: boolean }) {
  const min = allowZero ? 0 : 1;

  if (!Number.isInteger(value) || value < min || value > MAX_QUANTITY) {
    throw new Error(
      allowZero
        ? 'Bitte gib eine Menge zwischen 0 und 999 ein.'
        : 'Bitte gib eine Menge zwischen 1 und 999 ein.'
    );
  }
}

function normalizeError(error: { message?: string }) {
  return new Error(error.message ?? 'Bestand konnte nicht gespeichert werden.');
}

function buildInventoryFields({
  notes,
  purchasePrice,
  purchasedAt,
  quantity,
  storageLocation,
}: AddToInventoryParams): InventoryFields {
  assertQuantity(quantity, { allowZero: false });

  return {
    notes: normalizeOptionalText(notes),
    purchase_price: normalizeOptionalPrice(purchasePrice),
    purchased_at: normalizeOptionalDate(purchasedAt),
    quantity,
    storage_location: normalizeOptionalText(storageLocation),
  };
}

export async function addToInventory({
  vintageId,
  ...params
}: AddToInventoryParams): Promise<InventoryRecord> {
  const { data, error } = await supabase
    .from('inventory_items')
    .insert({
      ...buildInventoryFields({ ...params, vintageId }),
      vintage_id: vintageId,
    })
    .select()
    .single();

  if (error) {
    throw normalizeError(error);
  }

  return data;
}

export async function updateInventoryItem(
  itemId: string,
  updates: Partial<InventoryFields>
): Promise<InventoryRecord> {
  const normalizedUpdates: TablesUpdate<'inventory_items'> = { ...updates };

  if (typeof normalizedUpdates.quantity === 'number') {
    assertQuantity(normalizedUpdates.quantity, { allowZero: true });
  }

  if ('notes' in normalizedUpdates) {
    normalizedUpdates.notes = normalizeOptionalText(
      normalizedUpdates.notes ?? undefined
    );
  }

  if ('storage_location' in normalizedUpdates) {
    normalizedUpdates.storage_location = normalizeOptionalText(
      normalizedUpdates.storage_location ?? undefined
    );
  }

  if ('purchased_at' in normalizedUpdates) {
    normalizedUpdates.purchased_at = normalizeOptionalDate(
      normalizedUpdates.purchased_at ?? undefined
    );
  }

  if ('purchase_price' in normalizedUpdates) {
    normalizedUpdates.purchase_price = normalizeOptionalPrice(
      normalizedUpdates.purchase_price ?? undefined
    );
  }

  const { data, error } = await supabase
    .from('inventory_items')
    .update(normalizedUpdates)
    .eq('id', itemId)
    .select()
    .single();

  if (error) {
    throw normalizeError(error);
  }

  return data;
}

export async function deleteInventoryItem(itemId: string): Promise<void> {
  const { error } = await supabase
    .from('inventory_items')
    .delete()
    .eq('id', itemId);

  if (error) {
    throw normalizeError(error);
  }
}

export async function decrementQuantity(
  itemId: string
): Promise<InventoryRecord> {
  const { data, error } = await supabase.rpc('decrement_inventory_quantity', {
    item_id: itemId,
  });

  if (error) {
    throw normalizeError(error);
  }

  return data as InventoryRecord;
}

export async function findInventoryMatches(
  vintageId: string
): Promise<InventoryRecord[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select()
    .eq('vintage_id', vintageId)
    .order('created_at', { ascending: true });

  if (error) {
    throw normalizeError(error);
  }

  return data ?? [];
}

export async function increaseInventoryQuantity({
  delta,
  itemId,
}: {
  delta: number;
  itemId: string;
}): Promise<InventoryRecord> {
  assertQuantity(delta, { allowZero: false });

  const { data: currentItem, error: fetchError } = await supabase
    .from('inventory_items')
    .select()
    .eq('id', itemId)
    .single();

  if (fetchError) {
    throw normalizeError(fetchError);
  }

  const currentQuantity = currentItem.quantity ?? 0;
  const nextQuantity = currentQuantity + delta;
  assertQuantity(nextQuantity, { allowZero: true });

  return updateInventoryItem(itemId, {
    quantity: nextQuantity,
  });
}

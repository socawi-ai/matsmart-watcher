// Stored state + what a check found → change events. Pure functions.

// The change between the stored product (undefined if never seen) and the
// same product as just found, or null when nothing worth telling changed.
function productChange(stored, found) {
  if (!stored) return found.inStock ? 'new' : null;
  if (!stored.inStock && found.inStock) return 'back_in_stock';
  if (stored.inStock && !found.inStock) return 'sold_out';
  if (!found.inStock) return null;
  if (found.price < stored.price) return 'price_drop';
  if (found.price > stored.price) return 'price_up';
  return null;
}

// Products that were in stock, that a watch found last time but no watch
// found now. Products of watches whose check failed this time are left
// alone: not finding them proves nothing.
//   stored:     Map id → stored product
//   linked:     Map watchId → product ids the watch found last time
//   found:      Set of product ids found now
//   failedIds:  Set of watch ids whose check failed
function vanishedProductIds(stored, linked, found, failedIds) {
  const unsure = new Set();
  for (const watchId of failedIds) {
    for (const id of linked.get(watchId) || []) unsure.add(id);
  }
  const vanished = new Set();
  for (const [watchId, ids] of linked) {
    if (failedIds.has(watchId)) continue;
    for (const id of ids) {
      if (!found.has(id) && !unsure.has(id) && stored.get(id).inStock) vanished.add(id);
    }
  }
  return [...vanished];
}

module.exports = { productChange, vanishedProductIds };

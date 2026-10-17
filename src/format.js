// How prices, stock, times and changes are written, in the web interface
// and in Discord.

const CHANGE_LABELS = {
  new: 'Ny',
  back_in_stock: 'Tillbaka i lager',
  sold_out: 'Slutsåld',
  price_drop: 'Prissänkning',
  price_up: 'Prishöjning'
};

// 24900 → '249 kr', 2490 → '24,90 kr'.
function kr(ore) {
  const kronor = (ore / 100).toLocaleString('sv-SE', {
    minimumFractionDigits: ore % 100 ? 2 : 0,
    maximumFractionDigits: 2
  });
  return `${kronor} kr`;
}

// Off the original price, in whole percent.
const discountPercent = (product) => Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);

// '249 kr' or '299 kr → 249 kr'.
const priceChange = (oldPrice, newPrice) =>
  oldPrice === null || oldPrice === newPrice ? kr(newPrice) : `${kr(oldPrice)} → ${kr(newPrice)}`;

// matsmart reports at most 101 in stock, meaning "more than 100".
function stockNote(product) {
  if (!product.inStock) return 'Slutsåld';
  return product.stock > 100 ? 'Över 100 kvar' : `${product.stock} kvar`;
}

const TIME = new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'short' });
const time = (iso) => TIME.format(new Date(iso));

module.exports = { CHANGE_LABELS, discountPercent, kr, priceChange, stockNote, time };

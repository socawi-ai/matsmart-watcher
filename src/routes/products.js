// What's in stock across all watches, sortable (?sort=discount|price|…).
const express = require('express');

const { SORTS, listInStockProducts } = require('../db/products');

const router = express.Router();

router.get('/', async (req, res) => {
  const sort = Object.hasOwn(SORTS, req.query.sort) ? req.query.sort : 'discount';
  res.render('products', { products: await listInStockProducts(sort), sort });
});

module.exports = router;

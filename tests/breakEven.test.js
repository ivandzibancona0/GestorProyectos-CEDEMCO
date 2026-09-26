import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBreakEven } from '../src/domain/breakEven.js';

test('calcula cantidad e ingreso de equilibrio para un producto', () => {
  const result = calculateBreakEven({ fixedCosts: 10_000, products: [{ name:'A', price:100, variableCost:60, salesMix:1 }] });
  assert.equal(result.weightedContribution, 40);
  assert.equal(result.equilibriumUnits, 250);
  assert.equal(result.equilibriumRevenue, 25_000);
  assert.equal(result.products[0].marginRatio, 0.4);
});

test('respeta la mezcla de venta para varios productos', () => {
  const result = calculateBreakEven({ fixedCosts: 8_000, products: [
    { name:'A', price:100, variableCost:50, salesMix:3 },
    { name:'B', price:200, variableCost:100, salesMix:1 },
  ] });
  assert.equal(result.weightedContribution, 62.5);
  assert.equal(result.equilibriumUnits, 128);
  assert.equal(result.products[0].equilibriumUnits, 96);
  assert.equal(result.products[1].equilibriumUnits, 32);
});

test('rechaza productos sin margen de contribución positivo', () => {
  assert.throws(() => calculateBreakEven({ fixedCosts:100, products:[{ name:'A', price:50, variableCost:50, salesMix:1 }] }), RangeError);
});

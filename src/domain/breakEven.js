export function calculateBreakEven({ fixedCosts, products }) {
  const totalMix = products.reduce((sum, product) => sum + product.salesMix, 0);
  const normalized = products.map(product => ({
    ...product,
    weight: product.salesMix / totalMix,
    contribution: product.price - product.variableCost,
    marginRatio: (product.price - product.variableCost) / product.price,
  }));
  if (normalized.some(product => product.contribution <= 0)) {
    throw new RangeError('El precio debe ser mayor que el costo variable de cada producto.');
  }
  const weightedContribution = normalized.reduce((sum, product) => sum + product.contribution * product.weight, 0);
  const weightedPrice = normalized.reduce((sum, product) => sum + product.price * product.weight, 0);
  const equilibriumUnits = fixedCosts / weightedContribution;
  const equilibriumRevenue = equilibriumUnits * weightedPrice;
  return {
    fixedCosts,
    weightedContribution,
    equilibriumUnits,
    equilibriumRevenue,
    products: normalized.map(product => ({
      ...product,
      equilibriumUnits: equilibriumUnits * product.weight,
      equilibriumRevenue: equilibriumUnits * product.weight * product.price,
    })),
  };
}

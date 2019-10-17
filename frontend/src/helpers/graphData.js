/**
 * Helper functions for working with graph data.
 */

/**
 * Helper method to get a specific percentile out of histogram graph data
 * where percentile is 0-100.
 */
export function getPercentileValue(graphData, percentile) {
  if (!graphData.percentiles) {
    return null;
  }
  const bin = graphData.percentiles.find(x => x.percentile === percentile);
  if (bin) {
    return bin.value;
  }
  return 0;
}

/**
 * Helper functions for working with graph data.
 */

/**
 * Helper method to get a specific percentile out of histogram graph data
 * where percentile is 0-100.
 */
export function getPercentileValue(histogram, percentile) {
  const bin = histogram.percentiles.find(x => x.percentile === percentile);
  if (bin) {
    return bin.value;
  } else {
    return 0;
  }
}
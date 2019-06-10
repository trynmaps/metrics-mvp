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
  } else {
    return 0;
  }
}

/**
 * Given a histogram bin value like "5-10", return "5".
 */
export function getBinMin(bin) {
  return bin.value.split("-")[0];
}

/**
 * Given a histogram bin value like "5-10", return "10".
 */
export function getBinMax(bin) {
  return bin.value.split("-")[1];
}
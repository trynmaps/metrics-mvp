/**
 * Helper functions for working with graph data.
 */

/* eslint import/prefer-default-export: "off" */

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

export function getOnTimePercent(scheduleAdherence) {
  return scheduleAdherence && scheduleAdherence.scheduledCount > 0
    ? (100 * scheduleAdherence.onTimeCount) / scheduleAdherence.scheduledCount
    : null;
}

export function getHistogramChartData(histogramData, totalCount) {
  return histogramData
    ? histogramData.map(bin => ({
        x0: bin.binStart,
        x: bin.binEnd,
        y0: 0,
        y: totalCount > 0 ? (100 * bin.count) / totalCount : bin.count,
        count: bin.count,
      }))
    : null;
}

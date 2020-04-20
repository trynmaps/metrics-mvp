import React from 'react';

import { VerticalRectSeries } from 'react-vis';
import SimpleChart from './SimpleChart';

/*
 * Renders a chart of vertical rectangles (for histograms).
 */
export default function SimpleVerticalRectChart(props) {
  return <SimpleChart {...props} component={VerticalRectSeries} />;
}

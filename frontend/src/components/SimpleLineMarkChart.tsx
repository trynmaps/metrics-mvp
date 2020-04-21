import React from 'react';
import { LineMarkSeries } from 'react-vis';
import SimpleChart from './SimpleChart';

/*
 * Renders a line chart with circles at each data point.
 */
export default function SimpleLineMarkChart(props) {
  return <SimpleChart {...props} component={LineMarkSeries} />;
}

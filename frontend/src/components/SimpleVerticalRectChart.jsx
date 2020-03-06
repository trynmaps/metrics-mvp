import React from 'react';

import { VerticalRectSeries } from 'react-vis';
import SimpleChart from './SimpleChart';

export default function SimpleVerticalRectChart(props) {
  return <SimpleChart {...props} component={VerticalRectSeries} />;
}

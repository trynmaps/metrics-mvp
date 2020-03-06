import React from 'react';

import { VerticalBarSeries } from 'react-vis';
import SimpleChart from './SimpleChart';

export default function SimpleVerticalBarChart(props) {
  return <SimpleChart {...props} component={VerticalBarSeries} />;
}

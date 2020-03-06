import React from 'react';

import { LineMarkSeries } from 'react-vis';
import SimpleChart from './SimpleChart';

export default function SimpleLineMarkChart(props) {
  return <SimpleChart {...props} component={LineMarkSeries} />;
}

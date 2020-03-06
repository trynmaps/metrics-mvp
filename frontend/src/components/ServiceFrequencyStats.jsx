import React from 'react';
import { connect } from 'react-redux';
import ServiceFrequencyByTimeChart from './ServiceFrequencyByTimeChart';
import ServiceFrequencyByDayChart from './ServiceFrequencyByDayChart';
import ServiceFrequencyHistogram from './ServiceFrequencyHistogram';
import ServiceFrequencyGapHistogram from './ServiceFrequencyGapHistogram';

function ServiceFrequencyStats(props) {
  const { graphParams } = props;

  if (
    !graphParams.directionId ||
    !graphParams.startStopId ||
    !graphParams.endStopId
  ) {
    return 'Select a direction, origin stop, and destination stop to see service frequency metrics.';
  }

  return (
    <>
      <ServiceFrequencyByDayChart />
      <ServiceFrequencyByTimeChart />
      <ServiceFrequencyHistogram />
      <ServiceFrequencyGapHistogram />
    </>
  );
}

const mapStateToProps = state => ({
  graphParams: state.graphParams,
});

export default connect(mapStateToProps)(ServiceFrequencyStats);

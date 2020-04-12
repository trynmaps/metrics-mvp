import React from 'react';
import { connect } from 'react-redux';
import OnTimePerformanceByTimeChart from './OnTimePerformanceByTimeChart';
import OnTimePerformanceByDayChart from './OnTimePerformanceByDayChart';
import OnTimePerformanceHistogram from './OnTimePerformanceHistogram';

function OnTimePerformanceStats(props) {
  const { graphParams } = props;

  if (
    !graphParams.directionId ||
    !graphParams.startStopId ||
    !graphParams.endStopId
  ) {
    return 'Select a direction, origin stop, and destination stop to see on-time performance metrics.';
  }

  return (
    <>
      <OnTimePerformanceByDayChart />
      <OnTimePerformanceByTimeChart />
      <OnTimePerformanceHistogram />
    </>
  );
}

const mapStateToProps = state => ({
  graphParams: state.graphParams,
});

export default connect(mapStateToProps)(OnTimePerformanceStats);

import React from 'react';
import { connect } from 'react-redux';
import TripTimesByTimeChart from './TripTimesByTimeChart';
import TripTimesByDayChart from './TripTimesByDayChart';
import TravelTimeChart from './TravelTimeChart';
import WaitTimesHistogram from './WaitTimesHistogram';
import TravelTimesHistogram from './TravelTimesHistogram';

function TripTimesStats(props) {
  const { graphParams } = props;

  if (!graphParams.directionId) {
    return <>Select a direction to see metrics about trip times.</>;
  }

  return (
    <>
      <TripTimesByTimeChart />
      <TripTimesByDayChart />
      <WaitTimesHistogram />
      <TravelTimesHistogram />
      <TravelTimeChart />
    </>
  );
}

const mapStateToProps = state => ({
  graphParams: state.graphParams,
});

export default connect(mapStateToProps)(TripTimesStats);

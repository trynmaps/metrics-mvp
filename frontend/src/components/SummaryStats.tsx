import React from 'react';
import { connect } from 'react-redux';
import RouteSummary from './RouteSummary';
import TripSummary from './TripSummary';

/*
 * Renders the Summary tab on the route screen.
 */
function SummaryStats(props) {
  const { graphParams } = props;
  const tripSelected = graphParams.startStopId && graphParams.endStopId;
  return tripSelected ? <TripSummary /> : <RouteSummary />;
}

const mapStateToProps = state => ({
  graphParams: state.graphParams,
});

export default connect(mapStateToProps)(SummaryStats);

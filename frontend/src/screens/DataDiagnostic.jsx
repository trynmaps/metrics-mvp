import React, { useEffect } from 'react';

import { connect } from 'react-redux';

import QuadrantChart from '../components/QuadrantChart';

import { fetchRoutes, handleGraphParams } from '../actions';

/**
 * Data diagnostic screen.  Plots a quadrant chart and travel across stops
 * for all routes.  Access via /dataDiagnostic.
 */
function DataDiagnostic(props) {
  const { graphParams, routes } = props;

  const myFetchRoutes = props.fetchRoutes;
  const myHandleGraphParams = props.handleGraphParams;

  useEffect(() => {
    myHandleGraphParams({});
    if (!routes) {
      myFetchRoutes();
    }
  }, [routes, myFetchRoutes, graphParams, myHandleGraphParams]); // like componentDidMount, this runs only on first render

  return <QuadrantChart />;
}

const mapStateToProps = state => ({
  routes: state.routes.data,
  graphParams: state.graphParams,
});

const mapDispatchToProps = dispatch => ({
  fetchRoutes: params => dispatch(fetchRoutes(params)),
  handleGraphParams: params => dispatch(handleGraphParams(params)),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(DataDiagnostic);

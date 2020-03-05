import React, { useEffect, Fragment } from 'react';
import Toolbar from '@material-ui/core/Toolbar';
import AppBar from '@material-ui/core/AppBar';

import { connect } from 'react-redux';

import { makeStyles } from '@material-ui/core/styles';
import { Agencies } from '../config';
import AppBarLogo from '../components/AppBarLogo';
import QuadrantChart from '../components/QuadrantChart';
import SidebarButton from '../components/SidebarButton';
import DateTimePanel from '../components/DateTimePanel';

import { fetchRoutes, handleGraphParams } from '../actions';

const useStyles = makeStyles({
  title: {
    flexGrow: 1,
  },
});

/**
 * Data diagnostic screen.  Plots a quadrant chart and travel across stops
 * for all routes.  Access via /dataDiagnostic.
 */
function DataDiagnostic(props) {
  const { graphParams, routes } = props;

  const agency = Agencies[0];
  const myFetchRoutes = props.fetchRoutes;
  const myHandleGraphParams = props.handleGraphParams;

  useEffect(() => {
    myHandleGraphParams({});
    if (!routes) {
      myFetchRoutes();
    }
  }, [routes, myFetchRoutes, graphParams, myHandleGraphParams]); // like componentDidMount, this runs only on first render

  const classes = useStyles();

  return (
    <Fragment>
      <AppBar position="relative">
        <Toolbar>
          <SidebarButton />
          <AppBarLogo />
          <div className={classes.title}>{agency.title}</div>
          <DateTimePanel dateRangeSupported />
        </Toolbar>
      </AppBar>
      Date: {graphParams.firstDateRange.date} Time:{' '}
      {graphParams.firstDateRange.startTime} -{' '}
      {graphParams.firstDateRange.endTime}
      <QuadrantChart />
    </Fragment>
  );
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

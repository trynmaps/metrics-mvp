import React, { useEffect } from 'react';

import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Grid from '@material-ui/core/Grid';

import { AppBar, Tab, Tabs, Box } from '@material-ui/core';

import { connect } from 'react-redux';
import MapStops from '../components/MapStops';

import ControlPanel from '../components/ControlPanel';
import RouteSummary from '../components/RouteSummary';
import TripSummary from '../components/TripSummary';
import TripTimesStats from '../components/TripTimesStats';
import ServiceFrequencyStats from '../components/ServiceFrequencyStats';
import OnTimePerformanceStats from '../components/OnTimePerformanceStats';
import MareyChart from '../components/MareyChart';

import { fetchRoutes } from '../actions';

const useStyles = makeStyles(theme => ({
  darkLinks: {
    color: theme.palette.primary.dark,
  },
  breadCrumbsWrapper: {
    padding: '0',
  },
}));

// tab values
const SUMMARY = 'summary';
const TRIP_TIMES = 'trip_times';
const SERVICE_FREQUENCY = 'service_frequency';
const ON_TIME_PERFORMANCE = 'otp';
const TRIP_CHART = 'trip_chart';

function RouteScreen(props) {
  const { graphParams, routes, tripMetricsError, tripMetricsLoading } = props;

  const [tabValue, setTabValue] = React.useState(SUMMARY);

  function handleTabChange(event, newValue) {
    setTabValue(newValue);
  }

  function a11yProps(myTabValue) {
    return {
      id: `simple-tab-${myTabValue}`,
      'aria-controls': `simple-tabpanel-${myTabValue}`,
    };
  }

  const myFetchRoutes = props.fetchRoutes;
  const agencyId = graphParams ? graphParams.agencyId : null;

  useEffect(() => {
    if (!routes && agencyId) {
      myFetchRoutes({ agencyId });
    }
  }, [agencyId, routes, myFetchRoutes]); // like componentDidMount, this runs only on first render

  const classes = useStyles();

  const tripSelected = graphParams.startStopId && graphParams.endStopId;

  return (
    <>
      <Paper className={classes.breadCrumbsWrapper}>
        <ControlPanel routes={routes} />
      </Paper>
      <AppBar position="static" color="default">
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="tab bar"
          variant="scrollable"
          scrollButtons="on"
        >
          <Tab
            style={{ minWidth: 72 }}
            label="Summary"
            value={SUMMARY}
            {...a11yProps(SUMMARY)}
          />
          <Tab
            style={{ minWidth: 72 }}
            label="Trip Times"
            value={TRIP_TIMES}
            {...a11yProps(TRIP_TIMES)}
          />
          <Tab
            style={{ minWidth: 72 }}
            label="Service Frequency"
            value={SERVICE_FREQUENCY}
            {...a11yProps(SERVICE_FREQUENCY)}
          />
          <Tab
            style={{ minWidth: 72 }}
            label="On-Time Performance"
            value={ON_TIME_PERFORMANCE}
            {...a11yProps(ON_TIME_PERFORMANCE)}
          />
          <Tab
            style={{ minWidth: 72 }}
            label="Trip Chart"
            value={TRIP_CHART}
            {...a11yProps(TRIP_CHART)}
          />
        </Tabs>
      </AppBar>
      <Grid container spacing={0}>
        <Grid item xs={12} md={6}>
          <Box p={2} style={{ overflowX: 'auto' }}>
            {/* control panel and map are full width for 1050px windows or smaller, else half width */}
            {tripMetricsLoading ? 'Loading...' : null}
            {tripMetricsError ? `Error: ${tripMetricsError}` : null}
            {!tripMetricsError && !tripMetricsLoading ? (
              <>
                {tabValue === SUMMARY && tripSelected ? <TripSummary /> : null}
                {tabValue === SUMMARY && !tripSelected ? (
                  <RouteSummary />
                ) : null}
                {tabValue === TRIP_TIMES ? <TripTimesStats /> : null}
                {tabValue === ON_TIME_PERFORMANCE ? (
                  <OnTimePerformanceStats />
                ) : null}
                {tabValue === SERVICE_FREQUENCY ? (
                  <ServiceFrequencyStats />
                ) : null}
                {tabValue === TRIP_CHART ? <MareyChart /> : null}
              </>
            ) : null}
          </Box>
        </Grid>
        <Grid item xs={12} md={6}>
          <MapStops />
        </Grid>
      </Grid>
    </>
  );
}

const mapStateToProps = state => ({
  routes: state.routes.data,
  graphParams: state.graphParams,
  tripMetricsError: state.tripMetrics.error,
  tripMetricsLoading: state.loading.TRIP_METRICS,
});

const mapDispatchToProps = dispatch => ({
  fetchRoutes: params => dispatch(fetchRoutes(params)),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(RouteScreen);

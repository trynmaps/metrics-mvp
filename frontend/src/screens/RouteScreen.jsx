import React, { useEffect } from 'react';
import { connect } from 'react-redux';

import { makeStyles } from '@material-ui/core/styles';
import { AppBar, Tab, Tabs, Box, Paper, Grid } from '@material-ui/core';
import MapStops from '../components/MapStops';
import ControlPanel from '../components/ControlPanel';
import SummaryStats from '../components/SummaryStats';
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

function RouteScreen(props) {
  const {
    graphParams,
    routes,
    tripMetricsError,
    tripMetricsLoading,
    routeMetricsError,
    routeMetricsLoading,
  } = props;

  const tabs = [
    {
      value: 'summary',
      label: 'Summary',
      component: SummaryStats,
    },
    {
      value: 'trip_times',
      label: 'Trip Times',
      component: TripTimesStats,
    },
    {
      value: 'service_freq',
      label: 'Service Frequency',
      component: ServiceFrequencyStats,
    },
    {
      value: 'otp',
      label: 'On-Time Performance',
      component: OnTimePerformanceStats,
    },
    {
      value: 'td_chart',
      label: 'Time-Distance Chart',
      component: MareyChart,
    },
  ];

  const [tabValue, setTabValue] = React.useState(tabs[0].value);

  function handleTabChange(event, newValue) {
    setTabValue(newValue);
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
  const loading = tripSelected ? tripMetricsLoading : routeMetricsLoading;
  const error = tripSelected ? tripMetricsError : routeMetricsError;

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
          scrollButtons="auto"
        >
          {tabs.map(tab => {
            return (
              <Tab
                key={tab.value}
                style={{ minWidth: 72 }}
                label={tab.label}
                value={tab.value}
                id={`simple-tab-${tab.value}`}
                aria-controls={`simple-tabpanel-${tab.value}`}
              />
            );
          })}
        </Tabs>
      </AppBar>
      <Grid container spacing={0}>
        <Grid item xs={12} md={6}>
          <Box p={2} style={{ overflowX: 'auto' }}>
            {/* control panel and map are full width for 1050px windows or smaller, else half width */}
            {loading ? 'Loading...' : null}
            {error ? `Error: ${error}` : null}
            {!error && !loading
              ? tabs.map(tab => {
                  const TabComponent = tab.component;
                  return tabValue === tab.value ? (
                    <TabComponent key={tab.value} />
                  ) : null;
                })
              : null}
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
  routeMetricsError: state.routeMetrics.error,
  routeMetricsLoading: state.loading.ROUTE_METRICS,
});

const mapDispatchToProps = dispatch => ({
  fetchRoutes: params => dispatch(fetchRoutes(params)),
});

export default connect(mapStateToProps, mapDispatchToProps)(RouteScreen);

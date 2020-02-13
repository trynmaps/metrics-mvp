import React, { Fragment, useEffect } from 'react';

import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Grid from '@material-ui/core/Grid';
import Toolbar from '@material-ui/core/Toolbar';
import AppBar from '@material-ui/core/AppBar';
import IconButton from '@material-ui/core/IconButton';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import Link, { NavLink } from 'redux-first-router-link';
import NavigateNextIcon from '@material-ui/icons/NavigateNext';
import Breadcrumbs from '@material-ui/core/Breadcrumbs';
import Typography from '@material-ui/core/Typography';

import { connect } from 'react-redux';
import Info from '../components/Info';
import MapStops from '../components/MapStops';
import DateTimePanel from '../components/DateTimePanel';
import Share from '../components/Share';
import { getAgency } from '../config';
import ControlPanel from '../components/ControlPanel';
import RouteSummary from '../components/RouteSummary';
import { fetchRoutes } from '../actions';

const useStyles = makeStyles(theme => ({
  breadCrumbStyling: {
    fontWeight: 'bold',
    textTransform: 'initial',
    display: 'inline',
  },
  darkLinks: {
    color: theme.palette.primary.dark,
  },
  breadCrumbsWrapper: {
    padding: '1%',
    paddingRight: '0',
  },
}));

function RouteScreen(props) {
  const {
    tripMetrics,
    tripMetricsLoading,
    tripMetricsError,
    graphParams,
    routes,
  } = props;

  const myFetchRoutes = props.fetchRoutes;
  const agencyId = graphParams ? graphParams.agencyId : null;

  useEffect(() => {
    if (!routes && agencyId) {
      myFetchRoutes({ agencyId });
    }
  }, [agencyId, routes, myFetchRoutes]); // like componentDidMount, this runs only on first render

  const agency = getAgency(agencyId);

  const backArrowStyle = { color: '#ffffff' };

  const breadCrumbs = (paths, classes) => {
    const { breadCrumbStyling, darkLinks } = classes;

    let link = {
      type: 'ROUTESCREEN',
      query: props.query,
    };
    const params = ['routeId', 'directionId', 'startStopId', 'endStopId'];
    const labels = (param, title) => {
      const specialLabels = {};
      specialLabels.startStopId = 'from ';
      specialLabels.endStopId = 'to ';
      return {
        label: title,
        specialLabel: specialLabels[param] ? specialLabels[param] : null,
      };
    };
    return paths
      .filter(path => {
        // return paths with non null values
        return !!path;
      })
      .map((path, index) => {
        const hasNextValue = paths[index + 1];
        const param = params[index];
        const payload = {};
        payload[param] = path.id;
        const updatedPayload = Object.assign({ ...link.payload }, payload);
        link = Object.assign({ ...link }, { payload: updatedPayload });
        const { label, specialLabel } = labels(param, path.title);
        return hasNextValue ? (
          <Typography
            variant="subtitle1"
            key={label}
            className={`${breadCrumbStyling} ${darkLinks}`}
          >
            {' '}
            {specialLabel}{' '}
            <Link to={link} className={`${breadCrumbStyling} ${darkLinks}`}>
              {' '}
              {label}{' '}
            </Link>{' '}
          </Typography>
        ) : (
          <Typography
            variant="subtitle1"
            key={label}
            className={breadCrumbStyling}
          >
            {' '}
            {specialLabel} {label}{' '}
          </Typography>
        );
      });
  };

  const selectedRoute =
    routes && graphParams && graphParams.routeId
      ? routes.find(
          route =>
            route.id === graphParams.routeId && route.agencyId === agencyId,
        )
      : null;

  const direction =
    selectedRoute && graphParams.directionId
      ? selectedRoute.directions.find(
          myDirection => myDirection.id === graphParams.directionId,
        )
      : null;
  const startStopInfo =
    direction && graphParams.startStopId
      ? selectedRoute.stops[graphParams.startStopId]
      : null;
  const endStopInfo =
    direction && graphParams.endStopId
      ? selectedRoute.stops[graphParams.endStopId]
      : null;

  const classes = useStyles();
  const { breadCrumbStyling, breadCrumbsWrapper } = classes;
  debugger;
  return (
    <Fragment>
      <AppBar position="relative">
        <Toolbar>
          <NavLink to={{ type: 'DASHBOARD', query: props.query }} exact strict>
            <IconButton aria-label="Back to dashboard" edge="start">
              <ArrowBackIcon style={backArrowStyle} />
            </IconButton>
          </NavLink>
          <div className="page-title">{agency ? agency.title : null}</div>
          <div style={{ flexGrow: 1 }} />
          <div style={{paddingRight: '2rem'}}>
              <Share />
            </div>
            <div>
              <DateTimePanel dateRangeSupported />
            </div>
        </Toolbar>
      </AppBar>
      <Paper className={breadCrumbsWrapper}>
        <Breadcrumbs
          separator={
            <NavigateNextIcon
              fontSize="default"
              className={breadCrumbStyling}
            />
          }
        >
          {breadCrumbs(
            [
              selectedRoute,
              direction,
              startStopInfo
                ? Object.assign(
                    { ...startStopInfo },
                    { id: graphParams.startStopId },
                  )
                : null,
              endStopInfo
                ? Object.assign(
                    { ...endStopInfo },
                    { id: graphParams.endStopInfo },
                  )
                : null,
            ],
            classes,
          )}
        </Breadcrumbs>
      </Paper>
      <Grid container spacing={0}>
        <Grid item xs={12} sm={6}>
          <MapStops routes={routes} />
        </Grid>
        <Grid item xs={12} sm={6}>
          {/* control panel and map are full width for 640px windows or smaller, else half width */}
          <ControlPanel routes={routes} />
          {tripMetrics ||
          tripMetricsError ||
          tripMetricsLoading /* if we have trip metrics or an error, then show the info component */ ? (
            <Info
              tripMetrics={tripMetrics}
              tripMetricsError={tripMetricsError}
              tripMetricsLoading={tripMetricsLoading}
              graphParams={graphParams}
              routes={routes}
            />
          ) : (
            /* if no graph data, show the info summary component */
            <RouteSummary />
          )}
        </Grid>
      </Grid>
    </Fragment>
  );
}

const mapStateToProps = state => ({
  tripMetrics: state.tripMetrics.data,
  tripMetricsError: state.tripMetrics.error,
  tripMetricsLoading: state.loading.TRIP_METRICS,
  routes: state.routes.data,
  graphParams: state.graphParams,
  query: state.location.query,
});

const mapDispatchToProps = dispatch => ({
  fetchRoutes: params => dispatch(fetchRoutes(params)),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(RouteScreen);

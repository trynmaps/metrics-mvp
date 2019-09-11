/* eslint-disable react/prop-types */
import React from 'react';
import { connect } from 'react-redux';
import { ROUTE, DIRECTION, FROM_STOP, TO_STOP, Path } from '../routeUtil';
// import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Input from '@material-ui/core/Input';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';
import { handleGraphParams } from '../actions';
import Grid from '@material-ui/core/Grid';


const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexWrap: 'wrap',
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
  },
}));

function ControlPanel(props) {
  const { routes, graphParams } = props;

  const selectedRoute = getSelectedRouteInfo();
  let secondStopList = [];

  const setDirectionId = directionId => {
    let path = new Path();
    path.buildPath(DIRECTION, directionId.target.value).commitPath();
    return (props.onGraphParams({
      direction_id: directionId.target.value,
      start_stop_id: null,
      end_stop_id: null,
    }));
  }

  function getSelectedRouteInfo() {
    const routeId = props.graphParams.route_id;
    return routes ? routes.find(route => route.id === routeId) : null;
  }

  const getStopsInfoInGivenDirection = (mySelectedRoute, directionId) => {
    return mySelectedRoute.directions.find(dir => dir.id === directionId);
  };

  function generateSecondStopList(mySelectedRoute, directionId, stopId) {
    const secondStopInfo = getStopsInfoInGivenDirection(
      mySelectedRoute,
      directionId,
    );
    const secondStopListIndex = stopId
      ? secondStopInfo.stops.indexOf(stopId)
      : 0;
    return secondStopInfo.stops.slice(secondStopListIndex + 1);
  }
  
  

  const onSelectFirstStop = stopId => {
    const directionId = props.graphParams.direction_id;
    const secondStopId = props.graphParams.end_stop_id;
    const mySelectedRoute = { ...getSelectedRouteInfo() };
    secondStopList = generateSecondStopList(
      mySelectedRoute,
      directionId,
      stopId.target.value,
    );
    let path = new Path();
    path.buildPath(FROM_STOP, stopId.target.value);

    if(secondStopId){
      path.buildPath(TO_STOP, secondStopId);
    }

    path.commitPath();
    props.onGraphParams({
      start_stop_id: stopId.target.value,
      end_stop_id: secondStopId,
    });
  };

  const onSelectSecondStop = stopId => {
    let path = new Path();
    path.buildPath(TO_STOP,stopId.target.value).commitPath();
    props.onGraphParams({ end_stop_id: stopId.target.value });
  };

  const setRouteId = routeId => {
    const mySelectedRoute = props.routes
      ? props.routes.find(route => route.id === routeId.target.value)
      : null;

    if (!mySelectedRoute) {
      return;
    }

    const directionId =
      mySelectedRoute.directions.length > 0
        ? mySelectedRoute.directions[0].id
        : null;
    // console.log('sRC: ' + selectedRoute + ' dirid: ' + directionId);
    let path = new Path();
    path.buildPath(ROUTE, routeId.target.value).buildPath(DIRECTION, directionId).commitPath();
    props.onGraphParams({
      route_id: routeId.target.value,
      direction_id: directionId,
      start_stop_id: null,
      end_stop_id: null,
    });
  };

  let selectedDirection = null;
  if (selectedRoute && selectedRoute.directions && graphParams.direction_id) {
    selectedDirection = selectedRoute.directions.find(
      dir => dir.id === graphParams.direction_id,
    );
  }

  if (selectedDirection) {
    secondStopList = generateSecondStopList(
      selectedRoute,
      graphParams.direction_id,
      graphParams.start_stop_id,
    );
  }

  const classes = useStyles();

  return (
    <div className="ControlPanel">
      <Grid container>
        <Grid item xs>
            <FormControl className={classes.formControl}>
              <InputLabel htmlFor="route">Route</InputLabel>
              <Select
                value={graphParams.route_id || 0}
                onChange={setRouteId}
                input={<Input name="route" id="route" />}
              >
                {(routes || []).map(route => (
                  <MenuItem key={route.id} value={route.id}>
                    {route.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
        </Grid>
        {selectedRoute ? (
        <Grid item xs>
            <FormControl className={classes.formControl}>
              <InputLabel htmlFor="direction">Direction</InputLabel>
              <Select
                value={graphParams.direction_id || 1}
                onChange={setDirectionId}
                input={<Input name="direction" id="direction" />}
              >
                {(selectedRoute.directions || []).map(direction => (
                  <MenuItem key={direction.id} value={direction.id}>
                    {direction.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
        </Grid>
        ) : null}
        {selectedDirection ? (
        <Grid container>
          <Grid item xs>
              <FormControl className={classes.formControl}>
                <InputLabel htmlFor="fromstop">From Stop</InputLabel>
                <Select
                  value={graphParams.start_stop_id || 1}
                  onChange={onSelectFirstStop}
                  input={<Input name="stop" id="fromstop" />}
                >
                  {(selectedDirection.stops || []).map(firstStopId => (
                    <MenuItem key={firstStopId} value={firstStopId}>
                      {
                        (
                          selectedRoute.stops[firstStopId] || {
                            title: firstStopId,
                          }
                        ).title
                      }
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
          </Grid>
          <Grid item xs>
              <FormControl className={classes.formControl}>
                <InputLabel htmlFor="tostop">To Stop</InputLabel>
                <Select
                  value={graphParams.end_stop_id || 1}
                  onChange={onSelectSecondStop}
                  input={<Input name="stop" id="tostop" />}
                >
                  {(secondStopList || []).map(secondStopId => (
                    <MenuItem key={secondStopId} value={secondStopId}>
                      {
                        (
                          selectedRoute.stops[secondStopId] || {
                            title: secondStopId,
                          }
                        ).title
                      }
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
          </Grid>
        </Grid>
        ) : null}
      </Grid>
   </div>
  );
}

// for this entire component, now using graphParams values in Redux instead of local state.
const mapStateToProps = state => ({
  graphParams: state.routes.graphParams,
});

const mapDispatchToProps = dispatch => {
  return {
    onGraphParams: params => dispatch(handleGraphParams(params)),
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(ControlPanel);

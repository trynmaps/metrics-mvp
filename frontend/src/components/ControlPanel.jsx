/* eslint-disable react/prop-types */
import React from 'react';
import { connect } from 'react-redux';
import { history, prevPath} from 'redux-first-router';
// import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Input from '@material-ui/core/Input';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';
import { handleGraphParams } from '../actions';
import { push } from 'redux-first-router';
import Grid from '@material-ui/core/Grid';
//URL constants
const ROUTE = 'route';
const DIRECTION = 'direction';
const START_STOP = 'from_stop';
const END_STOP = 'to_stop';

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
    setURL(DIRECTION, directionId.target.value);
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
  
  /*
    sets the URL based on dropDown values
  */
  const setURL = (urlParam,id,stopIds=null) => {
    let currentURL = document.location.pathname;
    if(currentURL.lastIndexOf('/') === currentURL.length-1) {
      currentURL= currentURL.substring(0,currentURL.length-1);
    }
    let currentURLArray = currentURL.split('/');
    const endingURLIndex = currentURLArray.indexOf(urlParam);
    //stopIds is an array of both from and to stop ids
    //if we have them, we need to set both params
    if(stopIds !== null) {
        const endingPath = `${START_STOP}/${stopIds[0]}/${END_STOP}/${stopIds[1]}`;
        currentURL.indexOf(START_STOP) === - 1
        ? push(`${currentURL}/${endingPath}`)
        : push(`${currentURLArray.slice(0,endingURLIndex).join('/')}/${endingPath}`);
       return;
    }
    //if we don't have the value of the URL yet, then just append it
    if(endingURLIndex === -1){
       push(`${currentURL}/${urlParam}/${id}`);
       return;
    }
    //otherwise, we need to cut off the URL and add latest parameter
    currentURLArray[endingURLIndex+1]=id;
    push(currentURLArray.slice(0,endingURLIndex+2).join('/'));

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

    let newSecondStopId = secondStopId;

    // If the "to stop" is not set or is not valid for
    // the current "from stop", set a default "to stop" that
    // is some number of stops down.  If there aren't
    // enough stops, use the end of the line.

    const nStops = 5;

    if (secondStopId == null || !secondStopList.includes(secondStopId)) {
      newSecondStopId =
        secondStopList.length >= nStops
          ? secondStopList[nStops - 1]
          : secondStopList[secondStopList.length - 1];
    }
    secondStopId == null || !secondStopList.includes(secondStopId)
      ? setURL(START_STOP,null,[stopId.target.value,newSecondStopId])
      : setURL(START_STOP,null,[stopId.target.value,secondStopId]);
    
    //console.log(stopId, stopId.target.value, newSecondStopId);

    props.onGraphParams({
      start_stop_id: stopId.target.value,
      end_stop_id: newSecondStopId,
    });
  };

  const onSelectSecondStop = stopId => {
    setURL(END_STOP,stopId.target.value);
    props.onGraphParams({ end_stop_id: stopId.target.value });
  };

  const setRouteId = routeId => {
    debugger;
    setURL(ROUTE, routeId.target.value);
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

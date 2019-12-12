/* eslint-disable react/prop-types */
import React, { useState } from 'react';
import { connect } from 'react-redux';
// import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Input from '@material-ui/core/Input';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';
import Grid from '@material-ui/core/Grid';
import StartStopIcon from '@material-ui/icons/DirectionsTransit';
import EndStopIcon from '@material-ui/icons/Flag';
import { handleGraphParams } from '../actions';
import { ROUTE_ID, DIRECTION_ID, START_STOP_ID, END_STOP_ID } from '../routeConstants';
import { commitPath } from '../routeUtil';
import { Colors } from '../UIConstants';

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
  let secondStopList = [];
  const [allowHover, setAllowHover] = useState(false);

  /**
   * Sets the direction
   */
  function setDirectionId(event) {
    const directionId = event.target.value;
    commitPath({
            [ROUTE_ID]: selectedRoute.id,
            [DIRECTION_ID]: directionId
            });
  }

  function getSelectedRouteInfo() {
    const routeId = props.graphParams.routeId;
    return routes ? routes.find(route => route.id === routeId) : null;
  }

  const selectedRoute = getSelectedRouteInfo();

  function getStopsInfoInGivenDirection(mySelectedRoute, directionId) {
    return mySelectedRoute.directions.find(dir => dir.id === directionId);
  }

  function generateSecondStopList(mySelectedRoute, directionId, stopId) {
    const secondStopInfo = getStopsInfoInGivenDirection(
      mySelectedRoute,
      directionId,
    );
    
    const stopsList = secondStopInfo.stops;
    const secondStopListIndex = stopId
      ? stopsList.indexOf(stopId)
      : 0;
    
    // loop routes start and stop at same stop
    const isLoopRoute = stopsList[0] === stopsList[stopsList.length - 1];
    const oneWaySecondStopsList = stopsList.slice(secondStopListIndex + 1);

    if (!isLoopRoute) {
      return oneWaySecondStopsList;
    }
    // loop routes display all subsequent stops up to origin stop
    return oneWaySecondStopsList.concat(stopsList.slice(1, secondStopListIndex));
  }

  function onSelectFirstStop(event) {
    const stopId = event.target.value;

    const directionId = props.graphParams.directionId;
    const secondStopId = props.graphParams.endStopId;
    const mySelectedRoute = { ...getSelectedRouteInfo() };

    secondStopList = generateSecondStopList(
      mySelectedRoute,
      directionId,
      stopId,
    );

    commitPath({
      [ROUTE_ID]:selectedRoute.id,
      [DIRECTION_ID]: directionId,
      [START_STOP_ID]: stopId,
      [END_STOP_ID]: secondStopId
      });
  }

  function onSelectSecondStop(event) {
    const directionId = props.graphParams.directionId;
    const stopId = props.graphParams.startStopId;
    const endStopId = event.target.value;
    
    commitPath({
      [ROUTE_ID]:selectedRoute.id,
      [DIRECTION_ID]: directionId,
      [START_STOP_ID]: stopId,
      [END_STOP_ID]: endStopId});

    
  }

  function setRouteId(event) {
    const routeId = event.target.value;

    const mySelectedRoute = props.routes
      ? props.routes.find(route => route.id === routeId)
      : null;

    if (!mySelectedRoute) {
      return;
    }

    const directionId =
      mySelectedRoute.directions.length > 0
        ? mySelectedRoute.directions[0].id
        : null;
        
     commitPath({
      [ROUTE_ID]:routeId,
      [DIRECTION_ID]: directionId
      });
  }
  /**
   * Handle mouseover event on Select TO & From dropdown list item.
   */
  function handleItemMouseOver(node, title) {
    if (node && allowHover) {
      node.classList.add('on-hover');
      node.style.setProperty('--stop-name', `"${title}"`);
    }
  }
  /**
   * Handle mouseout event on Select TO & From dropdown list item.
   */
  function handleItemMouseOut(node) {
    node && node.classList.remove('on-hover');
  }
  /**
   * Handle Select component close
   */
  function handleSelectClose() {
    setAllowHover(false);
    const nodeList = document.querySelectorAll('.on-hover');
    nodeList.forEach(node => node.classList.remove('on-hover'));
  }

  let selectedDirection = null;
  if (selectedRoute && selectedRoute.directions && graphParams.directionId) {
    selectedDirection = selectedRoute.directions.find(
      dir => dir.id === graphParams.directionId,
    );
  }

  if (selectedDirection) {
    secondStopList = generateSecondStopList(
      selectedRoute,
      graphParams.directionId,
      graphParams.startStopId,
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
              value={graphParams.routeId || 0}
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
                value={graphParams.directionId || ""}
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
              <Box ml={1}>
                <StartStopIcon fontSize="small" htmlColor={Colors.INDIGO} />
                <FormControl className={classes.formControl}>
                  <InputLabel htmlFor="fromstop">From Stop</InputLabel>
                  <Select
                    value={graphParams.startStopId || 1}
                    onChange={onSelectFirstStop}
                    input={<Input name="stop" id="fromstop" />}
                    onOpen={() => setAllowHover(true)}
                    onClose={handleSelectClose}
                  >
                    {(selectedDirection.stops || []).map(firstStopId => {
                      const icon = document.querySelector(`.id${firstStopId}`);
                      const title = (
                        selectedRoute.stops[firstStopId] || {
                          title: firstStopId,
                        }
                      ).title;
                      return (
                        <MenuItem
                          key={firstStopId}
                          value={firstStopId}
                          onMouseOver={() => handleItemMouseOver(icon, title)}
                          onFocus={() => handleItemMouseOver(icon, title)}
                          onMouseOut={() => handleItemMouseOut(icon)}
                          onBlur={() => handleItemMouseOut(icon)}
                        >
                          {title}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Box>
            </Grid>
            <Grid item xs>
              <Box ml={1}>
                <EndStopIcon fontSize="small" htmlColor={Colors.INDIGO} />
                <FormControl className={classes.formControl}>
                  <InputLabel htmlFor="tostop">To Stop</InputLabel>
                  <Select
                    value={graphParams.endStopId || 1}
                    onChange={onSelectSecondStop}
                    input={<Input name="stop" id="tostop" />}
                    onOpen={() => setAllowHover(true)}
                    onClose={handleSelectClose}
                  >
                    {(secondStopList || []).map(secondStopId => {
                      const icon = document.querySelector(`.id${secondStopId}`);
                      const title = (
                        selectedRoute.stops[secondStopId] || {
                          title: secondStopId,
                        }
                      ).title;
                      return (
                        <MenuItem
                          key={secondStopId}
                          value={secondStopId}
                          onMouseOver={() => handleItemMouseOver(icon, title)}
                          onFocus={() => handleItemMouseOver(icon, title)}
                          onMouseOut={() => handleItemMouseOut(icon)}
                          onBlur={() => handleItemMouseOut(icon)}
                        >
                          {title}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Box>
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

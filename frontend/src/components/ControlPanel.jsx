/* eslint-disable react/prop-types */
import React from 'react';
import { connect } from 'react-redux';
import { css } from 'emotion';
import Card from 'react-bootstrap/Card';
import ListGroup from 'react-bootstrap/ListGroup';
// import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Input from '@material-ui/core/Input';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import FormHelperText from '@material-ui/core/FormHelperText';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';
import { handleGraphParams } from '../actions';
import './ControlPanel.css';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexWrap: 'wrap',
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
  },
  selectEmpty: {
    marginTop: theme.spacing(2),
  },
}));

/* this code attempts to preserve the from stop if the direction changes

 * the from stop is in the new stop list.  It doesn't check the to stop, so
 * either it needs to do that, or we bypass this and just always clear both
 * stops on a direction change.

selectedDirectionChanged = () => {
  const firstStopId = this.props.graphParams.start_stop_id;
  const directionId = this.props.graphParams.direction_id;
  const selectedRoute = this.getSelectedRouteInfo();
  const selectedDirection = (selectedRoute && selectedRoute.directions && directionId)
    ? this.getStopsInfoInGivenDirection(selectedRoute, directionId) : null;
  if (firstStopId) {
    if (!selectedDirection || selectedDirection.stops.indexOf(firstStopId) === -1) {
      this.props.onGraphParams({ start_stop_id: null, end_stop_id: null });
    }
  }
}
   */

function ControlPanel(props) {
  const { routes, graphParams } = props;

  const timeRange =
    graphParams.start_time || graphParams.end_time
      ? `${graphParams.start_time}-${graphParams.end_time}`
      : '';

  const selectedRoute = getSelectedRouteInfo(props);
  const setDate = date => props.onGraphParams({ date });
  const setDirectionId = directionId =>
    props.onGraphParams({
      direction_id: directionId,
      start_stop_id: null,
      end_stop_id: null,
    });

  const setTimeRange = myTimeRange => {
    if (!myTimeRange) {
      props.onGraphParams({ start_time: null, end_time: null });
    } else {
      const timeRangeParts = myTimeRange.target.value.split('-');
      props.onGraphParams({
        start_time: timeRangeParts[0],
        end_time: timeRangeParts[1],
      });
    }
  };

  const onSelectFirstStop = stopId => {
    const directionId = props.graphParams.direction_id;
    const secondStopId = props.graphParams.end_stop_id;
    const selectedRoute = { ...getSelectedRouteInfo() };
    const secondStopList = generateSecondStopList(
      selectedRoute,
      directionId,
      stopId,
    );

    let newSecondStopId = secondStopId;

    // If the "to stop" is not set or is not valid for the current "from stop",
    // set a default "to stop" that is some number of stops down.  If there aren't
    // enough stops, use the end of the line.

    const nStops = 5;

    if (secondStopId == null || !secondStopList.includes(secondStopId)) {
      newSecondStopId =
        secondStopList.length >= nStops
          ? secondStopList[nStops - 1]
          : secondStopList[secondStopList.length - 1];
    }

    props.onGraphParams({
      start_stop_id: stopId,
      end_stop_id: newSecondStopId,
    });
  };

  const onSelectSecondStop = stopId => {
    props.onGraphParams({ end_stop_id: stopId });
  };

  const setRouteId = routeId => {
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
    // console.log('sRC: ' + selectedRoute + ' dirid: ' + directionId);

    props.onGraphParams({
      route_id: routeId,
      direction_id: directionId,
      start_stop_id: null,
      end_stop_id: null,
    });
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

  const getStopsInfoInGivenDirection = (mySelectedRoute, directionId) => {
    return mySelectedRoute.directions.find(dir => dir.id === directionId);
  };

  function getSelectedRouteInfo(props) {
    const { routes } = props;
    const routeId = props.graphParams.route_id;
    return routes ? routes.find(route => route.id === routeId) : null;
  }

  let selectedDirection = null;
  if (selectedRoute && selectedRoute.directions && graphParams.direction_id) {
    selectedDirection = selectedRoute.directions.find(
      dir => dir.id === graphParams.direction_id,
    );
  }

  let secondStopList = null;
  if (selectedDirection) {
    secondStopList = generateSecondStopList(
      selectedRoute,
      graphParams.direction_id,
      graphParams.start_stop_id,
    );
  }

  const classes = useStyles();

  return (
    <div
      className={css`
        color: #fff;
        border-radius: 5px;
        padding: 10px;
        margin-right: 20px;
        grid-column: col1-start / col3-start;
        grid-row: row2-start;
        font-family: 'Oswald', sans-serif;
      `}
    >
      <Card bg="light" style={{ color: 'black' }}>
        {/* The date picker is broken because we're no longer passing in a date in the format
               it expects.  To be replaced with a new Material UI component.
        <DatePicker
          value={graphParams.date}
          onChange={setDate}
          className={css`
         padding: 10px!important;
         display: block;
         width: 100%
       `}
        />  */}
        <ListGroup.Item>
          <FormControl className={classes.formControl}>
            <InputLabel htmlFor="time-helper">Time Range</InputLabel>
            <Select
              value={timeRange}
              onChange={setTimeRange}
              input={<Input name="time_range" id="time_range" />}
            >
              <MenuItem value="">All Day</MenuItem>
              <MenuItem value="07:00-19:00">Daytime (7AM - 7PM)</MenuItem>
              <MenuItem value="03:00-07:00">Early Morning (3AM - 7AM)</MenuItem>
              <MenuItem value="07:00-10:00">AM Peak (7AM - 10AM)</MenuItem>
              <MenuItem value="10:00-15:00">Midday (10AM - 4PM)</MenuItem>
              <MenuItem value="16:00-19:00">PM Peak (4PM - 7PM)</MenuItem>
              <MenuItem value="19:00-03:00+1">
                Late Evening (7PM - 3AM)
              </MenuItem>
            </Select>
            <FormHelperText>Some important helper text</FormHelperText>
          </FormControl>
        </ListGroup.Item>
        <ListGroup variant="flush">
          <div className="dropDownOverlay">
            <ListGroup.Item>
              <FormControl className={classes.formControl}>
                <InputLabel htmlFor="route-helper">Route</InputLabel>
                <Select
                  value={graphParams.route_id || 1}
                  onChange={setRouteId}
                  input={<Input name="route" id="route" />}
                >
                  {(routes || []).map(route => (
                    <MenuItem key={route.id} value={route.id}>
                      {route.title}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>Some important helper text</FormHelperText>
              </FormControl>
            </ListGroup.Item>
          </div>
          {selectedRoute ? (
            <ListGroup.Item>
              <FormControl className={classes.formControl}>
                <InputLabel htmlFor="direction-helper">Direction</InputLabel>
                <Select
                  value={graphParams.direction_id}
                  onChange={setDirectionId}
                  input={<Input name="direction" id="direction" />}
                >
                  {(selectedRoute.directions || []).map(direction => (
                    <MenuItem value={direction.id}>{direction.title}</MenuItem>
                  ))}
                </Select>
                <FormHelperText>Some important helper text</FormHelperText>
              </FormControl>
            </ListGroup.Item>
          ) : null}
          {selectedDirection ? (
            <div className="dropDownOverlay">
              <ListGroup.Item>
                <FormControl className={classes.formControl}>
                  <InputLabel htmlFor="from-stop-helper">From Step</InputLabel>
                  <Select
                    value={graphParams.start_stop_id}
                    onChange={onSelectFirstStop}
                    input={<Input name="stop" id="stop" />}
                  >
                    {(selectedDirection.stops || []).map(firstStopId => (
                      <MenuItem key={firstStopId}>
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
                  <FormHelperText>Some important helper text</FormHelperText>
                </FormControl>
              </ListGroup.Item>
            </div>
          ) : null}
          {selectedDirection ? (
            <div className="dropDownOverlay">
              <ListGroup.Item>
                <FormControl className={classes.formControl}>
                  <InputLabel htmlFor="to-stop-helper">To Step</InputLabel>
                  <Select
                    value={graphParams.end_stop_id}
                    onChange={onSelectSecondStop}
                    input={<Input name="stop" id="stop" />}
                  >
                    {(selectedDirection.stops || []).map(secondStopList => (
                      <MenuItem key={secondStopList}>
                        {
                          (
                            selectedRoute.stops[secondStopList] || {
                              title: secondStopList,
                            }
                          ).title
                        }
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>Some important helper text</FormHelperText>
                </FormControl>
              </ListGroup.Item>
            </div>
          ) : null}
        </ListGroup>
      </Card>
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

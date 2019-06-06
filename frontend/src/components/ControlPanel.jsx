import React, {Component, useState, useEffect} from 'react';
import { css } from 'emotion';
import DatePicker from 'react-date-picker';
import Card from 'react-bootstrap/Card';
import ListGroup from 'react-bootstrap/ListGroup';
import PropTypes from 'prop-types';
// import ReactDOM from 'react-dom';
import { makeStyles } from '@material-ui/core/styles';
// import Input from '@material-ui/core/Input';
import OutlinedInput from '@material-ui/core/OutlinedInput';
// import FilledInput from '@material-ui/core/FilledInput';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
// import FormHelperText from '@material-ui/core/FormHelperText';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';
import Button from '@material-ui/core/Button';
import DropdownControl from './DropdownControl';

const [routeId, setRouteId] = useState(12);
const [directionId, setDirectionId] = useState(null);
const [firstStopId, setFirstStopId] = useState(null);
const [secondStopList, setSecondStopList] = useState([]);
const [secondStopId, setSecondStopId] = useState(null);
const [date, setDate] = useState(new Date('2019-04-08T03:50'));
const [time, setTime] = useState(0);
const [startTimeStr, setStartTimeStr] = useState(null);
const [endTimeStr, setEndTimeStr] = useState(null);
const selectRoute = useEffect(() => {
  const selectedRoute = getSelectedRouteInfo();
  if (selectedRoute) {
    if (!selectedRoute.directions) {
      this.props.fetchRouteConfig(this.state.routeId);
    } else if (!this.state.directionId && selectedRoute.directions.length > 0) {
      this.setState({ directionId: selectedRoute.directions[0].id });
    }
  }
}, []);


function updateGraphData() {
  this.props.resetGraphData();
  if (firstStopId != null && routeId != null) {
    const formattedDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const params = {
      route_id: routeId,
      direction_id: directionId,
      start_stop_id: firstStopId,
      end_stop_id: secondStopId,
      start_time: startTimeStr,
      end_time: endTimeStr,
      date: formattedDate,
    };
    this.props.fetchGraphData(params);
  }
}

function onSubmit(event) {
  event.preventDefault();
  updateGraphData();
}

function handleSetDate(date) {
  setDate(date);
  selectedRouteChanged();
}

function setTimeRange(timeRange) {
  if (!timeRange) {
    setStartTimeStr(null);
    setEndTimeStr(null);
    updateGraphData();
  } else {
    var timeRangeParts = timeRange.split('-');
    setStartTimeStr(timeRangeParts[0]);
    setEndTimeStr(timeRangeParts[1]);
    updateGraphData();
    // this.setState({ startTimeStr: timeRangeParts[0], endTimeStr: timeRangeParts[1] }, this.updateGraphData);
  }
}

function handleSetRouteId(routeId) {
  setRouteId(routeId);
  selectedRouteChanged();
}

function handleSetDirectionId(directionId) {
  setDirectionId(directionId);
  selectedDirectionChanged();
}

function onSelectSecondStop(firstStopId, selectFirstStopCallback) {
  selectFirstStopCallback ? selectFirstStopCallback(firstStopId)
      : this.setState({ secondStopId: firstStopId }, selectedStopChanged);
}

function onSelectFirstStop(stopId) {
  const selectedRoute = { ...getSelectedRouteInfo() };
  const secondStopInfo = getStopsInfoInGivenDirection(selectedRoute, directionId);
  const secondStopListIndex = secondStopInfo.stops.indexOf(stopId);
  const secondStopList = secondStopInfo.stops.slice(secondStopListIndex + 1);

  let newSecondStopId = secondStopId;

  // If the "to stop" is not set or is not valid for the current "from stop",
  // set a default "to stop" that is some number of stops down.  If there aren't
  // enough stops, use the end of the line.

  const nStops = 5;

  if (secondStopId == null || !secondStopList.includes(secondStopId)) {
    newSecondStopId = secondStopList.length >= nStops ? secondStopList[nStops-1] :
        secondStopList[secondStopList.length-1];
  }

  //setState({ firstStopId: stopId, secondStopId: newSecondStopId, secondStopList }, );

  selectedStopChanged();
}


function selectedRouteChanged() {
  const selectedRoute = getSelectedRouteInfo();
  if (!selectedRoute) {
    return;
  }
  if (!selectedRoute.directions) {
    setDirectionId(null);
    this.props.fetchRouteConfig(routeId);
  } else {
    const directionId = selectedRoute.directions.length > 0 ? selectedRoute.directions[0].id : null;
    setDirectionId(directionId);
  }
}

function getStopsInfoInGivenDirection(selectedRoute, directionId) {
  selectedRoute.directions.find(dir => dir.id === directionId);
}

function selectedDirectionChanged() {
  const selectedRoute = getSelectedRouteInfo();
  const selectedDirection = (selectedRoute && selectedRoute.directions && directionId)
      ? getStopsInfoInGivenDirection(selectedRoute, directionId) : null;
  if (firstStopId) {
    if (!selectedDirection || selectedDirection.stops.indexOf(firstStopId) === -1) {
      setFirstStopId(null);
      setSecondStopId(null);
      selectedStopChanged();
    }
  }
}

function selectedStopChanged() {
  updateGraphData();
}

function handleTimeChange(newTime) {
  setTime( newTime.formatted );
}

function getSelectedRouteInfo() {
  const { routes } = this.props;
  const { routeId } = this.state;
  return routes ? routes.find(route => route.id === routeId) : null;
}

// toggleTimekeeper(val) {
//   // this.setState({ displayTimepicker: val });
// }

function ControlPanel() {
  const { routes } = this.props;
  const timeRange = (startTimeStr || endTimeStr) ? (startTimeStr + '-' + endTimeStr) : '';
  const selectedRoute = getSelectedRouteInfo();
  const selectedDirection = (selectedRoute && selectedRoute.directions && directionId)
      ? selectedRoute.directions.find(dir => dir.id === directionId) : null;
  // const [values, setValues] = getState();
  //
  // const handleChange = (event) => {
  //   setValues(oldValues => ({
  //     ...oldValues,
  //     [event.target.name]: event.target.value,
  //   }));
  // };

  // const values = { age: 1 };


  return (
      <div className={css`
          color: #fff;
          border-radius: 5px;
          padding: 10px;
          margin-right: 20px;
          grid-column: col1-start / col3-start;
          grid-row: row2-start ;
          font-family: 'Oswald', sans-serif;
      `
      }
      >
        <Card bg="light" style={{ color: 'black' }}>
          <Card.Header>Visualize Route</Card.Header>
          <DatePicker
              value={date}
              onChange={this.handleSetDate}
              className={css`
           padding: 10px!important;
           display: block;
           width: 100%
         `}
          />
          <Button variant="contained" color="primary">
            Hello World
          </Button>
          <FormControl variant="outlined">
            <InputLabel htmlFor="outlined-age-simple">
              Time Range
            </InputLabel>
            {
              /*
              <Select
                value={values.age}
                name="age"
                id="outlined-age-simple"
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              <MenuItem value={10}>Ten</MenuItem>
              <MenuItem value={20}>Twenty</MenuItem>
              <MenuItem value={30}>Thirty</MenuItem>
            </Select>
            */}
          </FormControl>
          <ListGroup.Item>
            <DropdownControl
                title="Time Range"
                name="time_range"
                variant="info"
                value={timeRange}
                onSelect={this.setTimeRange}
                options={
                  [
                    {label:'All Day', key:''},
                    {label:'Daytime (7AM - 7PM)', key:'07:00-19:00'},
                    {label:'Early Morning (3AM - 7AM)', key:'03:00-07:00'},
                    {label:'AM Peak (7AM - 10AM)', key:'07:00-10:00'},
                    {label:'Midday (10AM - 4PM)', key:'10:00-16:00'},
                    {label:'PM Peak (4PM - 7PM)', key:'16:00-19:00'},
                    {label:'Late Evening (7PM - 3AM)', key:'19:00-03:00+1'},
                  ]
                }
            />
          </ListGroup.Item>
          <ListGroup variant="flush">
            <ListGroup.Item>
              <DropdownControl
                  title="Route"
                  name="route"
                  variant="info"
                  value={routeId}
                  options={
                    (routes || []).map(route => ({
                      label: route.title, key: route.id,
                    }))
                  }
                  onSelect={this.handleSetRouteId}
              />
            </ListGroup.Item>
            { selectedRoute
                ? (
                    <ListGroup.Item>
                      <DropdownControl
                          title="Direction"
                          name="direction"
                          variant="info"
                          value={directionId}
                          onSelect={this.handleSetDirectionId}
                          options={
                            (selectedRoute.directions || []).map(direction => ({
                              label: direction.title, key: direction.id,
                            }))
                          }
                      />
                    </ListGroup.Item>
                ) : null
            }
            { (selectedDirection)
                ? (
                    <ListGroup.Item>
                      <DropdownControl
                          title="From Stop"
                          name="stop"
                          variant="info"
                          value={firstStopId}
                          onSelect={this.onSelectFirstStop}
                          options={
                            (selectedDirection.stops || []).map(firstStopId => ({
                              label: (selectedRoute.stops[firstStopId] || { title: firstStopId }).title,
                              key: firstStopId,
                            }))
                          }
                      />
                    </ListGroup.Item>
                ) : null
            }
            { (selectedDirection)
                ? (
                    <ListGroup.Item>
                      <DropdownControl
                          title="To Stop"
                          name="stop"
                          variant="info"
                          value={secondStopId}
                          onSelect={this.onSelectSecondStop}
                          options={
                            (secondStopList || []).map(secondStopId => ({
                              label: (selectedRoute.stops[secondStopId] || { title: secondStopId }).title,
                              key: secondStopId,
                            }))
                          }
                      />
                    </ListGroup.Item>
                ) : null
            }
          </ListGroup>
        </Card>
      </div>
  );
}

//
// ControlPanel.propTypes = {
//   fetchGraphData: PropTypes.func.isRequired,
// };

export default ControlPanel;

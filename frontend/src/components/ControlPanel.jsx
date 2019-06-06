import React, { Component } from 'react';
import { connect } from 'react-redux';
import { css } from 'emotion';
import DatePicker from 'react-date-picker';
import Card from 'react-bootstrap/Card';
import ListGroup from 'react-bootstrap/ListGroup';
import PropTypes from 'prop-types';
import {handleRouteSelect} from '../actions';

import DropdownControl from './DropdownControl';
import './ControlPanel.css';

class ControlPanel extends Component {
  constructor(props) {
    super(props);
    this.state = {
      routeId: '12',
      directionId: null,
      secondStopList: [],
      firstStopId: null,
      secondStopId: null,
      date: new Date('2019-04-08T03:50'),
      startTimeStr: null,
      endTimeStr: null,
    };
  }

  componentDidUpdate() {
    const selectedRoute = this.getSelectedRouteInfo();
    if (selectedRoute) {
      if (!selectedRoute.directions) {
        this.props.fetchRouteConfig(this.state.routeId);
      } else if (!this.state.directionId && selectedRoute.directions.length > 0) {
        this.setState({ directionId: selectedRoute.directions[0].id });
      }
    }
  }

  updateGraphData = () => {
    const {
      routeId, directionId, firstStopId, date, secondStopId, startTimeStr, endTimeStr
    } = this.state;

    this.props.resetGraphData();
    if (firstStopId != null && routeId != null) {
      const formattedDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      const graphParams = {
        route_id: routeId,
        direction_id: directionId,
        start_stop_id: firstStopId,
        end_stop_id: secondStopId,
        start_time: startTimeStr,
        end_time: endTimeStr,
        date: formattedDate,
      };
      const intervalParams = Object.assign({}, graphParams);
      delete intervalParams.start_time; // for interval api, clear out start/end time and use defaults for now
      delete intervalParams.end_time;   // because the hourly graph is spiky and can trigger panda "empty axes" errors. 
      this.props.fetchData(graphParams, intervalParams);
    }
  }

  onSubmit = (event) => {
    event.preventDefault();
    this.updateGraphData();
  }

  setDate = date => this.setState({ date }, this.updateGraphData)

  setTimeRange = timeRange => {
    if (!timeRange) {
      this.setState({ startTimeStr: null, endTimeStr: null }, this.updateGraphData);
    } else {
      var timeRangeParts = timeRange.split('-');
      this.setState({ startTimeStr: timeRangeParts[0], endTimeStr: timeRangeParts[1] }, this.updateGraphData);
    }
  }

  setRouteId = routeId => this.setState({ routeId }, this.selectedRouteChanged)

  setDirectionId = directionId => this.setState({ directionId }, this.selectedDirectionChanged)

  onSelectSecondStop = (firstStopId, selectFirstStopCallback) => {
    selectFirstStopCallback ? selectFirstStopCallback(firstStopId)
      : this.setState({ secondStopId: firstStopId }, this.selectedStopChanged);
  }

  onSelectFirstStop = (stopId) => {
    const { directionId, secondStopId } = this.state;
    const selectedRoute = { ...this.getSelectedRouteInfo() };
    const secondStopInfo = this.getStopsInfoInGivenDirection(selectedRoute, directionId);
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
    this.setState({ firstStopId: stopId, secondStopId: newSecondStopId, secondStopList }, this.selectedStopChanged);
  }

  onSelectSecondStop = (stopId) => {
    this.setState({ secondStopId: stopId }, this.selectedStopChanged);
  }

  selectedRouteChanged = () => {
    const {onRouteSelect} = this.props;
    const { routeId } = this.state;
    const selectedRoute = this.getSelectedRouteInfo();
    if (!selectedRoute) {
      return;
    }
    //onRouteSelect(selectedRoute);
    if (!selectedRoute.directions) {
      this.setDirectionId(null);
      this.props.fetchRouteConfig(routeId);
    } else {
      const directionId = selectedRoute.directions.length > 0 ? selectedRoute.directions[0].id : null;
      this.setDirectionId(directionId);
    }
  }

  getStopsInfoInGivenDirection = (selectedRoute, directionId) => {
    return selectedRoute.directions.find(dir => dir.id === directionId);
  }
  getStopsInfoInGivenDirectionName = (selectedRoute, name) => {
    const stopSids= selectedRoute.directions.find(dir => dir.name === name);
    return stopSids.stops.map(stop => {
      debugger;
      let currentStopInfo = {...selectedRoute.stops[stop]};
      currentStopInfo.sid = stop;
      return currentStopInfo;
    });
    
  }

  selectedDirectionChanged = () => {
    const { firstStopId, directionId } = this.state;
    const selectedRoute = this.getSelectedRouteInfo();
    const selectedDirection = (selectedRoute && selectedRoute.directions && directionId)
      ? this.getStopsInfoInGivenDirection(selectedRoute, directionId) : null;
    if (firstStopId) {
      if (!selectedDirection || selectedDirection.stops.indexOf(firstStopId) === -1) {
        this.setState({ firstStopId: null, secondStopId: null }, this.selectedStopChanged);
      }
    }
  }

  selectedStopChanged = () => {
    this.updateGraphData();
  }

  handleTimeChange(newTime) {
    this.setState({ time: newTime.formatted });
  }

  getSelectedRouteInfo() {
    const { routes } = this.props;
    const { routeId } = this.state;
    return routes ? routes.find(route => route.id === routeId) : null;
  }
  sendRouteStopsToMap = () => {
    const {directionId} = this.state;
    const {onRouteSelect} = this.props;
    const selectedRoute = this.getSelectedRouteInfo();
    onRouteSelect({
      'Inbound' : this.getStopsInfoInGivenDirectionName(selectedRoute, 'Inbound'),
      'Outbound' : this.getStopsInfoInGivenDirectionName(selectedRoute, 'Outbound')
    });
  }
  // toggleTimekeeper(val) {
  //   // this.setState({ displayTimepicker: val });
  // }

  render() {
    const { routes } = this.props;
    const {
      date, routeId, directionId, firstStopId, secondStopId, secondStopList, startTimeStr, endTimeStr
    } = this.state;

    const timeRange = (startTimeStr || endTimeStr) ? (startTimeStr + '-' + endTimeStr) : '';

    const selectedRoute = this.getSelectedRouteInfo();
    let selectedDirection =null;
    if (selectedRoute && selectedRoute.directions && directionId) {
      selectedDirection = selectedRoute.directions.find(dir => dir.id === directionId);
      this.sendRouteStopsToMap();
    }
    
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
            onChange={this.setDate}
            className={css`
           padding: 10px!important;
           display: block;
           width: 100%
         `}
          />
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
            <div className="dropDownOverlay">
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
                  onSelect={this.setRouteId}
                />
              </ListGroup.Item>
            </div>
            { selectedRoute
              ? (
                <ListGroup.Item>
                  <DropdownControl
                    title="Direction"
                    name="direction"
                    variant="info"
                    value={directionId}
                    onSelect={this.setDirectionId}
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
                <div className="dropDownOverlay">
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
                </div>
              ) : null
            }
            { (selectedDirection)
              ? (
                <div className="dropDownOverlay">
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
                </div>
              ) : null
            }
          </ListGroup>
        </Card>
      </div>
    );
  }
}

ControlPanel.propTypes = {
  fetchGraphData: PropTypes.func.isRequired,
};

const mapDispatchToProps = dispatch => {
  return ({
    onRouteSelect: route => dispatch(handleRouteSelect(route))
  })
}
export default connect(null,mapDispatchToProps)(ControlPanel);

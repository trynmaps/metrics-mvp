import React, { Component } from 'react';
import { connect } from 'react-redux';
import { css } from 'emotion';
import Card from 'react-bootstrap/Card';
import ListGroup from 'react-bootstrap/ListGroup';
import PropTypes from 'prop-types';
import { handleGraphParams } from '../actions';

import DropdownControl from './DropdownControl';
import './ControlPanel.css';

class ControlPanel extends Component {

  setDate = date => this.props.onGraphParams({ date: date });

  setTimeRange = timeRange => {
    if (!timeRange) {
      this.props.onGraphParams({ start_time: null, end_time: null });
    } else {
      var timeRangeParts = timeRange.split('-');
      this.props.onGraphParams({ start_time: timeRangeParts[0], end_time: timeRangeParts[1] });
    }
  }

  setRouteId = routeId => {
    this.selectedRouteChanged(routeId);
  };

  setDirectionId = directionId => this.props.onGraphParams({
    direction_id: directionId,
    start_stop_id: null,
    end_stop_id: null,
  });

  generateSecondStopList(selectedRoute, directionId, stopId) {
    const secondStopInfo = this.getStopsInfoInGivenDirection(selectedRoute, directionId);
    const secondStopListIndex = stopId ? secondStopInfo.stops.indexOf(stopId) : 0;
    return secondStopInfo.stops.slice(secondStopListIndex + 1);
  }
  
  onSelectFirstStop = (stopId) => {
    const directionId = this.props.graphParams.direction_id;
    const secondStopId = this.props.graphParams.end_stop_id;
    const selectedRoute = { ...this.getSelectedRouteInfo() };
    const secondStopList = this.generateSecondStopList(selectedRoute, directionId, stopId);

    let newSecondStopId = secondStopId;

    // If the "to stop" is not set or is not valid for the current "from stop",
    // set a default "to stop" that is some number of stops down.  If there aren't
    // enough stops, use the end of the line.

    const nStops = 5;

    if (secondStopId == null || !secondStopList.includes(secondStopId)) {
        newSecondStopId = secondStopList.length >= nStops ? secondStopList[nStops-1] :
            secondStopList[secondStopList.length-1];
    }
    this.props.onGraphParams({ start_stop_id: stopId, end_stop_id: newSecondStopId});
  }

  onSelectSecondStop = (stopId) => {
    this.props.onGraphParams({ end_stop_id: stopId });
  }

  selectedRouteChanged = (routeId) => {
      
    const selectedRoute = this.props.routes ? this.props.routes.find(route => route.id === routeId) : null;

    if (!selectedRoute) {
      return;
    }

    const directionId = selectedRoute.directions.length > 0 ? selectedRoute.directions[0].id : null;
    //console.log('sRC: ' + selectedRoute + ' dirid: ' + directionId);
    
    this.props.onGraphParams({ route_id: routeId, direction_id: directionId, start_stop_id: null, end_stop_id: null });
  }

  getStopsInfoInGivenDirection = (selectedRoute, directionId) => {
    return selectedRoute.directions.find(dir => dir.id === directionId);
  }

 
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

  getSelectedRouteInfo() {
    const { routes } = this.props;
    const routeId = this.props.graphParams.route_id;
    return routes ? routes.find(route => route.id === routeId) : null;
  }

  render() {
    const { routes, graphParams } = this.props;

    const timeRange = (graphParams.start_time || graphParams.end_time) ? (graphParams.start_time + '-' + graphParams.end_time) : '';

    const selectedRoute = this.getSelectedRouteInfo();
    let selectedDirection = null;
    if (selectedRoute && selectedRoute.directions && graphParams.direction_id) {
      selectedDirection = selectedRoute.directions.find(dir => dir.id === graphParams.direction_id);
    }
    
    let secondStopList = null;
    if (selectedDirection) {
      secondStopList = this.generateSecondStopList(selectedRoute, graphParams.direction_id, graphParams.start_stop_id);
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
            { /* The date picker is broken because we're no longer passing in a date in the format
                 it expects.  To be replaced with a new Material UI component.
          <DatePicker
            value={graphParams.date}
            onChange={this.setDate}
            className={css`
           padding: 10px!important;
           display: block;
           width: 100%
         `}
          />  */ }
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
                  value={graphParams.route_id}
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
                    value={graphParams.direction_id}
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
                      value={graphParams.start_stop_id}
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
                      value={graphParams.end_stop_id}
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

// for this entire component, now using graphParams values in Redux instead of local state.
const mapStateToProps = state => ({
  graphParams: state.routes.graphParams
});

const mapDispatchToProps = dispatch => {
  return ({
    onGraphParams: params => dispatch(handleGraphParams(params)),
  })
}

export default connect(mapStateToProps, mapDispatchToProps)(ControlPanel);

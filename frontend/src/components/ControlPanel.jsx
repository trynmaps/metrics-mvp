import React, { Component } from 'react';
import { css } from 'emotion';
import DatePicker from 'react-date-picker';
import Card from 'react-bootstrap/Card';
import ListGroup from 'react-bootstrap/ListGroup';
import PropTypes from 'prop-types';

import DropdownControl from './DropdownControl';

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
      routeId, directionId, firstStopId, date, secondStopId,
    } = this.state;

    this.props.resetGraphData();
    if (firstStopId != null && routeId != null) {
      const formattedDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      const params = {
        route_id: routeId,
        direction_id: directionId,
        start_stop_id: firstStopId,
        end_stop_id: secondStopId,
        date: formattedDate,
      };
      this.props.fetchGraphData(params);
    }
  }

  onSubmit = (event) => {
    event.preventDefault();
    this.updateGraphData();
  }

  setDate = date => this.setState({ date }, this.updateGraphData)

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
    
    # If the "to stop" is not set or is not valid for the current "from stop",
    # set a default "to stop" that is some number of stops down.  If there aren't
    # enough stops, use the end of the line.
    
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
    const { routeId } = this.state;
    const selectedRoute = this.getSelectedRouteInfo();
    if (!selectedRoute) {
      return;
    }
    if (!selectedRoute.directions) {
      this.setDirectionId(null);
      this.props.fetchRouteConfig(routeId);
    } else {
      const directionId = selectedRoute.directions.length > 0 ? selectedRoute.directions[0].id : null;
      this.setDirectionId(directionId);
    }
  }

  getStopsInfoInGivenDirection = (selectedRoute, directionId) => selectedRoute.directions.find(dir => dir.id === directionId);

  selectedDirectionChanged = () => {
    const { firstStopId, directionId } = this.state;
    const selectedRoute = this.getSelectedRouteInfo();
    const selectedDirection = (selectedRoute && selectedRoute.directions && directionId)
      ? this.getStopsInfoInGivenDirection(selectedRoute, directionId) : null;
    if (firstStopId) {
      if (!selectedDirection || selectedDirection.stops.indexOf(firstStopId) === -1) {
        this.setState({ firstStopId: null, secondStopId: null });
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

  // toggleTimekeeper(val) {
  //   // this.setState({ displayTimepicker: val });
  // }

  render() {
    const { routes } = this.props;
    const {
      date, routeId, directionId, firstStopId, secondStopId, secondStopList,
    } = this.state;

    const selectedRoute = this.getSelectedRouteInfo();
    const selectedDirection = (selectedRoute && selectedRoute.directions && directionId)
      ? selectedRoute.directions.find(dir => dir.id === directionId) : null;
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
                onSelect={this.setRouteId}
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
}

ControlPanel.propTypes = {
  fetchGraphData: PropTypes.func.isRequired,
};

export default ControlPanel;

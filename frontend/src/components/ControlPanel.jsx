import React, { Component } from 'react';
import { css } from 'emotion';
import Card from 'react-bootstrap/Card';
import ListGroup from 'react-bootstrap/ListGroup';
import PropTypes from 'prop-types';
import MultipleDatePicker from './MultipleDatePicker';
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
      dates: new Date('2019-04-08T03:50'),
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
    const { directionId } = this.state;
    const selectedRoute = { ...this.getSelectedRouteInfo() };
    const secondStopInfo = this.getStopsInfoInGivenDirection(selectedRoute, directionId);
    const secondStopListIndex = secondStopInfo.stops.indexOf(stopId);
    const secondStopList = secondStopInfo.stops.slice(secondStopListIndex + 1);
    this.setState({ firstStopId: stopId, secondStopList }, this.selectedStopChanged);
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

  // toggleTimekeeper(val) {
  //   // this.setState({ displayTimepicker: val });
  // }

  render() {
    const { routes } = this.props;
    const {
      dates,
      routeId,
      directionId,
      firstStopId,
      secondStopId,
      secondStopList,
      startTimeStr,
      endTimeStr,
    } = this.state;

    const timeRange = (startTimeStr || endTimeStr) ? (startTimeStr + '-' + endTimeStr) : '';

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
          <MultipleDatePicker
            value={dates}
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
                  { label: 'All Day', key: '' },
                  { label: 'Daytime (7AM - 7PM)', key: '07:00-19:00' },
                  { label: 'Early Morning (3AM - 7AM)', key: '03:00-07:00' },
                  { label: 'AM Peak (7AM - 10AM)', key: '07:00-10:00' },
                  { label: 'Midday (10AM - 4PM)', key: '10:00-16:00' },
                  { label: 'PM Peak (4PM - 7PM)', key: '16:00-19:00' },
                  { label: 'Late Evening (7PM - 3AM)', key: '19:00-03:00+1' },
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
                onSelect={this.setRouteId}
              />
            </ListGroup.Item>
            {selectedRoute
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
            {(selectedDirection)
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
            {(selectedDirection)
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
  routes: PropTypes.instanceOf(Array),
  fetchGraphData: PropTypes.func.isRequired,
};

ControlPanel.defaultProps = {
  routes: [],
};

export default ControlPanel;

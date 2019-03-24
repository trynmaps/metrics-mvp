import React, { Component } from 'react';
import { css } from 'emotion';
import DatePicker from 'react-date-picker';
import PropTypes from 'prop-types';

import DropdownControl from './DropdownControl';

class ControlPanel extends Component {
  constructor(props) {
    super(props);
    this.state = {
      routeId: '12',
      directionId: null,
      stopId: null,
      date: new Date('2019-02-01T03:50'),
      time: '6:50 am',
    };
  }

  componentDidUpdate() {
    const selectedRoute = this.getSelectedRouteInfo();
    if (selectedRoute) {
      if (!selectedRoute.directions) {
        this.props.fetchRouteConfig(this.state.routeId);
      } else {
        if (!this.state.directionId && selectedRoute.directions.length > 0) {
          this.setState({ directionId: selectedRoute.directions[0].id });
        }
      }
    }
  }

  updateGraphData = () => {
    const { routeId, directionId, stopId, date } = this.state;

    this.props.resetGraphData();
    if (stopId != null && routeId != null) {
      const formattedDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      const params = {
        route_id: routeId,
        direction_id: directionId,
        stop_id: stopId,
        date: formattedDate
      };
      this.props.fetchGraphData(params);
    }
  }

  onSubmit = (event) => {
    event.preventDefault();
    this.updateGraphData();
  }

  setDate = (date) => this.setState({ date }, this.updateGraphData)

  setRouteId = (routeId) => this.setState({ routeId }, this.selectedRouteChanged)

  setDirectionId = (directionId) => this.setState({ directionId }, this.selectedDirectionChanged)

  setStopId = (stopId) => this.setState({ stopId }, this.selectedStopChanged)

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
      const directionId = selectedRoute.directions.length > 0 ? selectedRoute.directions[0].id : null
      this.setDirectionId(directionId);
    }
  }

  selectedDirectionChanged = () => {
    const { stopId, directionId } = this.state;
    const selectedRoute = this.getSelectedRouteInfo();
    const selectedDirection = (selectedRoute && selectedRoute.directions && directionId) ?
        selectedRoute.directions.find(dir => dir.id === directionId) : null;
    if (stopId) {
      if (!selectedDirection || selectedDirection.stops.indexOf(stopId) === -1) {
        this.setStopId(null);
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
    const { date, routeId, directionId, stopId } = this.state;

    const selectedRoute = this.getSelectedRouteInfo();
    const selectedDirection = (selectedRoute && selectedRoute.directions && directionId) ?
        selectedRoute.directions.find(dir => dir.id === directionId) : null;

    return (
      <>
        <div className={css`
          background-color: #add8e6;
          color: #fff;
          border-radius: 5px;
          padding: 20px;
          margin-right: 20px;
          grid-column: col1-start / col3-start;
           grid-row: row2-start ;
      `
      }
        >
          <DatePicker value={date} onChange={this.setDate} />
          <DropdownControl title="Route" name='route' value={routeId}
            onSelect={this.setRouteId}
            options={
                (routes || []).map(route => ({label:route.title, key:route.id}))
            } />
            { selectedRoute ?
                <DropdownControl title="Direction" name='direction' value={directionId}
                onSelect={this.setDirectionId}
                options={
                  (selectedRoute.directions || []).map(direction => ({
                    label:direction.title, key:direction.id
                  }))
                } /> : null
            }
            { (selectedDirection) ?
                <DropdownControl title="Stop" name='stop' value={stopId}
                onSelect={this.setStopId}
                options={
                  (selectedDirection.stops || []).map(stopId => ({
                    label: (selectedRoute.stops[stopId] || {title:stopId}).title,
                    key:stopId
                  }))
                } /> : null
            }
        </div>
        <div className={css`
          color: #fff;
          border-radius: 5px;
          margin-top: 20px;
          `}
        >
          <button type="submit" onClick={this.onSubmit}> Calculate route statistics </button>
        </div>
      </>
    );
  }
}

ControlPanel.propTypes = {
  fetchGraphData: PropTypes.func.isRequired,
};

export default ControlPanel;

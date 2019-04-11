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
      secondStopList:[],
      firstStopId: null,
      secondStopId: null,
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
    const { routeId, directionId, firstStopId, date, secondStopId } = this.state;

    this.props.resetGraphData();
    if (firstStopId != null && routeId != null) {
      const formattedDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      const params = {
        route_id: routeId,
        direction_id: directionId,
        start_stop_id: firstStopId,
        end_stop_id: secondStopId,
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

  onSelectSecondStop = (firstStopId,selectFirstStopCallback) => {
    selectFirstStopCallback ? selectFirstStopCallback(firstStopId) :
    this.setState({ secondStopId: firstStopId }, this.selectedStopChanged);
  }

  onSelectFirstStop = stopId => {
    const {directionId} = this.state;
    const selectedRoute = {...this.getSelectedRouteInfo()};
    const secondStopInfo = this.getStopsInfoInGivenDirection(selectedRoute,directionId);
    const secondStopListIndex=secondStopInfo.stops.indexOf(stopId);
    const secondStopList = secondStopInfo.stops.slice(secondStopListIndex+1);
    this.setState({firstStopId: stopId, secondStopList:secondStopList});
  }

  onSelectSecondStop = stopId => {
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
      const directionId = selectedRoute.directions.length > 0 ? selectedRoute.directions[0].id : null
      this.setDirectionId(directionId);
    }
  }
  getStopsInfoInGivenDirection = (selectedRoute, directionId) => selectedRoute.directions.find(dir => dir.id === directionId);

  selectedDirectionChanged = () => {
    const { firstStopId, directionId } = this.state;
    const selectedRoute = this.getSelectedRouteInfo();
    const selectedDirection = (selectedRoute && selectedRoute.directions && directionId) ?
        this.getStopsInfoInGivenDirection(selectedRoute,directionId) : null;
    if (firstStopId) {
      if (!selectedDirection || selectedDirection.stops.indexOf(firstStopId) === -1) {
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
    const { date, routeId, directionId, firstStopId, secondStopId, secondStopList } = this.state;

    const selectedRoute = this.getSelectedRouteInfo();
    const selectedDirection = (selectedRoute && selectedRoute.directions && directionId) ?
        selectedRoute.directions.find(dir => dir.id === directionId) : null;
    debugger;
    return (
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
                <DropdownControl title="Stop" name='stop' value={firstStopId}
                onSelect={this.onSelectFirstStop}
                options={
                  (selectedDirection.stops || []).map(firstStopId => ({
                    label: (selectedRoute.stops[firstStopId] || {title:firstStopId}).title,
                    key:firstStopId
                  }))
                } /> : null
            }
            { (selectedDirection) ?
                <DropdownControl title="Stop" name='stop' value={secondStopId}
                onSelect={this.onSelectSecondStop}
                options={
                  (secondStopList || []).map(firstStopId => ({
                    label: (selectedRoute.stops[firstStopId] || {title:firstStopId}).title,
                    key:firstStopId
                  }))
                } /> : null
            }
        </div>
    );
  }
}

ControlPanel.propTypes = {
  fetchGraphData: PropTypes.func.isRequired,
};

export default ControlPanel;

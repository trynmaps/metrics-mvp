import React, { Component, Fragment } from 'react';
import { connect } from 'react-redux';
import { css } from 'emotion';
import MapStops from './MapStops';
import ControlPanel from './ControlPanel';
import Info from './Info';
import Intro from './Intro';
import {
  fetchData,
  fetchGraphData,
  fetchIntervalData,
  fetchRoutes,
  resetGraphData,
  resetIntervalData,
} from '../actions';

class Home extends Component {
  componentDidMount() {
    if (!this.props.routes) {
      this.props.fetchRoutes();
    }
  }

  render() {
    const {
      graphData,
      graphError,
      graphParams,
      intervalData,
      intervalError,
      routes,
    } = this.props;
    return (
      <Fragment>
        <div
          className={css`
            display: grid;
            grid-gap: 4px;
            grid-template-columns: [col1-start] 200px [col2-start] 300px [col3-start] auto [col3-end];
            grid-template-rows: [row1-start] 80px [row2-start] 430px [row2-end];
            background-color: #fff;
            color: #444;
            padding: 2%;
            font-family: 'Roboto', sans-serif;
          `}
        >
          <Intro />
          <ControlPanel
            routes={routes}
            resetGraphData={this.props.resetGraphData}
            fetchGraphData={this.props.fetchGraphData}
            resetIntervalData={this.props.resetIntervalData}
            fetchIntervalData={this.props.fetchIntervalData}
            fetchData={this.props.fetchData}
          />
          <div
            className={css`
              grid-column-start: 1;
            `}
          >
            <div className="largeMarginTop">
              <MapStops />
            </div>
          </div>

          <div
            className={css`
              grid-column: col3-start;
              grid-row: row1-start / row2-end;
            `}
          >
            <Info
              graphData={graphData}
              graphError={graphError}
              graphParams={graphParams}
              routes={routes}
              intervalData={intervalData}
              intervalError={intervalError}
            />
          </div>
        </div>
      </Fragment>
    );
  }
}

const mapStateToProps = state => ({
  graphData: state.fetchGraph.graphData,
  routes: state.routes.routes,
  graphError: state.fetchGraph.err,
  intervalData: state.fetchGraph.intervalData,
  intervalError: state.fetchGraph.intervalErr,
  graphParams: state.fetchGraph.graphParams,
});

const mapDispatchToProps = dispatch => ({
  fetchData: (graphParams, intervalParams) =>
    dispatch(fetchData(graphParams, intervalParams)),
  resetGraphData: () => dispatch(resetGraphData()),
  fetchGraphData: params => dispatch(fetchGraphData(params)),
  resetIntervalData: () => dispatch(resetIntervalData()),
  fetchIntervalData: params => dispatch(fetchIntervalData(params)),
  fetchRoutes: () => dispatch(fetchRoutes()),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(Home);

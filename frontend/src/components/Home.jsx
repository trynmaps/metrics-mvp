import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { css } from 'emotion';
import MapStops from "./MapStops";
import ControlPanel from './ControlPanel';
import Info from './Info';
import Intro from './Intro';
import {
  fetchGraphData,
  fetchRoutes,
  fetchRouteConfig,
  resetGraphData,
} from '../actions';

class Home extends Component {
  componentDidMount() {
    if (!this.props.routes) {
      this.props.fetchRoutes();
    }
  }

  render() {
    const { graphData, graphError, graphParams, routes } = this.props;
    return (
      <div className={css`
        display: grid;
        grid-gap: 4px;
        grid-template-columns: [col1-start] 200px [col2-start] 300px  [col3-start] auto [col3-end];
        grid-template-rows: [row1-start] 80px [row2-start] 400px [row2-end];
        background-color: #fff;
        color: #444;
        padding: 2%;
        font-family: 'Roboto', sans-serif;
        `
      }
      >
        <Intro />
        <ControlPanel routes={routes}
          fetchRouteConfig={this.props.fetchRouteConfig}
          resetGraphData={this.props.resetGraphData}
          fetchGraphData={this.props.fetchGraphData} />
        <div className="center metricsWidth">
        <div>
        <MapStops />
        </div>
        </div>
        <Info graphData={graphData} graphError={graphError} graphParams={graphParams} routes={routes} />
      </div>
    );
  }
}

const mapStateToProps = state => ({
  graphData: state.fetchGraph.graphData,
  routes: state.routes.routes,
  graphError: state.fetchGraph.err,
  graphParams: state.fetchGraph.graphParams,
});

const mapDispatchToProps = dispatch => ({
  resetGraphData: params => dispatch(resetGraphData()),
  fetchGraphData: params => dispatch(fetchGraphData(params)),
  fetchRoutes: () => dispatch(fetchRoutes()),
  fetchRouteConfig: routeId => dispatch(fetchRouteConfig(routeId)),
});

Home.propTypes = {
  graphData: PropTypes.instanceOf(Object),
};

export default connect(mapStateToProps, mapDispatchToProps)(Home);

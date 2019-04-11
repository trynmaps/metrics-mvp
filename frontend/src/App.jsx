import React, { Component } from 'react';
import { css } from 'emotion';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import Intro from './components/Intro';
import { fetchGraphData, fetchRoutes, fetchRouteConfig, resetGraphData } from './actions/action';
import './App.css';
import ControlPanel from './components/ControlPanel';
import Info from './components/Info';

class App extends Component {
  constructor() {
    super();
    this.state = {};
  }

  componentDidMount() {
    if (!this.props.routes) {
      this.props.fetchRoutes();
    }
  }

  render() {
    const { graphData, graphError, routes } = this.props;
    debugger;
    return (
      <div className={css`
        display: grid;
        grid-gap: 4px;
        grid-template-columns: [col1-start] 300px [col2-start] 400px  [col3-start] auto [col3-end];
        grid-template-rows: [row1-start] 200px [row2-start] 400px [row2-end];
        background-color: #fff;
        color: #444;
        padding: 2%;
        `
      }
      >
        <Intro />
        TEST
        <ControlPanel routes={routes}
          fetchRouteConfig={this.props.fetchRouteConfig}
          resetGraphData={this.props.resetGraphData}
          fetchGraphData={this.props.fetchGraphData} />
        <div className="center metricsWidth">
        </div>
        <Info graphData={graphData} graphError={graphError} />
      </div>
    );
  }
}

const mapStateToProps = state => ({
  graphData: state.graphData.graphData,
  routes: state.routes.routes,
  graphError: state.graphData.err,
});

const mapDispatchToProps = dispatch => ({
  resetGraphData: params => dispatch(resetGraphData()),
  fetchGraphData: params => dispatch(fetchGraphData(params)),
  fetchRoutes: () => dispatch(fetchRoutes()),
  fetchRouteConfig: routeId => dispatch(fetchRouteConfig(routeId)),
});

App.propTypes = {
  graphData: PropTypes.instanceOf(Object),
};

export default connect(mapStateToProps, mapDispatchToProps)(App);

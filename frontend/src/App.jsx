import React, { Component } from 'react';
import { css } from 'emotion';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import Header from './components/Header';
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
    return (
      <div className="container">
        <Header />
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

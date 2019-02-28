import React, { Component } from 'react';
import { connect } from "react-redux";
import { bindActionCreators } from 'redux';
import { fetchGraphData } from "./actions/action";
import PropTypes from 'prop-types';
import './App.css';
import ControlPanel from './components/ControlPanel';
import Info from './components/Info';


class App extends Component {
  constructor() {
    super();
    this.state = 0;
  }
  componentDidMount() {
    const {fetchGraphData} = this.props;
    fetchGraphData();
  }
  render() {
    const {graphData} = this.props;
    return (
      <div>
        {graphData}
        <ControlPanel />
        <Info />
      </div>
    );
  }
}
 const mapToStateProps = (state) => {
    return {
      graphData: state.graphData.graphData
    };
  };

const mapDispatchToProps = dispatch => ({
  fetchGraphData: () => dispatch(fetchGraphData())
});

App.propTypes = {
  graphData: PropTypes.object,
  fetchGraphData: PropTypes.func
};
export default connect(mapToStateProps,mapDispatchToProps)(App);

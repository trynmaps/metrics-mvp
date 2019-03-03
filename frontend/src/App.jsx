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
  fetchAvgWaitHandler = (selected, date, time) => {
    const {fetchGraphData} = this.props;
    var ms = date.getTime() + 86400000;
    var tomorrow = new Date(ms);
    const formattedDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000 )).toISOString().split("T")[0];
    const formattedDate2 = new Date(tomorrow.getTime() - (tomorrow.getTimezoneOffset() * 60000 )).toISOString().split("T")[0];
    fetchGraphData([...selected, formattedDate,formattedDate2]);
  }
  render() {
    const {graphData} = this.props;
    return (
      <div>
        {graphData}
        <ControlPanel avgWaitHandler={this.fetchAvgWaitHandler} />
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
  fetchGraphData: (data) => dispatch(fetchGraphData(data))
});

App.propTypes = {
  graphData: PropTypes.object,
  fetchGraphData: PropTypes.func
};
export default connect(mapToStateProps,mapDispatchToProps)(App);

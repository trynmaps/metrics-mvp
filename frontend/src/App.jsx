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
    const formattedDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000 )).toISOString().split("T")[0];
    const values = {...selected};
    values['date'] = formattedDate;
    fetchGraphData(values);
  }
  render() {
    const {graphData} = this.props;
    return (
      <div>
        <ControlPanel avgWaitHandler={this.fetchAvgWaitHandler} />
        <div className="center metricsWidth">
          {graphData}
        </div>
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

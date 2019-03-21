import React, { Component } from 'react';
import { css } from 'emotion';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import Intro from './components/Intro';
import { fetchGraphData } from './actions/action';
import './App.css';
import ControlPanel from './components/ControlPanel';
import Info from './components/Info';


class App extends Component {
  constructor() {
    super();
    this.state = 0;
  }

  fetchAvgWaitHandler = (selected, date) => {
    const formattedDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const values = { ...selected };
    values.date = formattedDate;
    fetchGraphData(values);
  }

  render() {
    const { graphData } = this.props;
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
        <Intro avgWaitHandler={this.fetchAvgWaitHandler} />
        <ControlPanel avgWaitHandler={this.fetchAvgWaitHandler} />
        <div className="center metricsWidth">
          {graphData}
        </div>
        <Info />
      </div>
    );
  }
}
const mapToStateProps = state => ({
  graphData: state.graphData.graphData,
});

const mapDispatchToProps = dispatch => ({
  fetchGraphData: data => dispatch(fetchGraphData(data)),
});

App.propTypes = {
  graphData: PropTypes.instanceOf(Object).isRequired,
};
export default connect(mapToStateProps, mapDispatchToProps)(App);

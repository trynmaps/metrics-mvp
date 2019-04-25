import React, { Component } from 'react';
import { connect } from 'react-redux';

class About extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <h3>About Us</h3>
    );
  }
}

const mapStateToProps = (state) => {
  return state;
};

export default connect(mapStateToProps)(About);

import React, { Component } from 'react';
import PropTypes from 'prop-types';

class Control extends Component {
  constructor(props) {
    super(props);
    this.state = 0;
  }

  render() {
    const { name } = this.props;
    return (
      <div className="route-control">
        <label id="route-label" htmlFor="route-select">
          <select name={name} id="route-select">
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
          Route
        </label>
      </div>
    );
  }
}

Control.propTypes = {
  name: PropTypes.string.isRequired,
};

export default Control;

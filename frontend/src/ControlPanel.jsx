import React, { Component } from 'react';
import PropTypes from 'prop-types';

class ControlPanel extends Component {
  constructor(props) {
    super(props);
    this.state = 0;
  }

  render() {
    const { trynState } = this.props || {};
    return (
      <div>
        {trynState}
      </div>
    );
  }
}

ControlPanel.propTypes = {
  trynState: PropTypes.string.isRequired,
};

export default ControlPanel;

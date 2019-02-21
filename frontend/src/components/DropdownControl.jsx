import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Dropdown from 'react-bootstrap/Dropdown';

class DropdownControl extends Component {
  constructor(props) {
    super(props);
    this.state = { selected: [] };
  }

  render() {
    const { selected } = this.state;
    const {
      name,
      prettyName,
      options,
      variant,
      handleSelected,
    } = this.props;
    const controlClass = `${name}-control control`;
    const dropdownId = `${name}-dropdown`;
    return (
      <div className={controlClass}>
        <Dropdown>
          <Dropdown.Toggle variant={variant} id={dropdownId}>
            {prettyName}
          </Dropdown.Toggle>
          {selected}
          <Dropdown.Menu>
            {
              options.map((index, value) => (
                <Dropdown.Item onClick={handleSelected} key={index} eventKey={value} href="#">{value}</Dropdown.Item>
              ))
            }
          </Dropdown.Menu>
        </Dropdown>
      </div>
    );
  }
}

DropdownControl.propTypes = {
  name: PropTypes.string.isRequired,
  options: PropTypes.instanceOf(Array).isRequired,
  prettyName: PropTypes.string.isRequired,
  variant: PropTypes.string.isRequired,
  handleSelected: PropTypes.func.isRequired,
};

export default DropdownControl;

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
    const { obj } = this.props;
    const [
      handleSelected,
      prettyName,
      name,
      options,
      variant,
    ] = obj;

    const controlClass = `${name.name}-control control`;
    const dropdownId = `${name.name}-dropdown`;
    return (
      <div className={controlClass}>
        <Dropdown>
          <Dropdown.Toggle variant={variant.variant} id={dropdownId}>
            {prettyName.prettyName}
          </Dropdown.Toggle>
          {selected}
          <Dropdown.Menu>
            {
              options.options.map((index, value) => (
                <Dropdown.Item onClick={handleSelected.handleSelected} key={index} eventKey={value} href="#">{value}</Dropdown.Item>
              ))
            }
          </Dropdown.Menu>
        </Dropdown>
      </div>
    );
  }
}

DropdownControl.propTypes = {
  obj: PropTypes.instanceOf(Array).isRequired,
};

export default DropdownControl;

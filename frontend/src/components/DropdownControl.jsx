import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Dropdown from 'react-bootstrap/Dropdown';

class DropdownControl extends Component {
  constructor(props) {
    super(props);
    this.state = { };
  }

  handleSelectedValue = (eventKey, event) => {
    const { name, onSelect } = this.props;
    onSelect(eventKey, name);
  }

  render() {
    const { options, title, name, variant, value } = this.props;
    const selectedOption = (options || []).find(option => (option.key === value));
    const shownValue = value == null ? title : (title + ": " + (selectedOption ? selectedOption.label : value));

    return (
      <Dropdown>
        <Dropdown.Toggle variant={variant} id={name + "-dropdown"} className="btn-block">
          {shownValue}
        </Dropdown.Toggle>
        <Dropdown.Menu>
          {
            (options || []).map(option => (
              <Dropdown.Item onSelect={this.handleSelectedValue} key={option.key} eventKey={option.key} href="#">{option.label}</Dropdown.Item>
            ))
          }
        </Dropdown.Menu>
      </Dropdown>
    );
  }
}

DropdownControl.propTypes = {
  name: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  variant: PropTypes.string,
  options: PropTypes.instanceOf(Array).isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default DropdownControl;

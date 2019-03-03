import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Dropdown from 'react-bootstrap/Dropdown';

class DropdownControl extends Component {
  constructor(props) {
    super(props);
    this.state = { selected: [], selectedValue:null };
  }

  componentDidMount() {
    /*
    const {obj} = this.props;
    //const [prettyName] = obj;
    this.setState({selectedValue:obj[1].prettyName});
    */
  }
  handleSelectedValue = (event) => {
    const selectedValue = event.target.textContent;
    this.setState({selectedValue});
    this.props.handleSelected(selectedValue);
  }
  render() {
    const { selected, selectedValue} = this.state;
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
    const shownValue = selectedValue == null ? prettyName.prettyName : selectedValue;
    return (
      <div>
        <Dropdown>
          <Dropdown.Toggle variant={variant.variant} id={dropdownId}>
            {shownValue}
          </Dropdown.Toggle>
          {selected}
          <Dropdown.Menu>
            {
              options.options.map((value, index) => (
                <Dropdown.Item onClick={this.handleSelectedValue} key={index} eventKey={value} href="#">{value}</Dropdown.Item>
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

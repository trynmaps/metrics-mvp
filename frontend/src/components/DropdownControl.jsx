import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Dropdown from 'react-bootstrap/Dropdown';

class DropdownControl extends Component {
  constructor(props) {
    super(props);
    this.state = { selected: [], selectedValue: null };
  }

  componentDidMount() {
    /*
    const {obj} = this.props;
    //const [prettyName] = obj;
    this.setState({selectedValue:obj[1].prettyName});
    */
  }

  handleSelectedValue = (event) => {
    const { obj, handleSelected } = this.props;
    const [prettyName] = obj;
    const selectedValue = event.target.textContent;
    this.setState({ selectedValue });
    handleSelected(selectedValue, prettyName.prettyName);
  }

  render() {
    const { selected, selectedValue } = this.state;
    const { obj } = this.props;
    const [
      prettyName,
      name,
      options,
      variant,
    ] = obj;

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
              options.options.map(value => (
                <Dropdown.Item onClick={this.handleSelectedValue} eventKey={value} href="#">{value}</Dropdown.Item>
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
  handleSelected: PropTypes.func.isRequired,
};

export default DropdownControl;

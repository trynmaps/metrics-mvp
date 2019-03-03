import React, { Component } from 'react';
import DropdownControl from './DropdownControl';
import DatePicker from 'react-date-picker';
import TimeKeeper from 'react-timekeeper';

class ControlPanel extends Component {
  constructor(props) {
    super(props);
    this.state = { selected: [],
     date: new Date(),
     displayTimepicker: false,
     time: '6:50 am'
 };
    this.handleSelected = this.handleSelected.bind(this);
  }

  handleSelected(selected) {
    let selectedValue=selected;
    if(selected.indexOf('sid:')!== -1) {
      selectedValue = selected.split("sid:")[1];
    }
    this.setState(state => ({
      selected: [...state.selected, selectedValue],
    }));
  }

    onChange = date => this.setState({ date });

    handleTimeChange(newTime){
        this.setState({ time: newTime.formatted})
    }
    toggleTimekeeper(val){
        this.setState({displayTimepicker: val})
    }
    onSubmit = () => {
      const {avgWaitHandler} = this.props;
      const {selected, date, time} = this.state;
      debugger;
      avgWaitHandler([...selected], date, time);
    }   
  render() {
    const {date, time} = this.state;

    return (
      <div>
      <div className="controls-wrapper">
         <DatePicker value ={date} onChange={this.onChange} />
         {/*<div>
                {this.state.displayTimepicker ?
                    <TimeKeeper
                        time={this.state.time}
                        onChange={this.handleTimeChange}
                        onDoneClick={() => {
                            this.toggleTimekeeper(false)
                        }}
                        switchToMinuteOnHourSelect={true}
                    />
                    :
                    false
                }
                <span>Time is {this.state.time}</span>
                <button onClick={() => this.toggleTimekeeper(true)}>Modify Time</button>
            </div> */}
            <DropdownControl handleSelected ={this.handleSelected} obj={[{ handleSelected: this.handleSelected }, { prettyName: 'Route' }, { name: 'route' }, { options: [37] }, { variant: 'primary' }]} />
            <DropdownControl handleSelected ={this.handleSelected} obj={[{ handleSelected: this.handleSelected }, { prettyName: 'From Stop' }, { name: 'from-stop' }, { options: ["Clay St & Drumm St sid:4015", "Sacramento St & Davis St sid:6294", "Sacramento St & Battery St sid:6290", "Sacramento St & Sansome St sid:6314", "Sacramento St & Montgomery St sid:6307", "Sacramento St & Kearny St sid:6302", "Sacramento St & Grant Ave sid:6299", "Sacramento St & Stockton St sid:6316", "Sacramento St & Powell St sid:6312", "Sacramento St & Sproule Ln sid:6315", "Sacramento St & Jones St sid:6301", "Sacramento St & Leavenworth St sid:6304", "Sacramento St & Hyde St sid:6300", "Sacramento St & Larkin St sid:6303", "Sacramento St & Polk St sid:6311", "Sacramento St & Van Ness Ave sid:6317", "Sacramento St & Franklin St sid:6297", "Sacramento St & Gough St sid:6298", "Sacramento St & Octavia St sid:6309", "Sacramento St & Laguna St sid:6305", "Sacramento St & Buchanan St sid:6291", "Sacramento St & Webster St sid:6319", "Sacramento St & Fillmore St sid:6295", "Steiner St & California St sid:6486", "California St & Pierce St sid:3884", "California St & Divisadero St sid:3858", "California St & Baker St sid:3847", "California St & Presidio Ave sid:3892", "California St & Laurel St sid:3875", "California St & Spruce St sid:3896", "California St & Cherry St sid:3852", "California St & Arguello Blvd sid:3845", "California St & 4th Ave sid:3822", "California St & 6th Ave sid:3824", "California St & 8th Ave sid:7160", "California St & 10th Ave sid:3828", "California St & 12th Ave sid:3831", "California St & Park Presidio Blvd sid:3886", "California St & 16th Ave sid:3833", "California St & 19th Ave sid:3835", "California St & 22nd Ave sid:3837", "California St & 25th Ave sid:3839", "California St & 28th Ave sid:3841", "California St & 30th Ave sid:3843", "32nd Ave & California St sid:3547", "32nd Ave & Clement St sid:3549", "32nd Ave & Geary Blvd sid:3550", "Geary Blvd & 33rd Ave sid:34277", "California St & Baker St sid:3848", "California St & Divisadero St sid:3859", "California St & Pierce St sid:3885", "Steiner St & Sacramento St sid:6489", "Sacramento St & Fillmore St sid:6296", "Sacramento St & Webster St sid:6320", "Sacramento St & Buchanan St sid:6292", "Sacramento St & Laguna St sid:6306", "Sacramento St & Octavia St sid:6310", "Gough St & Sacramento St sid:4905", "Clay St & Franklin St sid:4016", "Clay St & Van Ness Ave sid:4031", "Clay St & Polk St sid:4026", "Clay St & Larkin St sid:4022", "Clay St & Hyde St sid:4019", "Clay St & Leavenworth St sid:4023", "Clay St & Jones St sid:4020", "Clay St & Taylor St sid:4030", "Clay St & Mason St sid:4024", "Clay St & Powell St sid:4027", "Clay St & Stockton St sid:4029", "Clay St & Grant Ave sid:4018", "Clay St & Kearny St sid:4021", "Clay St & Montgomery St sid:4025", "Clay St & Sansome St sid:4028", "Clay St & Front St sid:4017", "Clay St & Drumm St sid:34015", "Geary Blvd & 33rd Ave sid:4277", "33rd Ave & Clement St sid:3555", "32nd Ave & Clement St sid:3548", "32nd Ave & California St sid:3546", "California St & 30th Ave sid:3844", "California St & 28th Ave sid:3842", "California St & 25th Ave sid:3840", "California St & 22nd Ave sid:3838", "California St & 19th Ave sid:3836", "California St & 16th Ave sid:3834", "California St & Park Presidio Blvd SW sid:3887", "California St & 12th Ave sid:3832", "California St & 10th Ave sid:3830", "California St & 8th Ave sid:3827", "California St & 6th Ave sid:3825", "California St & 4th Ave sid:3823", "California St & Arguello Blvd sid:3846", "California St & Cherry St sid:3853", "California St & Spruce St sid:3897", "California St & Laurel St sid:3876", "California St & Presidio Ave sid:3893"] }, { variant: 'secondary' }]} />
            <DropdownControl handleSelected ={this.handleSelected} obj={[{ handleSelected: this.handleSelected }, { prettyName: 'Direction' }, { name: 'direction' }, { options: ["inbound","outbound"] }, { variant: 'info' }]} />
            </div>
            <div className="center">
            <button onClick={this.onSubmit}> Run Query </button>
            </div>
            { /*<div className="controls-wrapper"> <DropdownControl obj={[{ handleSelected: this.handleSelected }, { prettyName: 'Route' }, { name: 'route' }, { options: [1, 2, 3, 4, 5] }, { variant: 'primary' }]} />
        <DropdownControl obj={[{ handleSelected: this.handleSelected }, { prettyName: 'From Stop' }, { name: 'from-stop' }, { options: [1, 2, 3, 4, 5] }, { variant: 'secondary' }]} />
        <DropdownControl obj={[{ handleSelected: this.handleSelected }, { prettyName: 'Direction' }, { name: 'direction' }, { options: [1, 2, 3, 4, 5] }, { variant: 'success' }]} />
        <DropdownControl obj={[{ handleSelected: this.handleSelected }, { prettyName: 'To Stop' }, { name: 'to-stop' }, { options: [1, 2, 3, 4, 5] }, { variant: 'info' }]} />
        <DropdownControl obj={[{ handleSelected: this.handleSelected }, { prettyName: 'Days of Week' }, { name: 'days-of-week' }, { options: [1, 2, 3, 4, 5] }, { variant: 'warning' }]} />
        <DropdownControl obj={[{ handleSelected: this.handleSelected }, { prettyName: 'Time of Day' }, { name: 'time-of-day' }, { options: [1, 2, 3, 4, 5] }, { variant: 'danger' }]} />
        </div>
      */}
            </div>
        
     
    );
  }
}


export default ControlPanel;

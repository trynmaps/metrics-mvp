import React, { Component } from 'react';
import DropdownControl from './DropdownControl';
import DatePicker from 'react-date-picker';
import TimeKeeper from 'react-timekeeper';

class ControlPanel extends Component {
  constructor(props) {
    super(props);
    this.state = { selected: [],
     date: new Date('2019-02-01T03:50'),
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
            <DropdownControl handleSelected ={this.handleSelected} obj={[{ handleSelected: this.handleSelected }, { prettyName: 'Route' }, { name: 'route' }, { options: [12] }, { variant: 'primary' }]} />
            <DropdownControl handleSelected ={this.handleSelected} obj={[{ handleSelected: this.handleSelected }, { prettyName: 'From Stop' }, { name: 'from-stop' }, { options: ["Jackson St & Van Ness Av s sid:7941", "Pacific Ave & Van Ness Ave sid:5859", "Pacific Ave & Polk St sid:5851", "Pacific Ave & Larkin St sid:5844", "Pacific Ave & Hyde St sid:5839", "Pacific Ave & Leavenworth St sid:5846", "Pacific Ave & Jones St sid:5841", "Pacific Ave & Taylor St sid:5857", "Pacific Ave & Mason St sid:5848", "Pacific Ave & Powell St sid:5853", "Broadway & Stockton St sid:3087", "Broadway & Columbus Ave sid:3082", "Broadway & Montgomery St sid:3084", "Broadway & Sansome St sid:7862", "Sansome St & Jackson St sid:7863", "Sansome St & Clay St sid:6328", "Sansome St & California St sid:6327", "Sansome St & Sutter St sid:6334", "2nd St & Howard St sid:3011", "Harrison St & 2nd St sid:4966", "Harrison St & 3rd St sid:4967", "Harrison St & 4th St sid:4968", "Harrison St & 5th St sid:4969", "Harrison St & 6th St sid:4970", "Harrison St & 7th St sid:4971", "Harrison St & 8th St sid:4972", "Harrison St & 9th St sid:4973", "11th St & Harrison St sid:3238", "Folsom St & 11th St sid:4665", "Folsom St & 14th St sid:4666", "Folsom St & 16th St sid:4669", "Folsom St & 18th St sid:4672", "Folsom St & 20th St sid:7732", "Folsom St & 22nd St sid:4676", "Folsom St & 24th St sid:7312", "Folsom St & 25th St sid:4680", "Cesar Chavez St & Folsom St sid:3931", "Cesar Chavez St & South Van Ness Ave sid:3936", "Cesar Chavez St & Mission St sid:3935", "Valencia St & Cesar Chavez St sid:6881", "Valencia St & 25th St sid:6878", "24th St & Valencia St sid:3486", "24th St & Mission St sid:3477", "24th St & Mission St sid:33476", "24th St & Mission St sid:3476", "Valencia St & 24th St sid:6877", "Valencia St & 25th St sid:6879", "Cesar Chavez St & Valencia St sid:7592", "Cesar Chavez St & Mission St sid:7551", "Folsom St & Cesar Chavez St sid:7552", "Folsom St & 25th St sid:4681", "Folsom St & 24th St sid:4677", "Folsom St & 22nd St sid:4675", "Folsom St & 20th St sid:7733", "Folsom St & 18th St sid:4671", "Folsom St & 16th St sid:4668", "Folsom St & 14th St sid:4667", "Folsom St & 11th St sid:4664", "Folsom St & 9th St sid:4663", "Folsom St & 8th St sid:4662", "Folsom St & 7th St sid:4661", "Folsom St & 6th St sid:4660", "Folsom St & 5th St sid:4659", "Folsom St & 4th St sid:4658", "Folsom St & 3rd St sid:4657", "2nd St & Stevenson St sid:7549", "Sansome St & Sutter St sid:7550", "Sansome St & Pine St sid:6332", "Sansome St & Sacramento St sid:6333", "Sansome St & Washington St sid:6337", "Pacific Ave & Sansome St sid:5854", "Pacific Ave & Montgomery St sid:5849", "Pacific Ave & Kearny St sid:5842", "Pacific Ave & Grant Ave sid:5837", "Pacific Ave & Stockton St sid:7737", "Pacific Ave & Powell St sid:5852", "Pacific Ave & Mason St sid:5847", "Pacific Ave & Taylor St sid:5856", "Pacific Ave & Jones St sid:5840", "Pacific Ave & Leavenworth St sid:5845", "Pacific Ave & Hyde St sid:5838", "Pacific Ave & Larkin St sid:5843", "Pacific Ave & Polk St sid:5850", "Jackson St & Polk St sid:7203", "Jackson St & Van Ness Av s sid:37941"] }, { variant: 'secondary' }]} />
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

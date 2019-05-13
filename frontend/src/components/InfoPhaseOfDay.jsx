import React, { Component } from 'react';
import { BarChart } from 'react-d3-components';
import { XYPlot, VerticalGridLines, HorizontalGridLines, XAxis, YAxis,
    VerticalBarSeries, MarkSeries, ChartLabel, Crosshair } from 'react-vis';
import DiscreteColorLegend from 'react-vis/dist/legends/discrete-color-legend';
import Form from 'react-bootstrap/Form';
import Card from 'react-bootstrap/Card';
import * as d3 from "d3";

class InfoPhaseOfDay extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      selectedOption: "average_time",
      crosshairValues: [],
    };
  }


  handleOptionChange = changeEvent => {
    this.setState({
      selectedOption: changeEvent.target.value
    });
  };

  /**
   * Helper method to get a specific percentile out of histogram graph data
   * where percentile is 0-100.
   */
  getPercentileValue(histogram, percentile) {
    const bin = histogram.percentiles.find(x => x.percentile === percentile);
    if (bin) {
      return bin.value;
    } else {
      return 0;
    }
  }
  
  computeGrades(headwayMin, waitTimes, tripTimes, speed) {
  
    //
    // grade and score for average wait
    //
    
    const averageWaitScoreScale = d3.scaleLinear()
    .domain([5, 10])
    .rangeRound([100, 0])
    .clamp(true);
    
    const averageWaitGradeScale = d3.scaleThreshold()
    .domain([5, 7.5, 10])
    .range(["A", "B", "C", "D"]);
    
    //
    // grade and score for long wait probability
    // 
    // where probability of 20 min wait is:
    //   the sum of counts of bins whose range starts at 20 or more, divided by count
    //

    let reducer = (accumulator, currentValue, index) =>  {
      const LONG_WAIT = 20; // histogram bins are in minutes
      return currentValue.bin_start >= LONG_WAIT ? (accumulator + currentValue.count) : accumulator;
    }
    
    let longWaitProbability = 0;
    if (headwayMin) {
      longWaitProbability = waitTimes.histogram.reduce(reducer, 0);
      longWaitProbability /= waitTimes.count;
    }
    
    const longWaitScoreScale = d3.scaleLinear()
    .domain([0.10, 0.33])
    .rangeRound([100, 0])
    .clamp(true);
    
    const longWaitGradeScale = d3.scaleThreshold()
    .domain([0.10, 0.20, 0.33])
    .range(["A", "B", "C", "D"]);

    // grade and score for travel speed
    
    const speedScoreScale = d3.scaleLinear()
    .domain([5, 10])
    .rangeRound([0, 100])
    .clamp(true);
    
    const speedGradeScale = d3.scaleThreshold()
    .domain([5, 7.5, 10])
    .range(["D", "C", "B", "A"]);
        
    //
    // grade score for travel time variability
    //
    // where variance is 90th percentile time minus average time
    //
    
    let travelVarianceTime = 0;
    if (tripTimes) {
        travelVarianceTime = this.getPercentileValue(tripTimes, 90) - tripTimes.avg;
    }
    
    const travelVarianceScoreScale = d3.scaleLinear()
    .domain([5, 10])
    .rangeRound([100, 0])
    .clamp(true);
    
    const travelVarianceGradeScale = d3.scaleThreshold()
    .domain([5, 7.5, 10])
    .range(["A", "B", "C", "D"]);
    
    
    const totalGradeScale = d3.scaleThreshold()
    .domain([100, 200, 300])
    .range(["D", "C", "B", "A"]);

    let averageWaitScore = 0, averageWaitGrade = "";
    let longWaitScore = 0, longWaitGrade = "";
    let speedScore = 0, speedGrade = "";
    let travelVarianceScore = 0, travelVarianceGrade = "";
    let totalScore = 0, totalGrade = "";
    
    
    if (headwayMin) {    
      averageWaitScore = averageWaitScoreScale(waitTimes.avg); 
      averageWaitGrade = averageWaitGradeScale(waitTimes.avg)

      longWaitScore = longWaitScoreScale(longWaitProbability);
      longWaitGrade = longWaitGradeScale(longWaitProbability);

      speedScore = speedScoreScale(speed);
      speedGrade = speedGradeScale(speed);
                     
      travelVarianceScore = travelVarianceScoreScale(travelVarianceTime);
      travelVarianceGrade = travelVarianceGradeScale(travelVarianceTime);

      totalScore = averageWaitScore + longWaitScore + speedScore + travelVarianceScore;
      totalGrade = totalGradeScale(totalScore);
    }
    
    return {
      averageWaitScore,
      averageWaitGrade,
      longWaitProbability,
      longWaitScore,
      longWaitGrade,
      speedScore,
      speedGrade,
      travelVarianceTime,
      travelVarianceScore,
      travelVarianceGrade,
      totalScore,
      totalGrade,
      highestPossibleScore: 400
    }
  
  }
  
  /**
   * Returns the distance between two stops in miles. 
   */
  milesBetween(p1, p2) {
    const meters = this.haverDistance(p1.lat, p1.lon, p2.lat, p2.lon);
    return meters / 1609.344; 
  }
  
  /**
   * Haversine formula for calcuating distance between two coordinates in lat lon
   * from bird eye view; seems to be +- 8 meters difference from geopy distance.
   *
   * From eclipses.py.  Returns distance in meters.
   */
  haverDistance(latstop,lonstop,latbus,lonbus) {

    const deg2rad = x => x * Math.PI / 180;
     
    [latstop,lonstop,latbus,lonbus] = [latstop,lonstop,latbus,lonbus].map(deg2rad);
    const eradius = 6371000;

    const latdiff = (latbus-latstop);
    const londiff = (lonbus-lonstop);

    const a = Math.sin(latdiff/2)**2 + Math.cos(latstop) * Math.cos(latbus) * Math.sin(londiff/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    const distance = eradius * c;
    return distance;
  }
  
  
  computeDistance(graphParams, routes) {

    let miles = 0;
        
    if (graphParams && graphParams.end_stop_id) {
      const directionId = graphParams.direction_id;
      const routeId = graphParams.route_id;
    
      const route = routes.find(route => route.id === routeId);
      const stopSequence = route.directions.find(dir => dir.id === directionId).stops;
      const startIndex = stopSequence.indexOf(graphParams.start_stop_id);
      const endIndex = stopSequence.indexOf(graphParams.end_stop_id);

      for (let i = startIndex; i < endIndex; i++) {
        const fromStopInfo = route.stops[stopSequence[i]];
        const toStopInfo = route.stops[stopSequence[i+1]];
        miles += this.milesBetween(fromStopInfo, toStopInfo);
      }
    }
    
    return miles;
  }

  /**
   * Event handler for onMouseLeave.
   * @private
   */
  _onMouseLeave = () => {
    this.setState({crosshairValues: []});
  };

  /**
   * Event handler for onNearestX.
   * @param {Object} value Selected value.
   * @param {index} index Index of the value in the data array.
   * @private
   */
  _onNearestX = (value, {index}) => {
    this.setState({crosshairValues: [this.data[index], this.data[index]]});
  };
  
  
  
  render() {
    const { graphData, graphError, graphParams, routes } = this.props;

    let headwayMin = graphData ? graphData.headway_min : null;
    headwayMin.histogram = headwayMin.histogram.slice(0, 5);
    
    const waitTimes = graphData ? graphData.wait_times : null;
    const tripTimes = graphData ? graphData.trip_times : null;
  
    const distance = this.computeDistance(graphParams, routes);
    const speed = tripTimes ? (distance / (tripTimes.avg / 60.0)).toFixed(1) : 0; // convert avg trip time to hours for mph
    const grades = this.computeGrades(headwayMin, waitTimes, tripTimes, speed);



    const data = headwayMin.histogram.map((bin, index) => ({ x: index, y: bin.count }));
    this.data = data;
    const legendItems = [
      { title: 'Travel time', color: '#aa82c5', strokeWidth: 10 },  
      { title: 'Wait time', color: '#a4a6a9', strokeWidth: 10 }
      ];
    

    var myColor = d3.scaleOrdinal().domain(["Waiting time", "Travel time"])
      .range(["#a4a6a9", "#aa82c5"]); // gray and purple from nyc busstats
      
    var tooltipScatter = function(label, y0, total) {
      return "label: " + label + " y0: " + y0;
    };
    
          
       
    return (
      <div>
        {headwayMin
          ? (<div>
            <Card>
              <Card.Body>
              <Card.Title>Performance by Time of Day</Card.Title>

              <Form>
              <div className="controls">
                <Form.Check inline
                  id="average_time"
                  type="radio"
                  label="Average"
                  value="average_time"
                  checked={this.state.selectedOption === "average_time"}
                  onChange={this.handleOptionChange} 
                  />
                  
                <Form.Check inline
                  id="planning_time"
                  type="radio"
                  label="Planning"
                  value="planning_time"
                  checked={this.state.selectedOption === "planning_time"}
                  onChange={this.handleOptionChange}
                  /> 
              </div>
              </Form>

            <Card><Card.Body>
            <XYPlot height={300} width= {300} stackBy="y" onMouseLeave={this._onMouseLeave} >
              <HorizontalGridLines />
              <XAxis />
              <YAxis hideLine />
              
              <VerticalBarSeries data={ this.data }
                 color="#a4a6a9"
                 onNearestX={this._onNearestX} />
              <VerticalBarSeries data={ data /* todo: put different series here */ } 
                 color="#aa82c5" />
                 
              <ChartLabel 
                text="minutes"
                className="alt-y-label"
                includeMargin={false}
                xPercent={0.06}
                yPercent={0.06}
                style={{
                  transform: 'rotate(-90)',
                  textAnchor: 'end'
                }}       
              />       
                 
              { this.state.crosshairValues.length > 0 && (<Crosshair values={this.state.crosshairValues}
                 style={{line:{background: 'none'}}} >
  <div className= 'rv-crosshair__inner__content'>
    <p>Onboard time: { this.state.crosshairValues[1].y}</p>
    <p>Wait time: { this.state.crosshairValues[0].y}</p>
  </div>                 
              </Crosshair>)}
                 
            </XYPlot>
            <DiscreteColorLegend orientation="horizontal" width={300} items={legendItems}/>
            </Card.Body></Card>

            <Card><Card.Body>
            <BarChart
              data={[
                { label: 'Waiting time', values: headwayMin.histogram.map(bin => ({ x: `${bin.value}`, y: bin.count })) }, 
                { label: 'Travel time', values: headwayMin.histogram.map(bin => ({ x: `${bin.value}`, y: bin.count })) }
              ]}
              width={Math.max(100, headwayMin.histogram.length * 70)}
              colorScale={ myColor }
              height={200}
              margin={
                  {
                    top: 10,
                    bottom: 30,
                    left: 50,
                    right: 10,
                  }
                }
              xAxis={{label: "time of day"}}
              barPadding={0.3}
              yAxis={{innerTickSize: 10, label: "minutes", tickArguments: [5]}}
              tooltipContained
              tooltipMode={"element"}
              tooltipHtml={ tooltipScatter }
            />
            </Card.Body></Card>
            </Card.Body></Card>
            </div>
          ) : null }
        <code>
          {graphError || ''}
        </code>
      </div>
    );
  }
  
  dummyData =
  {
    "intervals": [
        {
            "start_time": "09:00",
            "end_time": "10:00",
            "headway_min": {
                "count": 5,
                "avg": 10.936666666666664,
                "std": 5.4460729990619035,
                "min": 3.3833333333333333,
                "median": 11.45,
                "max": 19.3,
                "histogram": [
                    {
                        "value": "0-5",
                        "count": 1,
                        "bin_start": 0,
                        "bin_end": 5
                    },
                    {
                        "value": "5-10",
                        "count": 1,
                        "bin_start": 5,
                        "bin_end": 10
                    },
                    {
                        "value": "10-15",
                        "count": 2,
                        "bin_start": 10,
                        "bin_end": 15
                    },
                    {
                        "value": "15-20",
                        "count": 1,
                        "bin_start": 15,
                        "bin_end": 20
                    }
                ],
                "percentiles": [
                    {
                        "percentile": 0,
                        "value": 3.3833333333333333
                    },
                    {
                        "percentile": 5,
                        "value": 4.126666666666667
                    },
                    {
                        "percentile": 10,
                        "value": 4.869999999999999
                    },
                    {
                        "percentile": 15,
                        "value": 5.613333333333333
                    },
                    {
                        "percentile": 20,
                        "value": 6.3566666666666665
                    },
                    {
                        "percentile": 25,
                        "value": 7.1
                    },
                    {
                        "percentile": 30,
                        "value": 7.969999999999999
                    },
                    {
                        "percentile": 35,
                        "value": 8.84
                    },
                    {
                        "percentile": 40,
                        "value": 9.71
                    },
                    {
                        "percentile": 45,
                        "value": 10.58
                    },
                    {
                        "percentile": 50,
                        "value": 11.45
                    },
                    {
                        "percentile": 55,
                        "value": 11.849999999999998
                    },
                    {
                        "percentile": 60,
                        "value": 12.25
                    },
                    {
                        "percentile": 65,
                        "value": 12.649999999999999
                    },
                    {
                        "percentile": 70,
                        "value": 13.049999999999997
                    },
                    {
                        "percentile": 75,
                        "value": 13.45
                    },
                    {
                        "percentile": 80,
                        "value": 14.62
                    },
                    {
                        "percentile": 85,
                        "value": 15.79
                    },
                    {
                        "percentile": 90,
                        "value": 16.96
                    },
                    {
                        "percentile": 95,
                        "value": 18.13
                    },
                    {
                        "percentile": 100,
                        "value": 19.3
                    }
                ]
            },
            "wait_times": {
                "first_bus": "09:03:25",
                "last_bus": "09:58:06",
                "count": 60,
                "avg": 6.916666666666668,
                "std": 5.050841514044961,
                "min": 0.1,
                "median": 6.033333333333333,
                "max": 19.683333333333334,
                "histogram": [
                    {
                        "value": "0-5",
                        "count": 26,
                        "bin_start": 0,
                        "bin_end": 5
                    },
                    {
                        "value": "5-10",
                        "count": 18,
                        "bin_start": 5,
                        "bin_end": 10
                    },
                    {
                        "value": "10-15",
                        "count": 11,
                        "bin_start": 10,
                        "bin_end": 15
                    },
                    {
                        "value": "15-20",
                        "count": 5,
                        "bin_start": 15,
                        "bin_end": 20
                    }
                ],
                "percentiles": [
                    {
                        "percentile": 0,
                        "value": 0.1
                    },
                    {
                        "percentile": 5,
                        "value": 0.7808333333333335
                    },
                    {
                        "percentile": 10,
                        "value": 0.9633333333333334
                    },
                    {
                        "percentile": 15,
                        "value": 1.535
                    },
                    {
                        "percentile": 20,
                        "value": 2.2933333333333334
                    },
                    {
                        "percentile": 25,
                        "value": 2.6499999999999995
                    },
                    {
                        "percentile": 30,
                        "value": 3.43
                    },
                    {
                        "percentile": 35,
                        "value": 3.8458333333333328
                    },
                    {
                        "percentile": 40,
                        "value": 4.51
                    },
                    {
                        "percentile": 45,
                        "value": 5.42
                    },
                    {
                        "percentile": 50,
                        "value": 6.033333333333333
                    },
                    {
                        "percentile": 55,
                        "value": 6.61
                    },
                    {
                        "percentile": 60,
                        "value": 7.49
                    },
                    {
                        "percentile": 65,
                        "value": 8.406666666666666
                    },
                    {
                        "percentile": 70,
                        "value": 9.403333333333332
                    },
                    {
                        "percentile": 75,
                        "value": 10.399999999999999
                    },
                    {
                        "percentile": 80,
                        "value": 11.396666666666667
                    },
                    {
                        "percentile": 85,
                        "value": 12.428333333333333
                    },
                    {
                        "percentile": 90,
                        "value": 13.783333333333335
                    },
                    {
                        "percentile": 95,
                        "value": 16.73333333333333
                    },
                    {
                        "percentile": 100,
                        "value": 19.683333333333334
                    }
                ]
            },
            "trip_times": {
                "start_stop": "3994",
                "end_stop": "5417",
                "count": 6,
                "avg": 19.025000000000002,
                "std": 2.3074506936668664,
                "min": 17.1,
                "median": 17.891666666666666,
                "max": 23.383333333333333,
                "histogram": [
                    {
                        "value": "0-5",
                        "count": 0,
                        "bin_start": 0,
                        "bin_end": 5
                    },
                    {
                        "value": "5-10",
                        "count": 0,
                        "bin_start": 5,
                        "bin_end": 10
                    },
                    {
                        "value": "10-15",
                        "count": 0,
                        "bin_start": 10,
                        "bin_end": 15
                    },
                    {
                        "value": "15-20",
                        "count": 4,
                        "bin_start": 15,
                        "bin_end": 20
                    },
                    {
                        "value": "20-25",
                        "count": 2,
                        "bin_start": 20,
                        "bin_end": 25
                    }
                ],
                "percentiles": [
                    {
                        "percentile": 0,
                        "value": 17.1
                    },
                    {
                        "percentile": 5,
                        "value": 17.116666666666667
                    },
                    {
                        "percentile": 10,
                        "value": 17.133333333333333
                    },
                    {
                        "percentile": 15,
                        "value": 17.15
                    },
                    {
                        "percentile": 20,
                        "value": 17.166666666666668
                    },
                    {
                        "percentile": 25,
                        "value": 17.241666666666667
                    },
                    {
                        "percentile": 30,
                        "value": 17.316666666666666
                    },
                    {
                        "percentile": 35,
                        "value": 17.391666666666666
                    },
                    {
                        "percentile": 40,
                        "value": 17.466666666666665
                    },
                    {
                        "percentile": 45,
                        "value": 17.679166666666664
                    },
                    {
                        "percentile": 50,
                        "value": 17.891666666666666
                    },
                    {
                        "percentile": 55,
                        "value": 18.104166666666668
                    },
                    {
                        "percentile": 60,
                        "value": 18.316666666666666
                    },
                    {
                        "percentile": 65,
                        "value": 18.916666666666668
                    },
                    {
                        "percentile": 70,
                        "value": 19.516666666666666
                    },
                    {
                        "percentile": 75,
                        "value": 20.116666666666664
                    },
                    {
                        "percentile": 80,
                        "value": 20.716666666666665
                    },
                    {
                        "percentile": 85,
                        "value": 21.383333333333333
                    },
                    {
                        "percentile": 90,
                        "value": 22.049999999999997
                    },
                    {
                        "percentile": 95,
                        "value": 22.71666666666667
                    },
                    {
                        "percentile": 100,
                        "value": 23.383333333333333
                    }
                ]
            }
        },
        {
            "start_time": "10:00",
            "end_time": "11:00",
            "headway_min": {
                "count": 5,
                "avg": 7.633333333333335,
                "std": 3.4227669119198483,
                "min": 0.9833333333333333,
                "median": 8.883333333333333,
                "max": 10.55,
                "histogram": [
                    {
                        "value": "0-5",
                        "count": 1,
                        "bin_start": 0,
                        "bin_end": 5
                    },
                    {
                        "value": "5-10",
                        "count": 3,
                        "bin_start": 5,
                        "bin_end": 10
                    },
                    {
                        "value": "10-15",
                        "count": 1,
                        "bin_start": 10,
                        "bin_end": 15
                    }
                ],
                "percentiles": [
                    {
                        "percentile": 0,
                        "value": 0.9833333333333333
                    },
                    {
                        "percentile": 5,
                        "value": 2.4066666666666667
                    },
                    {
                        "percentile": 10,
                        "value": 3.83
                    },
                    {
                        "percentile": 15,
                        "value": 5.253333333333333
                    },
                    {
                        "percentile": 20,
                        "value": 6.676666666666667
                    },
                    {
                        "percentile": 25,
                        "value": 8.1
                    },
                    {
                        "percentile": 30,
                        "value": 8.256666666666666
                    },
                    {
                        "percentile": 35,
                        "value": 8.413333333333332
                    },
                    {
                        "percentile": 40,
                        "value": 8.57
                    },
                    {
                        "percentile": 45,
                        "value": 8.726666666666667
                    },
                    {
                        "percentile": 50,
                        "value": 8.883333333333333
                    },
                    {
                        "percentile": 55,
                        "value": 9.036666666666667
                    },
                    {
                        "percentile": 60,
                        "value": 9.19
                    },
                    {
                        "percentile": 65,
                        "value": 9.343333333333334
                    },
                    {
                        "percentile": 70,
                        "value": 9.496666666666666
                    },
                    {
                        "percentile": 75,
                        "value": 9.65
                    },
                    {
                        "percentile": 80,
                        "value": 9.830000000000002
                    },
                    {
                        "percentile": 85,
                        "value": 10.010000000000002
                    },
                    {
                        "percentile": 90,
                        "value": 10.190000000000001
                    },
                    {
                        "percentile": 95,
                        "value": 10.370000000000001
                    },
                    {
                        "percentile": 100,
                        "value": 10.55
                    }
                ]
            },
            "wait_times": {
                "first_bus": "10:08:03",
                "last_bus": "10:46:13",
                "count": 44,
                "avg": 4.78560606060606,
                "std": 3.1620173023829783,
                "min": 0.05,
                "median": 4.691666666666666,
                "max": 11.183333333333334,
                "histogram": [
                    {
                        "value": "0-5",
                        "count": 23,
                        "bin_start": 0,
                        "bin_end": 5
                    },
                    {
                        "value": "5-10",
                        "count": 19,
                        "bin_start": 5,
                        "bin_end": 10
                    },
                    {
                        "value": "10-15",
                        "count": 2,
                        "bin_start": 10,
                        "bin_end": 15
                    }
                ],
                "percentiles": [
                    {
                        "percentile": 0,
                        "value": 0.05
                    },
                    {
                        "percentile": 5,
                        "value": 0.21916666666666668
                    },
                    {
                        "percentile": 10,
                        "value": 0.7183333333333333
                    },
                    {
                        "percentile": 15,
                        "value": 1.1300000000000001
                    },
                    {
                        "percentile": 20,
                        "value": 1.4533333333333331
                    },
                    {
                        "percentile": 25,
                        "value": 2.0125
                    },
                    {
                        "percentile": 30,
                        "value": 2.5883333333333334
                    },
                    {
                        "percentile": 35,
                        "value": 3.1041666666666665
                    },
                    {
                        "percentile": 40,
                        "value": 3.6566666666666667
                    },
                    {
                        "percentile": 45,
                        "value": 4.129166666666666
                    },
                    {
                        "percentile": 50,
                        "value": 4.691666666666666
                    },
                    {
                        "percentile": 55,
                        "value": 5.154166666666667
                    },
                    {
                        "percentile": 60,
                        "value": 5.726666666666667
                    },
                    {
                        "percentile": 65,
                        "value": 6.179166666666666
                    },
                    {
                        "percentile": 70,
                        "value": 6.784999999999999
                    },
                    {
                        "percentile": 75,
                        "value": 7.295833333333333
                    },
                    {
                        "percentile": 80,
                        "value": 7.889999999999999
                    },
                    {
                        "percentile": 85,
                        "value": 8.430833333333332
                    },
                    {
                        "percentile": 90,
                        "value": 9.053333333333335
                    },
                    {
                        "percentile": 95,
                        "value": 9.7325
                    },
                    {
                        "percentile": 100,
                        "value": 11.183333333333334
                    }
                ]
            },
            "trip_times": {
                "start_stop": "3994",
                "end_stop": "5417",
                "count": 6,
                "avg": 19.236111111111114,
                "std": 1.432183539689668,
                "min": 16.716666666666665,
                "median": 19.55,
                "max": 20.733333333333334,
                "histogram": [
                    {
                        "value": "0-5",
                        "count": 0,
                        "bin_start": 0,
                        "bin_end": 5
                    },
                    {
                        "value": "5-10",
                        "count": 0,
                        "bin_start": 5,
                        "bin_end": 10
                    },
                    {
                        "value": "10-15",
                        "count": 0,
                        "bin_start": 10,
                        "bin_end": 15
                    },
                    {
                        "value": "15-20",
                        "count": 3,
                        "bin_start": 15,
                        "bin_end": 20
                    },
                    {
                        "value": "20-25",
                        "count": 3,
                        "bin_start": 20,
                        "bin_end": 25
                    }
                ],
                "percentiles": [
                    {
                        "percentile": 0,
                        "value": 16.716666666666665
                    },
                    {
                        "percentile": 5,
                        "value": 17.099999999999998
                    },
                    {
                        "percentile": 10,
                        "value": 17.483333333333334
                    },
                    {
                        "percentile": 15,
                        "value": 17.866666666666667
                    },
                    {
                        "percentile": 20,
                        "value": 18.25
                    },
                    {
                        "percentile": 25,
                        "value": 18.433333333333334
                    },
                    {
                        "percentile": 30,
                        "value": 18.616666666666667
                    },
                    {
                        "percentile": 35,
                        "value": 18.8
                    },
                    {
                        "percentile": 40,
                        "value": 18.983333333333334
                    },
                    {
                        "percentile": 45,
                        "value": 19.266666666666666
                    },
                    {
                        "percentile": 50,
                        "value": 19.55
                    },
                    {
                        "percentile": 55,
                        "value": 19.833333333333336
                    },
                    {
                        "percentile": 60,
                        "value": 20.116666666666667
                    },
                    {
                        "percentile": 65,
                        "value": 20.241666666666667
                    },
                    {
                        "percentile": 70,
                        "value": 20.366666666666667
                    },
                    {
                        "percentile": 75,
                        "value": 20.491666666666667
                    },
                    {
                        "percentile": 80,
                        "value": 20.616666666666667
                    },
                    {
                        "percentile": 85,
                        "value": 20.645833333333336
                    },
                    {
                        "percentile": 90,
                        "value": 20.675
                    },
                    {
                        "percentile": 95,
                        "value": 20.704166666666666
                    },
                    {
                        "percentile": 100,
                        "value": 20.733333333333334
                    }
                ]
            }
        },
        {
            "start_time": "11:00",
            "end_time": "12:00",
            "headway_min": {
                "count": 4,
                "avg": 11.029166666666667,
                "std": 7.895219853036251,
                "min": 1.0333333333333334,
                "median": 10,
                "max": 23.083333333333332,
                "histogram": [
                    {
                        "value": "0-5",
                        "count": 1,
                        "bin_start": 0,
                        "bin_end": 5
                    },
                    {
                        "value": "5-10",
                        "count": 1,
                        "bin_start": 5,
                        "bin_end": 10
                    },
                    {
                        "value": "10-15",
                        "count": 1,
                        "bin_start": 10,
                        "bin_end": 15
                    },
                    {
                        "value": "15-20",
                        "count": 0,
                        "bin_start": 15,
                        "bin_end": 20
                    },
                    {
                        "value": "20-25",
                        "count": 1,
                        "bin_start": 20,
                        "bin_end": 25
                    }
                ],
                "percentiles": [
                    {
                        "percentile": 0,
                        "value": 1.0333333333333334
                    },
                    {
                        "percentile": 5,
                        "value": 2.2283333333333335
                    },
                    {
                        "percentile": 10,
                        "value": 3.423333333333334
                    },
                    {
                        "percentile": 15,
                        "value": 4.618333333333333
                    },
                    {
                        "percentile": 20,
                        "value": 5.8133333333333335
                    },
                    {
                        "percentile": 25,
                        "value": 7.008333333333334
                    },
                    {
                        "percentile": 30,
                        "value": 8.203333333333333
                    },
                    {
                        "percentile": 35,
                        "value": 9.099999999999998
                    },
                    {
                        "percentile": 40,
                        "value": 9.4
                    },
                    {
                        "percentile": 45,
                        "value": 9.700000000000001
                    },
                    {
                        "percentile": 50,
                        "value": 10
                    },
                    {
                        "percentile": 55,
                        "value": 10.3
                    },
                    {
                        "percentile": 60,
                        "value": 10.599999999999998
                    },
                    {
                        "percentile": 65,
                        "value": 10.900000000000002
                    },
                    {
                        "percentile": 70,
                        "value": 12.208333333333329
                    },
                    {
                        "percentile": 75,
                        "value": 14.020833333333332
                    },
                    {
                        "percentile": 80,
                        "value": 15.833333333333337
                    },
                    {
                        "percentile": 85,
                        "value": 17.645833333333332
                    },
                    {
                        "percentile": 90,
                        "value": 19.458333333333332
                    },
                    {
                        "percentile": 95,
                        "value": 21.27083333333333
                    },
                    {
                        "percentile": 100,
                        "value": 23.083333333333332
                    }
                ]
            },
            "wait_times": {
                "first_bus": "11:11:37",
                "last_bus": "11:55:44",
                "count": 49,
                "avg": 8.0921768707483,
                "std": 6.389861497333984,
                "min": 0.6166666666666667,
                "median": 7.116666666666666,
                "max": 23.116666666666667,
                "histogram": [
                    {
                        "value": "0-5",
                        "count": 18,
                        "bin_start": 0,
                        "bin_end": 5
                    },
                    {
                        "value": "5-10",
                        "count": 15,
                        "bin_start": 5,
                        "bin_end": 10
                    },
                    {
                        "value": "10-15",
                        "count": 7,
                        "bin_start": 10,
                        "bin_end": 15
                    },
                    {
                        "value": "15-20",
                        "count": 5,
                        "bin_start": 15,
                        "bin_end": 20
                    },
                    {
                        "value": "20-25",
                        "count": 4,
                        "bin_start": 20,
                        "bin_end": 25
                    }
                ],
                "percentiles": [
                    {
                        "percentile": 0,
                        "value": 0.6166666666666667
                    },
                    {
                        "percentile": 5,
                        "value": 0.7333333333333333
                    },
                    {
                        "percentile": 10,
                        "value": 0.9733333333333336
                    },
                    {
                        "percentile": 15,
                        "value": 1.1166666666666667
                    },
                    {
                        "percentile": 20,
                        "value": 2.1166666666666667
                    },
                    {
                        "percentile": 25,
                        "value": 3.1166666666666667
                    },
                    {
                        "percentile": 30,
                        "value": 3.5166666666666653
                    },
                    {
                        "percentile": 35,
                        "value": 4.116666666666666
                    },
                    {
                        "percentile": 40,
                        "value": 5.116666666666666
                    },
                    {
                        "percentile": 45,
                        "value": 6.116666666666666
                    },
                    {
                        "percentile": 50,
                        "value": 7.116666666666666
                    },
                    {
                        "percentile": 55,
                        "value": 7.516666666666669
                    },
                    {
                        "percentile": 60,
                        "value": 8.116666666666667
                    },
                    {
                        "percentile": 65,
                        "value": 9.116666666666667
                    },
                    {
                        "percentile": 70,
                        "value": 10.116666666666667
                    },
                    {
                        "percentile": 75,
                        "value": 11.116666666666667
                    },
                    {
                        "percentile": 80,
                        "value": 13.516666666666673
                    },
                    {
                        "percentile": 85,
                        "value": 15.916666666666664
                    },
                    {
                        "percentile": 90,
                        "value": 18.31666666666667
                    },
                    {
                        "percentile": 95,
                        "value": 20.71666666666666
                    },
                    {
                        "percentile": 100,
                        "value": 23.116666666666667
                    }
                ]
            },
            "trip_times": {
                "start_stop": "3994",
                "end_stop": "5417",
                "count": 5,
                "avg": 16.996666666666663,
                "std": 0.7482869324886904,
                "min": 16.133333333333333,
                "median": 16.916666666666668,
                "max": 18.366666666666667,
                "histogram": [
                    {
                        "value": "0-5",
                        "count": 0,
                        "bin_start": 0,
                        "bin_end": 5
                    },
                    {
                        "value": "5-10",
                        "count": 0,
                        "bin_start": 5,
                        "bin_end": 10
                    },
                    {
                        "value": "10-15",
                        "count": 0,
                        "bin_start": 10,
                        "bin_end": 15
                    },
                    {
                        "value": "15-20",
                        "count": 5,
                        "bin_start": 15,
                        "bin_end": 20
                    }
                ],
                "percentiles": [
                    {
                        "percentile": 0,
                        "value": 16.133333333333333
                    },
                    {
                        "percentile": 5,
                        "value": 16.223333333333333
                    },
                    {
                        "percentile": 10,
                        "value": 16.313333333333333
                    },
                    {
                        "percentile": 15,
                        "value": 16.403333333333332
                    },
                    {
                        "percentile": 20,
                        "value": 16.493333333333332
                    },
                    {
                        "percentile": 25,
                        "value": 16.583333333333332
                    },
                    {
                        "percentile": 30,
                        "value": 16.65
                    },
                    {
                        "percentile": 35,
                        "value": 16.71666666666667
                    },
                    {
                        "percentile": 40,
                        "value": 16.78333333333333
                    },
                    {
                        "percentile": 45,
                        "value": 16.85
                    },
                    {
                        "percentile": 50,
                        "value": 16.916666666666668
                    },
                    {
                        "percentile": 55,
                        "value": 16.93
                    },
                    {
                        "percentile": 60,
                        "value": 16.943333333333335
                    },
                    {
                        "percentile": 65,
                        "value": 16.956666666666667
                    },
                    {
                        "percentile": 70,
                        "value": 16.97
                    },
                    {
                        "percentile": 75,
                        "value": 16.983333333333334
                    },
                    {
                        "percentile": 80,
                        "value": 17.26
                    },
                    {
                        "percentile": 85,
                        "value": 17.536666666666665
                    },
                    {
                        "percentile": 90,
                        "value": 17.813333333333333
                    },
                    {
                        "percentile": 95,
                        "value": 18.09
                    },
                    {
                        "percentile": 100,
                        "value": 18.366666666666667
                    }
                ]
            }
        }
    ],
    "params": {
        "start_stop_id": "3994",
        "end_stop_id": "5417",
        "route_id": "J",
        "direction_id": "J____I_F00",
        "start_date": "2019-04-08",
        "end_date": "2019-04-08",
        "start_time": "09:00",
        "end_time": "12:00"
    },
    "route_title": [
        "J-Church"
    ],
    "start_stop_title": "Church St & 22nd St",
    "end_stop_title": "Powell Station Inbound",
    "directions": [
        {
            "id": "J____I_F00",
            "title": "Inbound to Embarcadero Station"
        }
    ]
  }
}

export default InfoPhaseOfDay;

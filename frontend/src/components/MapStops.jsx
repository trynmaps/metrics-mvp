import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Map, TileLayer, Marker, Tooltip, Polyline } from 'react-leaflet';
import * as d3 from 'd3';
import L from 'leaflet';
import Control from 'react-leaflet-control';
import { DIRECTION, FROM_STOP, TO_STOP, Path } from '../routeUtil';
import { handleGraphParams } from '../actions';
import { getTripTimesFromStop } from '../helpers/precomputed';
import { getTripPoints, getDistanceInMiles } from '../helpers/mapGeometry';
import { STARTING_COORDINATES } from '../locationConstants';
import { Colors } from '../UIConstants';
import StartStopIcon from '@material-ui/icons/DirectionsTransit';
import EndStopIcon from '@material-ui/icons/Flag';
import ReactDOMServer from 'react-dom/server';

const ZOOM = 13;

class MapStops extends Component {
  constructor(props) {
    super(props);
    this.state = {
      height: this.computeHeight(),
    };
  }

  componentDidMount() {
    this.boundUpdate = this.updateDimensions.bind(this);
    window.addEventListener('resize', this.boundUpdate);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.updateDimensions.bind(this));
  }
  
  /**
   * Helper method that draws one stop with svg graphics and/or Material UI icons.
   * 
   * @param {Object} stop The stop info object for this stop.
   * @param {Object} currentPosition Coordinates for this stop.
   * @param {Number} rotation Number of degrees to rotate to point in the direction of travel.
   * @param {Function} onClickHandler Method for handling mouse clicks.
   * @param {Object} tooltip The react-leaflet Tooltip for this stop. 
   * @returns {Object} The react-leaflet Marker.
   */
  populateStop = (stop, IconType, currentPosition, rotation, onClickHandler, tooltip) => {

    let icon = null;

    if (IconType) {

      // Given an IconType indicates start or end stop.  This is a white circle with a black icon, 
      // followed by the title of the stop.
      
      icon = L.divIcon({
        className: 'custom-icon', // this is needed to turn off the default icon styling (blank square)
        iconSize: [240, 24],
        iconAnchor: [12, 12], // centers icon over position, with text to the right
        html:
          
          `<svg width="24" height="24" viewBox="-10 -10 10 10">` +
          
          // this is a larger white circle
          
          `<circle cx="-5" cy="-5" r="4.5" fill="white" stroke="${Colors.INDIGO}" stroke-width="0.75"/>` +
          
          // this is the passed in icon, which we ask React to render as html (becomes an svg object)
          
          `</svg><div style="position:relative; top: -26px; left:2px">` +
          ReactDOMServer.renderToString(<IconType style={{color:Colors.INDIGO}} fontSize={'small'}/>) +
         `</div>` +
         
         // this is the stop title with a text shadow to outline it in white
         
         `<div style="position:relative; top:-50px; left:25px; font-weight:bold; color:` + Colors.INDIGO + `; ` +
         `text-shadow: -1px 1px 0 #fff,` +
         `1px 1px 0 #fff,` +
         `1px -1px 0 #fff,` +
         `-1px -1px 0 #fff;">${stop.title}</div>`,
      });
    } else if (stop.sid === this.props.graphParams.stopOnHoverId) {
      // If current stop is being hover on the To & From Dropdowns. This is a LARGE white circle with an
      // svg "v" shape rotated by the given rotation value.

      icon = L.divIcon({
        className: 'custom-icon', // this is needed to turn off the default icon styling (blank square)
        iconSize: [240, 35],
        iconAnchor: [18, 18], // centers icon over position, with text to the right
        html:
          `<svg width="32" height="32" viewBox="-10 -10 10 10" transform="rotate(${rotation} 0 0)">` +
          
          // First we draw a white circle
          
          `<circle cx="-5" cy="-5" r="3" fill="white" stroke="${Colors.INDIGO}" stroke-width="0.75"/>` +
          
          // Then the "v" shape point to zero degrees (east).  The entire parent svg is rotated.
          
          `<polyline points="-5.5,-6 -4,-5 -5.5,-4" stroke-linecap="round" stroke-linejoin="round" stroke="${
            Colors.INDIGO}" stroke-width="0.6" fill="none"/>` +
          `</svg>` + 
           // this is the stop title with a text shadow to outline it in white
         
         `<div style="position:relative; top:-29px; left:29px; font-weight:bold; color:` + Colors.INDIGO + `; ` +
         `text-shadow: -1px 1px 0 #fff,` +
         `1px 1px 0 #fff,` +
         `1px -1px 0 #fff,` +
         `-1px -1px 0 #fff;">${stop.title}</div>`,
      });
    } else {
      
      // If not given an IconType, this is just a regular stop.  This is a white circle with an
      // svg "v" shape rotated by the given rotation value.

      icon = L.divIcon({
        className: 'custom-icon', // this is needed to turn off the default icon styling (blank square)
        iconSize: [20, 20],
        iconAnchor: [10, 10], // centers icon over position, with text to the right
        html:
          `<svg viewBox="-10 -10 10 10"><g transform="rotate(${rotation} -5 -5)">` +
          
          // First we draw a white circle
          
          `<circle cx="-5" cy="-5" r="3" fill="white" stroke="${Colors.INDIGO}" stroke-width="0.75"/>` +
          
          // Then the "v" shape point to zero degrees (east).  The entire parent svg is rotated.
          
          `<polyline points="-5.5,-6 -4,-5 -5.5,-4" stroke-linecap="round" stroke-linejoin="round" stroke="${
            Colors.INDIGO}" stroke-width="0.6" fill="none"/>` +
          `</g>` +
          `</svg>`, 
      });

    }
    
    return (
      <Marker
        key={ stop.sid + '-marker' }
        position={currentPosition}
        icon={icon}
        onClick={ (e) => { e.sourceTarget.closeTooltip(); onClickHandler() } }
      >{tooltip}</Marker>
    )
  };

  /**
   * Computes angle in degrees from one point towards another 
   * @param {Object} fromPoint latLng of starting point
   * @param {Object} toPoint latLng of ending point
   * @returns {Number} The angle in degrees (where 0 is east, 90 is south)
   */
  angleFromTo = (fromPoint, toPoint) => {
    const delta_x = toPoint.lon - fromPoint.lon;
    // Note that y is reversed due to latitude's postive direction being reverse of screen y  
    const delta_y = fromPoint.lat - toPoint.lat;
    const rotation = Math.round(Math.atan2(delta_y, delta_x) * 180/Math.PI);
    return rotation;
  }
  
 
  /**
   * Draws all the stops in a given direction.
   * @param {Array} routeStops Collection of route stops grouped by direction id
   * @param {String} directionId The direction to render
   * @param {Object} direction The direction info for the given direction
   * @returns {Array} Array of Leaflet Marker objects
   */
  populateStops = (
    routeStops,
    directionId,
    direction,
  ) => {
    let route = [];

    if (routeStops && routeStops[directionId]) {
      route = routeStops[directionId].map(stop => {
        const currentPosition = [stop.lat, stop.lon];
        const isStart = stop.sid === this.props.graphParams.startStopId;
        const isEnd = stop.sid === this.props.graphParams.endStopId;
        
        const onClickHandler = () => this.handleStopSelect(stop, directionId); 
        const tooltip = <Tooltip>
          {stop.title}
          <br />
          {direction.title}
        </Tooltip>; 

        let IconType = null;
        if (isStart) {
          IconType = StartStopIcon;
        } else if (isEnd) {
          IconType = EndStopIcon;
        }
        
        // The direction of travel for a stop is from the GTFS shape point just before
        // this stop (represented by after_index) to the next shape point. Edge cases
        // at the beginning and end of a route seem to work out (probably because of
        // extra coords points representing the terminals).

        let rotation=0;
        const stopGeometry = direction.stop_geometry[stop.sid];
        if (stopGeometry) {
          const previousPoint = direction.coords[stopGeometry.after_index];
          const nextPoint = direction.coords[stopGeometry.after_index+1];
          rotation = this.angleFromTo(previousPoint, nextPoint);
        }
      
        const icon = this.populateStop(stop, IconType, currentPosition, rotation, onClickHandler, tooltip);
        return icon;
      });
    }
    return route;
  }; 
  
  // plot speed along a route

  populateSpeed = (routeInfo, direction, routeStops, directionId) => {
    const downstreamStops = routeStops[directionId];
    const polylines = [];

    let seenStart = false;
    let seenEnd = false;
    
    for (let i = 0; i < downstreamStops.length - 1; i++) {
      const speed = this.getSpeed(
        routeInfo,
        direction,
        downstreamStops,
        i,
        directionId,
      );

      if (downstreamStops[i].sid === this.props.graphParams.startStopId) {
        seenStart = true;
      }
      if (downstreamStops[i].sid === this.props.graphParams.endStopId) {
        seenEnd = true; 
      }
      
      let color = 'white';
      let weight = 12;
      
      // If this is the start stop or a subsequent stop before the end stop,
      // use a different color to highlight the selected range of stops.
      
      if (this.props.graphParams.endStopId && seenStart && !seenEnd) {
        color = Colors.INDIGO;
        weight = 14;
      }
      
      // draw a wide polyline as a background for the speed polyline

      polylines.push(
        <Polyline
          key={`poly-speed-white-${directionId}-${downstreamStops[i].sid}`}
          positions={getTripPoints(
            routeInfo,
            direction,
            downstreamStops[i].sid,
            downstreamStops[i + 1].sid,
          )}
          color={color}
          opacity={1}
          weight={weight}
        ></Polyline>,
      );
      
      // then the speed polyline on top of the white polyline

      polylines.push(
        <Polyline
          key={`poly-speed-${directionId}-${downstreamStops[i].sid}`}
          positions={getTripPoints(
            routeInfo,
            direction,
            downstreamStops[i].sid,
            downstreamStops[i + 1].sid,
          )}
          color={speed < 0 ? 'white' : this.speedColor(speed)}
          opacity={1}
          weight={7}
          onClick={e => {
            // when this segment is clicked, plot only the stops for this route/dir by setting the first stop

            e.originalEvent.view.L.DomEvent.stopPropagation(e);

            /* TODO: decide if clicking on segments changes the stop selection.  Right now no, because
             * the stop markers are fairly prominent at the moment.  If we make them smaller, then
             * reconsider. */
          }}
        >
          <Tooltip>
            {speed < 0 ? '?' : speed.toFixed(1)} mph to{' '}
            {downstreamStops[i + 1].title}
          </Tooltip>
        </Polyline>,
      );
    } // end for
    return polylines;
  };

  /**
   * Speed from index to index+1
   */
  getSpeed = (routeInfo, direction, downstreamStops, index, directionId) => {
    const graphParams = this.props.graphParams;
    const routeId = graphParams.routeId;

    const firstStop = downstreamStops[index];
    const firstStopId = firstStop.sid;
    const nextStop = downstreamStops[index + 1];
    const nextStopId = nextStop.sid;

    const tripTimesFromStop = getTripTimesFromStop(
      this.props.tripTimesCache,
      graphParams,
      routeId,
      directionId,
      firstStopId,
    );

    let time = null;
    if (tripTimesFromStop && tripTimesFromStop[nextStopId]) {
      time = tripTimesFromStop[nextStopId];
    } else {
      return -1; // speed not available;
    }

    const distance = getDistanceInMiles(
      routeInfo,
      direction,
      firstStopId,
      nextStopId,
    );

    return (distance / time) * 60; // miles per minute -> mph
  };

  SpeedLegend = () => {
    const speedColorValues = [2.5, 6.25, 8.75, 12.5]; // representative values for quantizing
    // center of scale is 7.5 with quartile boundaries at 5 and 10.

    const speedColorLabels = [' < 5', '5-7.5', '7.5-10', '10+'];

    const items = speedColorValues.map(speedColorValue => {
      return (
        <div key={speedColorValue}>
          <i
            style={{
              backgroundColor: this.speedColor(speedColorValue),
              width: 18,
              float: 'left',
            }}
          >
            &nbsp;
          </i>{' '}
          &nbsp;
          {speedColorLabels[speedColorValues.indexOf(speedColorValue)]}
        </div>
      );
    });

    return (
      <Control position="bottomright">
        <div
          style={{
            backgroundColor: 'white',
            padding: '5px',
          }}
        >
          Speed (mph)
          {items}
        </div>
      </Control>
    );
  };

  handleStopSelect = (stop, newDirectionId) => {
    let {
      // eslint-disable-next-line prefer-const
      routeId,
      startStopId,
      endStopId,
      directionId,
    } = this.props.graphParams;

    if (!startStopId) {
      // no first stop set: treat as first stop
      startStopId = stop.sid;
      endStopId = null;
      directionId = newDirectionId;
    } else if (!endStopId) {
      if (directionId !== newDirectionId) {
        // new direction: treat as first stop
        startStopId = stop.sid;
        endStopId = null;
        directionId = newDirectionId;
      } else {
        // set end stop, swap if needed
        const selectedRoute = this.props.routes.find(
          route => route.id === routeId,
        );
        const stopSids = selectedRoute.directions.find(
          dir => dir.id === directionId,
        ).stops;

        if (stopSids.indexOf(stop.sid) < stopSids.indexOf(startStopId)) {
          endStopId = startStopId;
          startStopId = stop.sid;
        } else {
          // order is correct
          endStopId = stop.sid;
        }
      }
    } else {
      // both stops were already set, treat as first stop and clear second (although arguably if same direction could set as end stop)
      startStopId = stop.sid;
      endStopId = null;
      directionId = newDirectionId;
    }
    const path = new Path();
    path.buildPath(DIRECTION, directionId).buildPath(FROM_STOP, startStopId);
    if (endStopId) {
      path.buildPath(TO_STOP, endStopId);
    }
    path.commitPath();
    const { onGraphParams } = this.props;
    // for debugging
    // console.log("end state is: start: " + startStopId + " end: " + endStopId + " dir: " + directionId);
    onGraphParams({
      startStopId,
      endStopId,
      directionId,
    });
  };

  getStopsInfoInGivenDirection = (selectedRoute, directionId) => {
    const stopSids = selectedRoute.directions.find(
      dir => dir.id === directionId,
    );

    return stopSids.stops.map(stop => {
      const currentStopInfo = { ...selectedRoute.stops[stop] };
      currentStopInfo.sid = stop;
      return currentStopInfo;
    });
  };

  // Make the map full height unless the window is smaller than the sm breakpoint (640px), in which
  // case make the map half height.
  //
  // TODO: Need to convert this component to a functional component.  Then we can use the useTheme
  // hook to programatically access the breakpoint widths.
  //
  // Note: This code has to be adjusted to be kept in sync with the UI layout.
  //

  computeHeight() {
    return (
      (window.innerWidth >= 640 ? window.innerHeight : window.innerHeight / 2) -
      64 /* blue app bar */
    );
  }

  updateDimensions() {
    const height = this.computeHeight();
    this.setState({ height });
  }

  speedColor(mph) {
    // should this be multiples of walking speed? 3/6/9/12?
    return d3
      .scaleQuantize()
      .domain([2.5, 12.5])
      .range(['#8d1212', '#e60000', '#f07d02', '#84ca50'])(mph);
  }

  render() {
    const { position, zoom } = this.props;

    const mapClass = { width: '100%', height: this.state.height };

    const { routes, graphParams } = this.props;

    let selectedRoute = null;
    let routeStops = null;
    const populatedRoutes = [];

    if (routes && graphParams) {
      selectedRoute = routes.find(route => route.id === graphParams.routeId);

      if (selectedRoute) {
        routeStops = {};
        selectedRoute.directions.forEach((direction, index) => {
          // plot only the selected direction if we have one, or else all directions

          if (
            !graphParams.directionId ||
            graphParams.directionId === direction.id
          ) {
            routeStops[direction.id] = this.getStopsInfoInGivenDirection(
              selectedRoute,
              direction.id,
            );
            
            // add white lines and speed color lines
            
            populatedRoutes.push(
              this.populateStops(
                routeStops,
                direction.id,
                direction,
              ),
            );
            
            // draw stop markers on top of lines for all directions
            
            populatedRoutes.unshift(
              this.populateSpeed(selectedRoute, direction, routeStops, direction.id),
            )
          }
        });
      }
    }

    let mapInstruction = '';
    if (!graphParams.endStopId) mapInstruction = 'Click a destination stop.';
    else if (!graphParams.startStopId) mapInstruction = 'Click an origin stop.';
    else if (!graphParams.directionId)
      mapInstruction = 'Select a direction to see stops in that direction.';

    return (
      <Map
        center={position || STARTING_COORDINATES}
        bounds={routeStops ? routeStops[selectedRoute.directions[0].id] : null}
        zoom={zoom || ZOOM}
        style={mapClass}
      >
        <TileLayer
          attribution='Map tiles by <a href="http://stamen.com">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.'
          url="https://stamen-tiles.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.png"
          opacity={0.3}
        />
        {populatedRoutes}
        <this.SpeedLegend />
        <Control position="topright">
          {!graphParams.startStopId || !graphParams.endStopId ? (
            <div className="map-instructions">{mapInstruction}</div>
          ) : null}
        </Control>
      </Map>
    );
  }
}

const mapStateToProps = state => ({
  graphParams: state.routes.graphParams,
  tripTimesCache: state.routes.tripTimesCache,
});

const mapDispatchToProps = dispatch => {
  return {
    onGraphParams: params => dispatch(handleGraphParams(params)),
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(MapStops);

/* eslint-disable */
import React from 'react';
import { connect } from 'react-redux';
import { Map, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import Control from 'react-leaflet-control';
import Toolbar from '@material-ui/core/Toolbar';
import AppBar from '@material-ui/core/AppBar';
import SidebarButton from '../components/SidebarButton';
import DateTimePanel from '../components/DateTimePanel';

import { fetchRoutes } from '../actions';
import { DefaultDisabledRoutes, routesUrl } from '../locationConstants';
import { metricsBaseURL } from '../config';
import { getTripPoints, isInServiceArea } from '../helpers/mapGeometry';

import './Isochrone.css';

const isochroneMinutes = 5;
const maxColoredTripMin = 60;
const WalkMetersPerMinute = 1.0 * 60;

const tripMinOptions = {
  5: { color: '#057F79' },
  10: { color: '#02BB0F' },
  15: { color: '#3ae100' },
  20: { color: '#83dd00' },
  25: { color: '#cad900' },
  30: { color: '#d59d00' },
  35: { color: '#d25400' },
  40: { color: '#ce0d00' },
  45: { color: '#c200b6' },
  50: { color: '#8b00bf' },
  55: { color: '#4900bf' },
  60: { color: '#220D3B' },
};

const defaultLayerOptions = { color: '#666' };

const redIcon = new L.Icon({
  iconUrl: `${process.env.PUBLIC_URL}/marker-icon-2x-red.png`,
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const computeCache = {};

function getDirectionInfo(directionId, routeInfo) {
  return routeInfo.directions.find(dirInfo => dirInfo.id === directionId);
}

class Isochrone extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      stat: 'median',
      maxTripMin: 90,
      computedMaxTripMin: null,
      computeId: null,
      computing: false,
      latLng: null,
      endLatLng: null,
      tripInfo: null,
      enabledRoutes: {},
    };

    let workerUrl = `${
      process.env.PUBLIC_URL
    }/isochrone-worker.js?v=${Math.random()}`;
    if (metricsBaseURL) {
      workerUrl += `&base=${encodeURIComponent(metricsBaseURL)}`;
    }

    workerUrl += `&routes_url=${encodeURIComponent(routesUrl)}`;

    const isochroneWorker = new Worker(workerUrl);

    this.isochroneWorker = isochroneWorker;

    this.layers = [];
    this.isochroneLayers = [];
    this.tripLayers = [];
    this.mapRef = React.createRef();

    DefaultDisabledRoutes.forEach(routeId => {
      this.state.enabledRoutes[routeId] = false;
    });

    this.handleMapClick = this.handleMapClick.bind(this);
    this.handleStatChange = this.handleStatChange.bind(this);
    this.handleToggleRoute = this.handleToggleRoute.bind(this);
    this.handleMaxTripMinChange = this.handleMaxTripMinChange.bind(this);
    this.selectAllRoutesClicked = this.selectAllRoutesClicked.bind(this);
    this.selectNoRoutesClicked = this.selectNoRoutesClicked.bind(this);
    this.resetMapClicked = this.resetMapClicked.bind(this);
    this.onWorkerMessage = this.onWorkerMessage.bind(this);
    this.recomputeIsochrones = this.recomputeIsochrones.bind(this);
    this.maxTripMinChanged = this.maxTripMinChanged.bind(this);

    isochroneWorker.onmessage = this.onWorkerMessage;
  }

  componentDidMount() {
    if (!this.props.routes) {
      this.props.fetchRoutes();
    }
  }

  componentDidUpdate(prevProps) {
    if (
      this.props.date !== prevProps.date ||
      this.props.startTime !== prevProps.startTime ||
      this.props.endTime !== prevProps.endTime
    ) {
      this.recomputeIsochrones();
    }
  }

  onWorkerMessage(e) {
    const data = e.data;
    if (data.type === 'reachableLocations') {
      const computeId = data.computeId;
      if (computeCache[computeId]) {
        computeCache[computeId][data.tripMin] = data;
      }
      if (computeId === this.state.computeId) {
        this.addReachableLocationsLayer(data);
      }
    } else if (data.type === 'error') {
      this.showError(data.error);
    } else {
      console.log(e.data);
    }
  }

  showError(message) {
    alert(message);
  }

  handleMapClick(event) {
    if (this.state.computeId) {
      return;
    }
    this.resetMap();
    this.computeIsochrones(event.latlng, null);
  }

  addReachableLocationsLayer(data) {
    const tripMin = data.tripMin;
    const reachableCircles = data.circles;
    const geoJson = data.geoJson;

    if (this.state.computeId !== data.computeId) {
      return;
    }

    if (this.state.computing && tripMin === this.state.maxTripMin) {
      this.setState({ computing: false });
    }

    const layerOptions = tripMinOptions[`${tripMin}`] || defaultLayerOptions;

    const diffLayer = L.geoJson(
      geoJson,
      Object.assign(
        { bubblingMouseEvents: false, fillOpacity: 0.4, stroke: false },
        layerOptions,
      ),
    );

    const map = this.mapRef.current.leafletElement;

    diffLayer.addTo(map);

    diffLayer.on('click', e => {
      const endLatLng = e.latlng;
      this.showTripInfo(endLatLng, reachableCircles);
    });

    diffLayer.on('dblclick', e => {
      this.resetMap();
      this.computeIsochrones(e.latlng);
    });

    this.isochroneLayers.push({ tripMin, layer: diffLayer });

    const curEndLatLng = this.state.endLatLng;

    // restore end latlng from previous view
    if (curEndLatLng && !this.tripLayers.length) {
      for (const circle of reachableCircles) {
        const dist = map.distance(circle, curEndLatLng);
        if (dist <= circle.radius) {
          this.showTripInfo(curEndLatLng, reachableCircles);
          break;
        }
      }
    }
  }

  showTripInfo(endLatLng, reachableCircles) {
    this.setState({ endLatLng });

    const map = this.mapRef.current.leafletElement;

    let allOptions = [];
    reachableCircles.forEach(circle => {
      const dist = map.distance(circle, endLatLng);
      if (dist <= circle.radius) {
        const walkMin = dist / WalkMetersPerMinute;
        const tripMin = walkMin + circle.tripMin;

        allOptions.push({
          tripMin,
          walkMin,
          circle,
        });
      }
    });

    this.clearTripLayers(false);

    if (allOptions.length) {
      allOptions = allOptions.sort(function(o1, o2) {
        return o1.tripMin - o2.tripMin;
      });

      const seenRoutes = {};
      let numOptions = 0;

      const tripInfo = [];
      for (const option of allOptions) {
        const circle = option.circle;

        if (seenRoutes[circle.routes]) {
          continue;
        }

        seenRoutes[circle.routes] = true;

        if (numOptions < 2 || !circle.tripItems.length) {
          numOptions += 1;

          for (const tripItem of circle.tripItems) {
            if (tripItem.route) {
              const routeInfo = this.props.routes.find(
                route => route.id === tripItem.route,
              );

              if (routeInfo) {
                const dirInfo = getDirectionInfo(tripItem.direction, routeInfo);

                const fromStop = tripItem.fromStop;
                const toStop = tripItem.toStop;

                const fromStopInfo = routeInfo.stops[fromStop];
                const toStopInfo = routeInfo.stops[toStop];

                const tripPoints = getTripPoints(
                  routeInfo,
                  dirInfo,
                  fromStop,
                  toStop,
                );

                if (tripPoints.length) {
                  // draw line segments along the route between fromStop and toStop
                  const polyLine = L.polyline(tripPoints).addTo(map);
                  polyLine.bindTooltip(routeInfo.id, {
                    direction: 'center',
                    opacity: 0.9,
                    permanent: true,
                  });

                  this.tripLayers.push(polyLine);

                  // draw small circles at fromStop and toStop
                  this.tripLayers.push(
                    L.circle(fromStopInfo, 40, {
                      color: '#090',
                      fillOpacity: 0.8,
                      stroke: false,
                    }).addTo(map),
                  );
                  this.tripLayers.push(
                    L.circle(toStopInfo, 40, {
                      color: '#900',
                      fillOpacity: 0.8,
                      stroke: false,
                    }).addTo(map),
                  );
                }
              }
            }
          }

          tripInfo.push(
            <div key={numOptions} className="isochrone-trip">
              <div>
                <strong>
                  {`${option.tripMin.toFixed(1)} min [${circle.routes ||
                    'walk'}]`}
                </strong>
              </div>
              {circle.tripItems.map((item, index) => (
                <div key={index}>
                  <em>{item.t.toFixed(1)} min</em>: {item.desc}
                </div>
              ))}
              {option.walkMin > 0.05 && circle.tripItems.length ? (
                <div>
                  <em>{option.walkMin.toFixed(1)} min</em>: walk to destination
                </div>
              ) : null}
            </div>,
          );
        }
      }

      const marker = L.marker(endLatLng, { icon: redIcon }).addTo(map);

      this.tripLayers.push(marker);

      this.setState({ tripInfo });
    }
  }

  computeIsochrones(latLng, endLatLng) {
    if (!isInServiceArea(latLng)) {
      return;
    }

    const dateStr = this.props.date;
    const startTimeStr = this.props.startTime;
    const endTimeStr = this.props.endTime;
    const timeStr =
      startTimeStr && endTimeStr ? `${startTimeStr}-${endTimeStr}` : '';

    const { maxTripMin, stat, enabledRoutes } = this.state;

    const enabledRoutesArr = [];

    this.props.routes.forEach(route => {
      if (enabledRoutes[route.id] !== false) {
        enabledRoutesArr.push(route.id);
      }
    });

    const computeId = [
      latLng.lat,
      latLng.lng,
      dateStr,
      timeStr,
      stat,
      maxTripMin,
      enabledRoutesArr.join(','),
    ].join(',');

    this.setState({
      latLng,
      endLatLng,
      computedMaxTripMin: maxTripMin,
      computeId,
    });

    const map = this.mapRef.current.leafletElement;

    let newLatLng;
    const marker = L.marker(latLng, { draggable: true }).addTo(map);
    marker.on('move', function(e) {
      newLatLng = e.latlng;
    });
    marker.on('moveend', () => {
      // event arg removed
      if (newLatLng) {
        this.resetMap();
        this.computeIsochrones(newLatLng);
      }
    });
    this.layers.push(marker);

    if (computeCache[computeId] && computeCache[computeId][maxTripMin]) {
      for (
        let tripMin = isochroneMinutes;
        tripMin <= maxTripMin;
        tripMin += isochroneMinutes
      ) {
        const cachedLayer = computeCache[computeId][tripMin];
        if (cachedLayer) {
          this.addReachableLocationsLayer(cachedLayer);
        }
      }
      return;
    }

    computeCache[computeId] = {};

    const tripMins = [];
    for (
      let m = isochroneMinutes;
      m <= maxTripMin && m <= maxColoredTripMin;
      m += isochroneMinutes
    ) {
      tripMins.push(m);
    }
    if (maxTripMin > maxColoredTripMin) {
      tripMins.push(maxTripMin);
    }

    this.setState({
      computing: true,
    });

    this.isochroneWorker.postMessage({
      action: 'computeIsochrones',
      latlng: latLng,
      routes: enabledRoutesArr,
      dateStr,
      timeStr,
      tripMins,
      stat,
      computeId,
    });
  }

  handleStatChange(event) {
    this.setState({ stat: event.target.value }, this.recomputeIsochrones);
  }

  handleMaxTripMinChange(event) {
    this.setState(
      { maxTripMin: parseInt(event.target.value, 10) },
      this.maxTripMinChanged,
    );
  }

  maxTripMinChanged() {
    const { maxTripMin, computedMaxTripMin } = this.state;

    if (
      computedMaxTripMin &&
      (maxTripMin > computedMaxTripMin ||
        !this.isochroneLayers.find(iso => iso.tripMin === maxTripMin))
    ) {
      this.recomputeIsochrones();
    } else {
      const map = this.mapRef.current.leafletElement;

      this.isochroneLayers.forEach(isochroneLayer => {
        if (isochroneLayer.tripMin <= maxTripMin) {
          isochroneLayer.layer.addTo(map);
        } else {
          isochroneLayer.layer.remove();
        }
      });
    }
  }

  handleToggleRoute(event) {
    const routeId = event.target.value;
    const checked = event.target.checked;

    this.setState(
      { enabledRoutes: { ...this.state.enabledRoutes, [routeId]: checked } },
      this.recomputeIsochrones,
    );
  }

  selectAllRoutesClicked() {
    // event arg
    this.selectAllRoutes(true);
  }

  selectNoRoutesClicked() {
    // event arg
    this.selectAllRoutes(false);
  }

  resetMapClicked() {
    // event arg
    this.resetMap();
  }

  recomputeIsochrones() {
    const { latLng, endLatLng } = this.state;
    if (latLng) {
      this.resetMap();
      this.computeIsochrones(latLng, endLatLng);
    }
  }

  resetMap() {
    const map = this.mapRef.current.leafletElement;

    map.closePopup();

    this.setState({ computeId: null, latLng: null, endLatLng: null });

    this.isochroneLayers.forEach(isochroneLayer => {
      isochroneLayer.layer.remove();
    });

    this.layers.forEach(layer => {
      layer.remove();
    });

    this.layers = [];
    this.isochroneLayers = [];
    this.clearTripLayers();
  }

  clearTripLayers(clearTripInfo) {
    this.tripLayers.forEach(layer => {
      layer.remove();
    });
    this.tripLayers = [];

    if (clearTripInfo !== false) {
      this.setState({ tripInfo: null });
    }
  }

  selectAllRoutes(enabled) {
    const { routes } = this.props;
    if (!routes) {
      return;
    }

    const enabledRoutes = {};
    routes.forEach(route => {
      enabledRoutes[route.id] = enabled;
    });

    this.setState({ enabledRoutes }, this.recomputeIsochrones);
  }

  makeRouteToggle(route) {
    let enabled = this.state.enabledRoutes[route.id];
    if (enabled == null) {
      enabled = true;
    }

    return (
      <div key={route.id}>
        <label>
          <input
            type="checkbox"
            checked={enabled}
            onChange={this.handleToggleRoute}
            value={route.id}
          />{' '}
          {route.id}
        </label>
      </div>
    );
  }

  render() {
    const { routes } = this.props;

    const colors = [];
    const times = [];

    for (
      let endTime = isochroneMinutes;
      endTime <= maxColoredTripMin;
      endTime += isochroneMinutes
    ) {
      colors.push(
        <div
          key={endTime}
          style={{ backgroundColor: tripMinOptions[endTime].color }}
        ></div>,
      );
      times.push(<div key={endTime}>{endTime}</div>);
    }

    colors.push(
      <div
        key="default"
        style={{ backgroundColor: defaultLayerOptions.color }}
      ></div>,
    );

    const tripMins = [];
    for (let tripMin = 15; tripMin <= maxColoredTripMin; tripMin += 15) {
      tripMins.push(tripMin);
    }
    tripMins.push(90);

    const center = { lat: 37.772, lng: -122.442 };

    return (
      <div className="flex-screen">
        <AppBar position="relative">
          <Toolbar>
            <SidebarButton />
            <div className="page-title">Isochrone</div>
            <DateTimePanel />
          </Toolbar>
        </AppBar>
        <Map
          center={center}
          zoom={13}
          className="isochrone-map"
          minZoom={11}
          maxZoom={18}
          onClick={this.handleMapClick}
          ref={this.mapRef}
        >
          <TileLayer
            attribution='Map tiles by <a href="http://stamen.com">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.'
            url="https://stamen-tiles.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.png"
          />
          {/* see http://maps.stamen.com for details */}
          <Control position="topleft">
            <div className="isochrone-controls">
              <div>
                stat:
                <select
                  value={this.state.stat}
                  onChange={this.handleStatChange}
                  className="isochrone-control-select"
                >
                  <option value="p10">10th percentile</option>
                  <option value="median">median</option>
                  <option value="p90">90th percentile</option>
                </select>
              </div>
              <div>
                max trip time:
                <select
                  value={this.state.maxTripMin}
                  onChange={this.handleMaxTripMinChange}
                  className="isochrone-control-select"
                >
                  {tripMins.map(tripMin => (
                    <option key={tripMin} value={tripMin}>
                      {tripMin} minutes
                    </option>
                  ))}
                </select>
              </div>
              <div>
                routes:
                <div className="isochrone-select-all">
                  <span onClick={this.selectAllRoutesClicked}>all</span>
                  {' / '}
                  <span onClick={this.selectNoRoutesClicked}>none</span>
                </div>
                <div className="isochrone-routes">
                  {(routes || []).map(route => this.makeRouteToggle(route))}
                </div>
              </div>
              <button type="button" onClick={this.resetMapClicked}>
                Clear
              </button>
            </div>
          </Control>
          <Control position="topright">
            {this.state.tripInfo ? (
              <div className="isochrone-trip-info">{this.state.tripInfo}</div>
            ) : (
              <div className="isochrone-instructions">
                {!this.state.latLng
                  ? 'Click anywhere in the city to see the trip times from' +
                    ' that point to the rest of the city via transit and walking.'
                  : this.state.computing
                  ? 'Computing...'
                  : 'Click anywhere in the shaded area to see routes and trip times between the two points, or drag the blue pin to see trip times from a new point.'}
              </div>
            )}
          </Control>
          <Control position="bottomright">
            <div className="isochrone-legend">
              trip times (minutes)
              <div className="isochrone-legend-colors">{colors}</div>
              <div className="isochrone-legend-times">{times}</div>
            </div>
          </Control>
        </Map>
      </div>
    );
  }
}

const mapStateToProps = state => ({
  routes: state.routes.routes,
  date: state.routes.graphParams.date,
  startTime: state.routes.graphParams.startTime,
  endTime: state.routes.graphParams.endTime,
});

const mapDispatchToProps = dispatch => ({
  fetchRoutes: () => dispatch(fetchRoutes()),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(Isochrone);

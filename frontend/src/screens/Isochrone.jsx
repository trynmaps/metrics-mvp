/* eslint-disable react/sort-comp */
/* eslint-disable no-console */
/* eslint-disable no-alert */
/* eslint-disable no-nested-ternary */
/* eslint-disable max-len */
/* eslint-disable no-continue */
/* eslint-disable react/no-array-index-key */
/* eslint-disable react/no-access-state-in-setstate */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-unused-vars */
/* eslint-disable array-callback-return */
/* eslint-disable consistent-return */
import React from 'react';
import { connect } from 'react-redux';
import { Map, TileLayer } from 'react-leaflet';
import L, { DomEvent } from 'leaflet';
import Control from 'react-leaflet-control';
import Grid from '@material-ui/core/Grid';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import Button from '@material-ui/core/Button';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import DateRangeControl from '../components/DateRangeControl';
import TimeRangeControl from '../components/TimeRangeControl';

import { fetchRoutes } from '../actions';
import {
  S3Bucket,
  MetricsBaseURL,
  Agencies,
  PrecomputedStatsVersion,
  RoutesVersion,
} from '../config';
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

    // for now, only supports 1 agency at a time.
    // todo: support multiple agencies on one map
    const agency = Agencies[0];
    this.agencyId = agency.id;

    this.initialZoom = agency.initialMapZoom;
    this.initialCenter = agency.initialMapCenter;
    const defaultDisabledRoutes = agency.defaultDisabledRoutes || [];

    this.state = {
      maxTripMin: 90,
      computedMaxTripMin: null,
      computeId: null,
      computing: false,
      latLng: null,
      endLatLng: null,
      tripInfo: null,
      enabledRoutes: {},
      noData: false,
      height: this.computeHeight(),
    };

    let workerUrl = `${
      process.env.PUBLIC_URL
    }/isochrone-worker.js?v=${Math.random()}`;
    if (MetricsBaseURL) {
      workerUrl += `&base=${encodeURIComponent(MetricsBaseURL)}`;
    }

    workerUrl += `&s3_bucket=${encodeURIComponent(S3Bucket)}`;
    workerUrl += `&agency_id=${encodeURIComponent(this.agencyId)}`;
    workerUrl += `&routes_version=${encodeURIComponent(RoutesVersion)}`;
    workerUrl += `&precomputed_stats_version=${encodeURIComponent(
      PrecomputedStatsVersion,
    )}`;

    const isochroneWorker = new Worker(workerUrl);

    this.isochroneWorker = isochroneWorker;

    this.layers = [];
    this.isochroneLayers = [];
    this.tripLayers = [];
    this.routeLayers = [];
    this.mapRef = React.createRef();

    defaultDisabledRoutes.forEach(routeId => {
      this.state.enabledRoutes[routeId] = false;
    });

    this.handleMapClick = this.handleMapClick.bind(this);
    this.handleToggleRoute = this.handleToggleRoute.bind(this);
    this.handleMaxTripMinChange = this.handleMaxTripMinChange.bind(this);
    this.selectAllRoutesClicked = this.selectAllRoutesClicked.bind(this);
    this.selectNoRoutesClicked = this.selectNoRoutesClicked.bind(this);
    this.resetMapClicked = this.resetMapClicked.bind(this);
    this.onWorkerMessage = this.onWorkerMessage.bind(this);
    this.recomputeIsochrones = this.recomputeIsochrones.bind(this);
    this.maxTripMinChanged = this.maxTripMinChanged.bind(this);

    isochroneWorker.onmessage = this.onWorkerMessage;

    this.container = null;
  }

  // For resolve the scrolling problem
  // https://github.com/trynmaps/metrics-mvp/issues/448
  // Prevent click and scroll from propagation
  refContainer = element => {
    this.container = element;
    if (element) {
      DomEvent.disableClickPropagation(this.container).disableScrollPropagation(
        this.container,
      );
    }
  };

  componentDidMount() {
    if (!this.props.routes) {
      this.props.fetchRoutes();
    }
    this.boundUpdate = this.updateDimensions.bind(this);
    window.addEventListener('resize', this.boundUpdate);

    this.updateRouteLayers();
  }

  updateRouteLayers() {
    if (!this.mapRef.current) {
      console.log('no map element');
      return;
    }
    const map = this.mapRef.current.leafletElement;
    const routes = this.props.routes;

    this.routeLayers.forEach(layer => {
      layer.remove();
    });
    this.routeLayers = [];

    if (routes && map) {
      routes.forEach(route => {
        if (this.state.enabledRoutes[route.id] !== false) {
          return route.directions.map(direction => {
            const routeLayer = L.polyline(getTripPoints(route, direction), {
              color: '#0177BF',
              opacity: 0.2,
              weight: 1.5,
            }).addTo(map);
            this.routeLayers.push(routeLayer);
          });
        }
      });
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.updateDimensions.bind(this));
  }

  updateDimensions() {
    const height = this.computeHeight();
    this.setState({ height });
  }

  computeHeight() {
    return window.innerHeight - 52;
  }

  componentDidUpdate(prevProps) {
    if (this.props.routes !== prevProps.routes) {
      this.updateRouteLayers();
    }

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
      this.setState({ noData: false });
    } else if (data.type === 'error') {
      if (data.error.status >= 400 && data.error.status < 500) {
        // there is no JSON data for this day
        this.setState({ noData: true });
      } else {
        this.showError(data.error.message);
      }
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

    if (this.state.computeId !== data.computeId || !this.mapRef.current) {
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
    if (!isInServiceArea(this.agencyId, latLng)) {
      return;
    }

    const dateStr = this.props.date;
    const startTimeStr = this.props.startTime;
    const endTimeStr = this.props.endTime;
    const timeStr =
      startTimeStr && endTimeStr ? `${startTimeStr}-${endTimeStr}` : '';

    const { maxTripMin, enabledRoutes } = this.state;

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
      computeId,
    });
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
      this.enabledRoutesChanged,
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

    this.setState({ enabledRoutes }, this.enabledRoutesChanged);
  }

  enabledRoutesChanged() {
    this.updateRouteLayers();
    this.recomputeIsochrones();
  }

  makeRouteToggle(route) {
    let enabled = this.state.enabledRoutes[route.id];
    if (enabled == null) {
      enabled = true;
    }

    return (
      <ListItem key={route.id}>
        <FormControlLabel
          control={
            <Checkbox
              checked={enabled}
              onChange={this.handleToggleRoute}
              value={route.id}
              color="primary"
              size="small"
            />
          }
          label={route.id}
        />
      </ListItem>
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

    const mapStyle = { width: '100%', height: this.state.height };

    return (
      <>
        <Map
          center={this.initialCenter}
          zoom={this.initialZoom}
          className="isochrone-map"
          minZoom={5}
          maxZoom={18}
          onClick={this.handleMapClick}
          ref={this.mapRef}
          style={mapStyle}
        >
          <TileLayer
            attribution='Map tiles by <a href="http://stamen.com">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.'
            url="https://stamen-tiles.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.png"
            opacity={0.6}
          />
          {/* see http://maps.stamen.com for details */}
          <Control position="topleft" className="isochrone-controls">
            <div ref={this.refContainer}>
              <div>
                <DateRangeControl dateRangeSupported={false} />
              </div>
              <div>
                <TimeRangeControl />
              </div>
              <div>
                <FormControl className="inline-form-control">
                  <InputLabel id="maxTripTimeLabel">Max Trip Time</InputLabel>
                  <Select
                    labelId="maxTripTimeLabel"
                    value={this.state.maxTripMin}
                    onChange={this.handleMaxTripMinChange}
                  >
                    {tripMins.map(tripMin => (
                      <MenuItem key={tripMin} value={tripMin}>
                        {tripMin} minutes
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>
              <div style={{ paddingTop: 8 }}>
                <InputLabel shrink id="routesLabel">
                  Routes
                </InputLabel>
                <Grid container direction="row" alignItems="flex-start">
                  <Grid item>
                    <Button size="small" onClick={this.selectAllRoutesClicked}>
                      all
                    </Button>
                    <Button size="small" onClick={this.selectNoRoutesClicked}>
                      none
                    </Button>
                  </Grid>
                </Grid>
                <List className="isochrone-routes">
                  {(routes || []).map(route => this.makeRouteToggle(route))}
                </List>
              </div>
            </div>
          </Control>
          <Control position="topright">
            {this.state.tripInfo ? (
              <div className="isochrone-trip-info">{this.state.tripInfo}</div>
            ) : (
              <div className="isochrone-instructions">
                {this.state.noData
                  ? 'There is no data for the selected date. Choose another date.'
                  : !this.state.latLng
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
          {this.state.latLng ? (
            <Control position="bottomleft">
              <Button
                variant="contained"
                color="secondary"
                size="small"
                onClick={this.resetMapClicked}
              >
                Clear map
              </Button>
              <br />
              <br />
            </Control>
          ) : null}
        </Map>
      </>
    );
  }
}

const mapStateToProps = state => ({
  routes: state.routes.data,
  date: state.graphParams.firstDateRange.date,
  startTime: state.graphParams.firstDateRange.startTime,
  endTime: state.graphParams.firstDateRange.endTime,
});

const mapDispatchToProps = dispatch => ({
  fetchRoutes: params => dispatch(fetchRoutes(params)),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(Isochrone);

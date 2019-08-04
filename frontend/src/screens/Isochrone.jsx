import React, { Fragment } from 'react';
import { connect } from 'react-redux';
import { Map, TileLayer, Polyline, Marker } from 'react-leaflet';
import L from 'leaflet';
import Control from 'react-leaflet-control';
import * as turf from '@turf/turf';
import SidebarButton from '../components/SidebarButton';
import DateTimePanel from '../components/DateTimePanel';
import Toolbar from '@material-ui/core/Toolbar';
import AppBar from '@material-ui/core/AppBar';

import { fetchRoutes, routesUrl } from '../actions';
import { ServiceArea, DefaultDisabledRoutes } from '../agencies/sf-muni';
import { metricsBaseURL } from '../config';

import './Isochrone.css';

const isochroneMinutes = 5;
const maxColoredTripMin = 60;

const WalkMetersPerMinute = 1.0 * 60;

const tripMinOptions = {
    5: {color:'#057F79'},
    10: {color:'#02BB0F'},
    15: {color:'#3ae100'},
    20: {color:'#83dd00'},
    25: {color:'#cad900'},
    30: {color:'#d59d00'},
    35: {color:'#d25400'},
    40: {color:'#ce0d00'},
    45: {color:'#c200b6'},
    50: {color:'#8b00bf'},
    55: {color:'#4900bf'},
    60: {color:'#220D3B'},
};

const defaultLayerOptions = {color:'#666'};

const initialInstructions = L.divIcon({
    className: 'isochrone-instructions',
    html:'Click anywhere in the city to see the trip times from that point to the rest of the city via Muni and walking.',
    iconSize: [160, 80]
});

const computingInstructions = L.divIcon({
    className: 'isochrone-instructions',
    html:'Computing...',
    iconSize: [80, 30]
});

const tripInstructions = L.divIcon({
    className: 'isochrone-instructions',
    html:'Click anywhere in the shaded area to see routes and trip times between the two points, or drag the blue pin to see trip times from a new point.',
    iconSize: [175, 100]
});

let redIcon = new L.Icon({
  iconUrl: process.env.PUBLIC_URL + '/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

let computeCache = {};

function getDirectionInfo(directionId, routeInfo)
{
    for (let dirInfo of routeInfo.directions)
    {
        if (dirInfo.id === directionId)
        {
            return dirInfo;
        }
    }
    return null;
}

class Isochrone extends React.Component {

    componentDidMount() {
        if (!this.props.routes) {
            this.props.fetchRoutes();
        }
    }

    componentDidUpdate(prevProps) {
        if (this.props.date !== prevProps.date ||
            this.props.start_time !== prevProps.start_time ||
            this.props.end_time !== prevProps.end_time) {
            this.recomputeIsochrones();
        }
    }

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
            enabledRoutes: {}
        };

        var workerUrl = process.env.PUBLIC_URL + '/isochrone-worker.js?v=' + Math.random();
        if (metricsBaseURL)
        {
            workerUrl += '&base=' + encodeURIComponent(metricsBaseURL);
        }

        workerUrl += '&routes_url=' + encodeURIComponent(routesUrl);

        let isochroneWorker = new Worker(workerUrl);

        this.isochroneWorker = isochroneWorker;

        this.layers = [];
        this.isochroneLayers = [];
        this.tripLayers = [];
        this.mapRef = React.createRef();

        for (let routeId of DefaultDisabledRoutes)
        {
            this.state.enabledRoutes[routeId] = false;
        }

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

    onWorkerMessage(e)
    {
        let data = e.data;
        if (data.type === 'reachableLocations')
        {
            let computeId = data.computeId;
            if (computeCache[computeId])
            {
                computeCache[computeId][data.tripMin] = data;
            }
            if (computeId === this.state.computeId)
            {
                this.addReachableLocationsLayer(data);
            }
        }
        else if (data.type === 'error')
        {
            this.showError(data.error);
        }
        else
        {
            console.log(e.data);
        }
    }

    showError(message)
    {
        alert(message);
    }

    handleMapClick(event)
    {
        if (this.state.computeId)
        {
            return;
        }
        this.resetMap();
        this.computeIsochrones(event.latlng, null);
    }

    addReachableLocationsLayer(data)
    {
        let tripMin = data.tripMin;
        let reachableCircles = data.circles;
        let geoJson = data.geoJson;

        if (this.state.computeId != data.computeId)
        {
            return;
        }

        if (this.state.computing && tripMin == this.state.maxTripMin)
        {
            this.setState({computing: false});
        }

        let layerOptions = tripMinOptions['' + tripMin] || defaultLayerOptions;

        let diffLayer = L.geoJson(geoJson, Object.assign({bubblingMouseEvents: false, fillOpacity:0.4, stroke:false}, layerOptions));

        let map = this.mapRef.current.leafletElement;

        diffLayer.addTo(map);

        diffLayer.on('click', e => {
            let endLatLng = e.latlng;
            this.showTripInfo(endLatLng, reachableCircles);
        });

        diffLayer.on('dblclick', e => {
            this.resetMap();
            this.computeIsochrones(e.latlng);
        });

        this.isochroneLayers.push({tripMin: tripMin, layer: diffLayer});

        let curEndLatLng = this.state.endLatLng;

        // restore end latlng from previous view
        if (curEndLatLng && !this.tripLayers.length)
        {
            for (let circle of reachableCircles)
            {
                let dist = map.distance(circle, curEndLatLng);
                if (dist <= circle.radius)
                {
                    this.showTripInfo(curEndLatLng, reachableCircles);
                    break;
                }
            }
        }
    }

    showTripInfo(endLatLng, reachableCircles)
    {
        this.setState({endLatLng: endLatLng});

        let map = this.mapRef.current.leafletElement;

        let allOptions = [];
        for (let circle of reachableCircles)
        {
            let dist = map.distance(circle, endLatLng);
            if (dist <= circle.radius)
            {
                let walkMin = dist / WalkMetersPerMinute;
                let tripMin = walkMin + circle.tripMin;

                allOptions.push({
                    tripMin: tripMin,
                    walkMin: walkMin,
                    circle: circle,
                });
            }
        }

        this.clearTripLayers(false);

        if (allOptions.length)
        {
            allOptions = allOptions.sort(function(o1, o2) {
                return o1.tripMin - o2.tripMin;
            });

            let seenRoutes = {};
            let numOptions = 0;

            let tripInfo = [];
            for (let option of allOptions)
            {
                let circle = option.circle;

                if (seenRoutes[circle.routes])
                {
                    continue;
                }

                seenRoutes[circle.routes] = true;

                if (numOptions < 2 || !circle.tripItems.length)
                {
                    numOptions++;

                    for (let tripItem of circle.tripItems)
                    {
                        if (tripItem.route)
                        {
                            const routeInfo = this.props.routes.find(route => route.id === tripItem.route);

                            if (routeInfo)
                            {
                                let dirInfo = getDirectionInfo(tripItem.direction, routeInfo);

                                let fromStop = tripItem.fromStop;
                                let toStop = tripItem.toStop;

                                let fromStopInfo = routeInfo.stops[fromStop];
                                let toStopInfo = routeInfo.stops[toStop];

                                let fromStopGeometry = dirInfo.stop_geometry[fromStop];
                                let toStopGeometry = dirInfo.stop_geometry[toStop];
                                let tripPoints = [];

                                if (fromStopGeometry && toStopGeometry)
                                {
                                    tripPoints.push(fromStopInfo);
                                    for (let i = fromStopGeometry.after_index + 1; i <= toStopGeometry.after_index; i++) {
                                        tripPoints.push(dirInfo.coords[i]);
                                    }
                                    tripPoints.push(toStopInfo);
                                }
                                else // if unknown geometry, draw straight lines between stops
                                {
                                    let fromStopIndex = dirInfo.stops.indexOf(tripItem.fromStop);
                                    let toStopIndex = dirInfo.stops.indexOf(tripItem.toStop);
                                    if (fromStopIndex !== -1 && toStopIndex !== -1)
                                    {
                                        for (let i = fromStopIndex; i <= toStopIndex; i++)
                                        {
                                            let stopInfo = routeInfo.stops[dirInfo.stops[i]];
                                            tripPoints.push(stopInfo);
                                        }
                                    }
                                }

                                if (tripPoints.length)
                                {
                                    // draw line segments along the route between fromStop and toStop
                                    let polyLine = L.polyline(tripPoints).addTo(map);
                                    polyLine.bindTooltip(routeInfo.id, {direction:'center', opacity:0.9, permanent:true});

                                    this.tripLayers.push(polyLine);

                                    // draw small circles at fromStop and toStop
                                    this.tripLayers.push(L.circle(fromStopInfo, 40, {color:'#090', fillOpacity:0.8, stroke:false}).addTo(map));
                                    this.tripLayers.push(L.circle(toStopInfo, 40, {color:'#900', fillOpacity: 0.8, stroke:false}).addTo(map));
                                }
                            }
                        }
                    }

                    tripInfo.push(
                        <div key={numOptions} className='isochrone-trip'>
                            <div><strong>{option.tripMin.toFixed(1) + ' min ['+(circle.routes || 'walk')+']'}</strong></div>
                            {circle.tripItems.map((item, index) => (
                                <div key={index}><em>{item.t.toFixed(1)} min</em>: {item.desc}</div>
                            ))}
                            {option.walkMin > 0.05 && circle.tripItems.length ?
                                (<div><em>{option.walkMin.toFixed(1)} min</em>: walk to destination</div>)
                                : null}
                        </div>
                    );
                }
            }

            let marker = L.marker(endLatLng, {icon:redIcon}).addTo(map);

            this.tripLayers.push(marker);

            this.setState({tripInfo: tripInfo});
        }
    }

    isInServiceArea(latLng)
    {
        const point = turf.point([latLng.lng, latLng.lat]);

        for (let feature of ServiceArea.features)
        {
            if (turf.booleanWithin(point, feature))
            {
                return true;
            }
        }
        return false;
    }

    computeIsochrones(latLng, endLatLng)
    {
        if (!this.isInServiceArea(latLng))
        {
            return;
        }

        const dateStr = this.props.date;
        const startTimeStr = this.props.start_time;
        const endTimeStr = this.props.end_time;
        const timeStr = (startTimeStr && endTimeStr) ? `${startTimeStr}-${endTimeStr}` : "";

        const {maxTripMin, stat, enabledRoutes} = this.state;

        let enabledRoutesArr = [];

        for (var route of this.props.routes)
        {
            if (enabledRoutes[route.id] !== false)
            {
                enabledRoutesArr.push(route.id);
            }
        }

        let computeId = [
            latLng.lat,
            latLng.lng,
            dateStr,
            timeStr,
            stat,
            maxTripMin,
            enabledRoutesArr.join(',')
        ].join(',');

        this.setState({
            latLng: latLng,
            endLatLng: endLatLng,
            computedMaxTripMin: maxTripMin,
            computeId: computeId
        });

        let map = this.mapRef.current.leafletElement;

        let newLatLng;
        let marker = L.marker(latLng, {draggable: true}).addTo(map);
        marker.on('move', function(e) {
            newLatLng = e.latlng;
        });
        marker.on('moveend', e => {
            if (newLatLng)
            {
                this.resetMap();
                this.computeIsochrones(newLatLng);
            }
        });
        this.layers.push(marker);

        if (computeCache[computeId] && computeCache[computeId][maxTripMin])
        {
            for (let tripMin = isochroneMinutes; tripMin <= maxTripMin; tripMin += isochroneMinutes)
            {
                let cachedLayer = computeCache[computeId][tripMin];
                if (cachedLayer)
                {
                    this.addReachableLocationsLayer(cachedLayer);
                }
            }
            return;
        }

        computeCache[computeId] = {};

        let tripMins = [];
        for (let m = isochroneMinutes; m <= maxTripMin && m <= maxColoredTripMin; m += isochroneMinutes)
        {
            tripMins.push(m);
        }
        if (maxTripMin > maxColoredTripMin)
        {
            tripMins.push(maxTripMin);
        }

        this.setState({
            computing: true
        });

        this.isochroneWorker.postMessage({
            action:'computeIsochrones',
            latlng: latLng,
            routes: enabledRoutesArr,
            dateStr: dateStr,
            timeStr: timeStr,
            tripMins: tripMins,
            stat: stat,
            computeId: computeId
        });
    }

    handleStatChange(event)
    {
        this.setState({stat: event.target.value}, this.recomputeIsochrones);
    }

    handleMaxTripMinChange(event)
    {
        this.setState({maxTripMin: parseInt(event.target.value, 10)}, this.maxTripMinChanged);
    }

    maxTripMinChanged()
    {
        let { maxTripMin, computedMaxTripMin } = this.state;

        if (computedMaxTripMin &&
            (maxTripMin > computedMaxTripMin || !this.isochroneLayers.find(iso => iso.tripMin === maxTripMin)))
        {
            this.recomputeIsochrones();
        }
        else
        {
            let map = this.mapRef.current.leafletElement;

            for (let isochroneLayer of this.isochroneLayers)
            {
                if (isochroneLayer.tripMin <= maxTripMin)
                {
                    isochroneLayer.layer.addTo(map);
                }
                else
                {
                    isochroneLayer.layer.remove();
                }
            }
        }
    }

    handleToggleRoute(event)
    {
        const routeId = event.target.value;
        const checked = event.target.checked;

        this.setState({enabledRoutes: {...this.state.enabledRoutes, [routeId]: checked}}, this.recomputeIsochrones);
    }

    selectAllRoutesClicked(event)
    {
        this.selectAllRoutes(true);
    }

    selectNoRoutesClicked(event)
    {
        this.selectAllRoutes(false);
    }

    resetMapClicked(event)
    {
        this.resetMap();
    }

    recomputeIsochrones()
    {
        let {latLng, endLatLng} = this.state;
        if (latLng)
        {
            this.resetMap();
            this.computeIsochrones(latLng, endLatLng);
        }
    }

    resetMap()
    {
        let map = this.mapRef.current.leafletElement;

        map.closePopup();

        this.setState({computeId: null, latLng: null, endLatLng: null});

        for (let isochroneLayer of this.isochroneLayers)
        {
            isochroneLayer.layer.remove();
        }
        for (let layer of this.layers)
        {
            layer.remove();
        }
        this.layers = [];
        this.isochroneLayers = [];
        this.clearTripLayers();
    }

    clearTripLayers(clearTripInfo)
    {
        for (let layer of this.tripLayers)
        {
            layer.remove();
        }
        this.tripLayers = [];

        if (clearTripInfo !== false)
        {
            this.setState({tripInfo: null});
        }
    }

    selectAllRoutes(enabled)
    {
        var {routes} = this.props;
        if (!routes)
        {
            return;
        }

        var enabledRoutes = {};
        for (let route of routes)
        {
            enabledRoutes[route.id] = enabled;
        }

        this.setState({enabledRoutes: enabledRoutes}, this.recomputeIsochrones);
    }

    makeRouteToggle(route)
    {
        let enabled = this.state.enabledRoutes[route.id];
        if (enabled == null)
        {
            enabled = true;
        }

        return <div key={route.id}>
            <label>
                <input type="checkbox" checked={enabled} onChange={this.handleToggleRoute} value={route.id} /> {route.id}
            </label>
        </div>;
    }

    render() {
        const {routes} = this.props;

        let colors = [];
        let times = [];

        for (let endTime = isochroneMinutes; endTime <= maxColoredTripMin; endTime += isochroneMinutes)
        {
            colors.push(<div key={endTime} style={{backgroundColor: tripMinOptions[endTime].color}}></div>);
            times.push(<div key={endTime}>{endTime}</div>);
        }

        colors.push(<div key='default' style={{backgroundColor: defaultLayerOptions.color}}></div>);

        const dateStrs = ['2019-06-06', '2019-06-07', '2019-06-08', '2019-06-09'];

        let tripMins = [];
        for (let tripMin = 15; tripMin <= maxColoredTripMin; tripMin += 15)
        {
            tripMins.push(tripMin);
        }
        tripMins.push(90);

        const center = {lat: 37.772, lng: -122.442};
        const instructionsPosition = {lat: 37.800, lng: -122.500};

        let instructionsMarker = null;
        if (!this.state.latLng) {
            instructionsMarker = <Marker icon={initialInstructions} position={instructionsPosition} />;
        }
        else if (this.state.computing)
        {
            instructionsMarker = <Marker icon={computingInstructions} position={instructionsPosition} />;
        }
        else
        {
            instructionsMarker = <Marker icon={tripInstructions} position={instructionsPosition} />;
        }

        return <div className='flex-screen'>
            <AppBar position="relative">
              <Toolbar>
                <SidebarButton />
                <div className='page-title'>
                  Isochrone
                </div>
                <DateTimePanel/>
              </Toolbar>
            </AppBar>
            <Map center={center} zoom={13} className='isochrone-map'
                minZoom={11}
                maxZoom={18}
                onClick={this.handleMapClick}
                ref={this.mapRef}
                >
                <TileLayer
                  attribution='Map tiles by <a href="http://stamen.com">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.'
                  url="https://stamen-tiles.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.png"
                /> {/* see http://maps.stamen.com for details */}
                {instructionsMarker}
                <Control position="topleft">
                    <div className="isochrone-controls">
                        <div>
                            stat:
                            <select value={this.state.stat} onChange={this.handleStatChange} className='isochrone-control-select'>
                                <option value='p10'>10th percentile</option>
                                <option value='median'>median</option>
                                <option value='p90'>90th percentile</option>
                            </select>
                        </div>
                        <div>
                            max trip time:
                            <select value={this.state.maxTripMin} onChange={this.handleMaxTripMinChange} className='isochrone-control-select'>
                                {tripMins.map(tripMin => (<option key={tripMin} value={tripMin}>{tripMin} minutes</option>))}
                            </select>
                        </div>
                        <div>
                            routes:
                            <div className='isochrone-select-all'>
                                <a href='javascript:void(0)' onClick={this.selectAllRoutesClicked}>all</a>
                                {" / "}
                                <a href='javascript:void(0)' onClick={this.selectNoRoutesClicked}>none</a>
                            </div>
                            <div className='isochrone-routes'>
                                {(routes || []).map(route => this.makeRouteToggle(route))}
                            </div>
                        </div>
                        <button onClick={this.resetMapClicked}>Clear</button>
                    </div>
                </Control>
                <Control position="topright">
                    <div className="isochrone-trip-info">
                        {this.state.tripInfo}
                    </div>
                </Control>
                <Control position="bottomright">
                    <div className="isochrone-legend">
                        trip times (minutes)
                        <div className="isochrone-legend-colors">
                            {colors}
                        </div>
                        <div className="isochrone-legend-times">
                            {times}
                        </div>
                    </div>
                </Control>
            </Map>
        </div>;
    }
}

const mapStateToProps = state => ({
    routes: state.routes.routes,
    date: state.routes.graphParams.date,
    start_time: state.routes.graphParams.start_time,
    end_time: state.routes.graphParams.end_time
});

const mapDispatchToProps = dispatch => ({
    fetchRoutes: () => dispatch(fetchRoutes()),
});

export default connect(
    mapStateToProps,
    mapDispatchToProps,
)(Isochrone);

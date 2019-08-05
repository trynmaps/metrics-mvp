import React, { useEffect, useState } from 'react';
import { connect } from 'react-redux';
import { Map, TileLayer } from 'react-leaflet';
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

let redIcon = new L.Icon({
  iconUrl: process.env.PUBLIC_URL + '/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

let computeCache = {};

let mapRef = React.createRef();

var workerUrl = process.env.PUBLIC_URL + '/isochrone-worker.js?v=' + Math.random();
if (metricsBaseURL)
{
    workerUrl += '&base=' + encodeURIComponent(metricsBaseURL);
}

workerUrl += '&routes_url=' + encodeURIComponent(routesUrl);

let isochroneWorker = new Worker(workerUrl);

let layers = [];
let isochroneLayers = [];
let tripLayers = [];

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

function Isochrone(props) {

  useEffect(() => {
    if (!props.routes) {
      props.fetchRoutes();
    }
    
    const myEnabledRoutes = {};
    for (let routeId of DefaultDisabledRoutes)
    {
        myEnabledRoutes[routeId] = false;
    }
    setEnabledRoutes(myEnabledRoutes);
    
  }, []);  // like componentDidMount, this runs only on first render

        const [stat, setStat] = useState('median');
        const [maxTripMin, setMaxTripMin] = useState(90);
        const [computedMaxTripMin, setComputedMaxTripMin] = useState(null);
        const [computeId, setComputeId] = useState(null);
        const [computing, setComputing] = useState(false);
        const [latLng, setLatLng] = useState(null);
        const [endLatLng, setEndLatLng] = useState(null);
        const [tripInfo, setTripInfo] = useState(null);
        const [enabledRoutes, setEnabledRoutes] = useState({});

        useEffect(() => {
          recomputeIsochrones();
        }, [props.date, props.start_time, props.end_time, stat, enabledRoutes]);
        
        useEffect(() => {
          maxTripMinChanged()
        }, [maxTripMin]);

        isochroneWorker.onmessage = onWorkerMessage;

    function onWorkerMessage(e)
    {
        let data = e.data;
        if (data.type === 'reachableLocations')
        {
            let myComputeId = data.computeId;
            if (computeCache[computeId])
            {
                computeCache[computeId][data.tripMin] = data;
            }
            if (myComputeId === computeId)
            {
                addReachableLocationsLayer(data);
            }
        }
        else if (data.type === 'error')
        {
            showError(data.error);
        }
        else
        {
            console.log(e.data);
        }
    }

    function showError(message)
    {
        alert(message);
    }

    function handleMapClick(event)
    {
        if (computeId)
        {
            return;
        }
        resetMap();
        computeIsochrones(event.latlng, null);
    }

    function addReachableLocationsLayer(data)
    {
        let tripMin = data.tripMin;
        let reachableCircles = data.circles;
        let geoJson = data.geoJson;

        if (computeId != data.computeId)
        {
            return;
        }

        if (computing && tripMin == maxTripMin)
        {
            setComputing(false);
        }

        let layerOptions = tripMinOptions['' + tripMin] || defaultLayerOptions;

        let diffLayer = L.geoJson(geoJson, Object.assign({bubblingMouseEvents: false, fillOpacity:0.4, stroke:false}, layerOptions));

        let map = mapRef.current.leafletElement;

        diffLayer.addTo(map);

        diffLayer.on('click', e => {
            let endLatLng = e.latlng;
            showTripInfo(endLatLng, reachableCircles);
        });

        diffLayer.on('dblclick', e => {
            resetMap();
            computeIsochrones(e.latlng);
        });

        isochroneLayers.push({tripMin: tripMin, layer: diffLayer});

        let curEndLatLng = endLatLng;

        // restore end latlng from previous view
        if (curEndLatLng && !tripLayers.length)
        {
            for (let circle of reachableCircles)
            {
                let dist = map.distance(circle, curEndLatLng);
                if (dist <= circle.radius)
                {
                    showTripInfo(curEndLatLng, reachableCircles);
                    break;
                }
            }
        }
    }

    function showTripInfo(endLatLng, reachableCircles)
    {
        setEndLatLng(endLatLng);

        let map = mapRef.current.leafletElement;

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

        clearTripLayers(false);

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
                            const routeInfo = props.routes.find(route => route.id === tripItem.route);

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

                                    tripLayers.push(polyLine);

                                    // draw small circles at fromStop and toStop
                                    tripLayers.push(L.circle(fromStopInfo, 40, {color:'#090', fillOpacity:0.8, stroke:false}).addTo(map));
                                    tripLayers.push(L.circle(toStopInfo, 40, {color:'#900', fillOpacity: 0.8, stroke:false}).addTo(map));
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

            tripLayers.push(marker);

            setTripInfo(tripInfo);
        }
    }

    function isInServiceArea(latLng)
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

    function computeIsochrones(latLng, endLatLng)
    {
        if (!isInServiceArea(latLng))
        {
            return;
        }

        const dateStr = props.date;
        const startTimeStr = props.start_time;
        const endTimeStr = props.end_time;
        const timeStr = (startTimeStr && endTimeStr) ? `${startTimeStr}-${endTimeStr}` : "";

        let enabledRoutesArr = [];

        for (var route of props.routes)
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

        setLatLng(latLng);
        setEndLatLng(endLatLng);
        setComputedMaxTripMin(maxTripMin);
        setComputeId(computeId);

        let map = mapRef.current.leafletElement;

        let newLatLng;
        let marker = L.marker(latLng, {draggable: true}).addTo(map);
        marker.on('move', function(e) {
            newLatLng = e.latlng;
        });
        marker.on('moveend', e => {
            if (newLatLng)
            {
                resetMap();
                computeIsochrones(newLatLng);
            }
        });
        layers.push(marker);

        if (computeCache[computeId] && computeCache[computeId][maxTripMin])
        {
            for (let tripMin = isochroneMinutes; tripMin <= maxTripMin; tripMin += isochroneMinutes)
            {
                let cachedLayer = computeCache[computeId][tripMin];
                if (cachedLayer)
                {
                    addReachableLocationsLayer(cachedLayer);
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

        setComputing(true);

        isochroneWorker.postMessage({
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

    function handleStatChange(event)
    {
        setStat(event.target.value);
    }

    function handleMaxTripMinChange(event)
    {
        setMaxTripMin(parseInt(event.target.value, 10));
    }

    function maxTripMinChanged()
    {
        if (computedMaxTripMin &&
            (maxTripMin > computedMaxTripMin || !isochroneLayers.find(iso => iso.tripMin === maxTripMin)))
        {
            recomputeIsochrones();
        }
        else
        {
            let map = mapRef.current.leafletElement;

            for (let isochroneLayer of isochroneLayers)
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

    function handleToggleRoute(event)
    {
        const routeId = event.target.value;
        const checked = event.target.checked;

        setEnabledRoutes({...enabledRoutes, [routeId]: checked}/*, this.recomputeIsochrones*/);
    }

    function selectAllRoutesClicked(event)
    {
        selectAllRoutes(true);
    }

    function selectNoRoutesClicked(event)
    {
        selectAllRoutes(false);
    }

    function resetMapClicked(event)
    {
        resetMap();
    }

    function recomputeIsochrones()
    {
        if (latLng)
        {
            resetMap();
            computeIsochrones(latLng, endLatLng);
        }
    }

    function resetMap()
    {
        let map = mapRef.current.leafletElement;

        map.closePopup();

        setComputeId(null);
        setLatLng(null);
        setEndLatLng(null);

        for (let isochroneLayer of isochroneLayers)
        {
            isochroneLayer.layer.remove();
        }
        for (let layer of layers)
        {
            layer.remove();
        }
        layers = [];
        isochroneLayers = [];
        clearTripLayers();
    }

    function clearTripLayers(clearTripInfo)
    {
        for (let layer of tripLayers)
        {
            layer.remove();
        }
        tripLayers = [];

        if (clearTripInfo !== false)
        {
            setTripInfo(null);
        }
    }

    function selectAllRoutes(enabled)
    {
        const {routes} = props;
        if (!routes)
        {
            return;
        }

        const enabledRoutes = {};
        for (let route of routes)
        {
            enabledRoutes[route.id] = enabled;
        }

        setEnabledRoutes(enabledRoutes);
    }

    function makeRouteToggle(route)
    {
        let enabled = enabledRoutes[route.id];
        if (enabled == null)
        {
            enabled = true;
        }

        return <div key={route.id}>
            <label>
                <input type="checkbox" checked={enabled} onChange={handleToggleRoute} value={route.id} /> {route.id}
            </label>
        </div>;
    }

        const {routes} = props;

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
                onClick={handleMapClick}
                ref={mapRef}
                >
                <TileLayer
                  attribution='Map tiles by <a href="http://stamen.com">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.'
                  url="https://stamen-tiles.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.png"
                /> {/* see http://maps.stamen.com for details */}
                <Control position="topleft">
                    <div className="isochrone-controls">
                        <div>
                            stat:
                            <select value={stat} onChange={handleStatChange} className='isochrone-control-select'>
                                <option value='p10'>10th percentile</option>
                                <option value='median'>median</option>
                                <option value='p90'>90th percentile</option>
                            </select>
                        </div>
                        <div>
                            max trip time:
                            <select value={maxTripMin} onChange={handleMaxTripMinChange} className='isochrone-control-select'>
                                {tripMins.map(tripMin => (<option key={tripMin} value={tripMin}>{tripMin} minutes</option>))}
                            </select>
                        </div>
                        <div>
                            routes:
                            <div className='isochrone-select-all'>
                                <a href='javascript:void(0)' onClick={selectAllRoutesClicked}>all</a>
                                {" / "}
                                <a href='javascript:void(0)' onClick={selectNoRoutesClicked}>none</a>
                            </div>
                            <div className='isochrone-routes'>
                                {(routes || []).map(route => makeRouteToggle(route))}
                            </div>
                        </div>
                        <button onClick={resetMapClicked}>Clear</button>
                    </div>
                </Control>
                <Control position="topright">
                    {tripInfo ?
                        <div className="isochrone-trip-info">{tripInfo}</div>
                        : <div className='isochrone-instructions'>{
                            !latLng ? 'Click anywhere in the city to see the trip times from that point to the rest of the city via Muni and walking.' :
                            computing ? 'Computing...' :
                            'Click anywhere in the shaded area to see routes and trip times between the two points, or drag the blue pin to see trip times from a new point.'
                        }</div>
                    }
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

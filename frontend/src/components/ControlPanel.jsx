/* eslint-disable react/prop-types */
import React, { useState } from 'react';
import { connect } from 'react-redux';
import { makeStyles } from '@material-ui/core/styles';
import FormControl from '@material-ui/core/FormControl';
import Navlink from 'redux-first-router-link';
import BackspaceIcon from '@material-ui/icons/Backspace';
import { getDownstreamStopIds } from '../helpers/mapGeometry';
import ReactSelect from './ReactSelect';
import DateTimeRangeControls from './DateTimeRangeControls';

const useStyles = makeStyles(() => ({
  root: {
    paddingLeft: 8,
  },
  formControl: {
    margin: '8px 8px 8px 0px',
    minWidth: 120,
    maxWidth: '100%',
  },
}));

/*
 * Renders controls for selecting a route, direction, start/end stops, and date range(s),
 * so that the user can select the metrics displayed on the route screen.
 */
function ControlPanel(props) {
  const { routes, graphParams } = props;
  let secondStopList = [];
  const [allowHover, setAllowHover] = useState(false);

  /**
   * Sets the direction
   */
  function onSelectDirectionId(option) {
    const directionId = option.value;

    props.dispatch({
      type: 'ROUTESCREEN',
      payload: {
        routeId: graphParams.routeId,
        directionId,
      },
      query: props.query,
    });
  }

  function getSelectedRouteInfo() {
    const routeId = props.graphParams.routeId;
    return routes ? routes.find(route => route.id === routeId) : null;
  }

  const selectedRoute = getSelectedRouteInfo();

  function onSelectFirstStop(option) {
    const startStopId = option.value;

    if (startStopId === graphParams.startStopId) {
      return;
    }

    props.dispatch({
      type: 'ROUTESCREEN',
      payload: {
        ...graphParams,
        startStopId,
      },
      query: props.query,
    });
  }

  function onSelectSecondStop(option) {
    const endStopId = option.value;

    if (endStopId === graphParams.endStopId) {
      return;
    }

    props.dispatch({
      type: 'ROUTESCREEN',
      payload: {
        ...graphParams,
        endStopId,
      },
      query: props.query,
    });
    // handleGraphParams called via thunk in ../routesMap.js when path changes, no need to call again
  }

  function onSelectRouteId(option) {
    const routeId = option.value;

    if (routeId === graphParams.routeId) {
      return;
    }

    props.dispatch({
      type: 'ROUTESCREEN',
      payload: {
        routeId,
      },
      query: props.query,
    });
  }
  /**
   * Handle mouseover event on Select TO & From dropdown list item.
   */
  function onStopMouseOver(stopId) {
    const mapNode = document.querySelector(`.id${stopId}`); // todo use redux state for this
    if (mapNode && allowHover) {
      mapNode.classList.add('on-hover');

      const hoverStop = selectedRoute ? selectedRoute.stops[stopId] : null;

      mapNode.style.setProperty(
        '--stop-name',
        `"${hoverStop ? hoverStop.title : ''}"`,
      );
    }
  }
  /**
   * Handle mouseout event on Select TO & From dropdown list item.
   */
  function onStopMouseOut(stopId) {
    const mapNode = document.querySelector(`.id${stopId}`);
    if (mapNode) {
      mapNode.classList.remove('on-hover');
    }
  }
  /**
   * Handle Select component close
   */
  function handleSelectClose() {
    setAllowHover(false);
    const nodeList = document.querySelectorAll('.on-hover');
    nodeList.forEach(node => node.classList.remove('on-hover'));
  }

  let selectedDirection = null;
  if (selectedRoute && selectedRoute.directions && graphParams.directionId) {
    selectedDirection = selectedRoute.directions.find(
      dir => dir.id === graphParams.directionId,
    );
  }

  if (selectedDirection) {
    secondStopList = getDownstreamStopIds(
      selectedRoute,
      selectedDirection,
      graphParams.startStopId,
    );
  }

  const classes = useStyles();

  const directionStops = selectedDirection ? selectedDirection.stops : [];

  const labelStyle = { whiteSpace: 'nowrap' };

  return (
    <div className={classes.root}>
      <FormControl className={classes.formControl}>
        <ReactSelect
          onChange={onSelectRouteId}
          inputId="route"
          textFieldProps={{
            label: (
              <span style={labelStyle}>
                Route{' '}
                <Navlink
                  to={{
                    type: 'DASHBOARD',
                    query: props.query,
                  }}
                >
                  <BackspaceIcon className="clear-filter" />
                </Navlink>
              </span>
            ),
            InputLabelProps: {
              htmlFor: 'route',
              shrink: true,
            },
          }}
          options={(routes || []).map(route => ({
            value: route.id,
            label: route.title,
          }))}
          placeholder="None"
          value={graphParams.routeId}
        />
      </FormControl>
      {selectedRoute ? (
        <FormControl className={classes.formControl}>
          <ReactSelect
            onChange={onSelectDirectionId}
            inputId="direction"
            textFieldProps={{
              label: (
                <span style={labelStyle}>
                  Direction{' '}
                  {graphParams.directionId ? (
                    <Navlink
                      to={{
                        type: 'ROUTESCREEN',
                        payload: {
                          ...graphParams,
                          directionId: null,
                          startStopId: null,
                          endStopId: null,
                        },
                        query: props.query,
                      }}
                    >
                      <BackspaceIcon className="clear-filter" />
                    </Navlink>
                  ) : null}
                </span>
              ),
              InputLabelProps: {
                htmlFor: 'direction',
                shrink: true,
              },
            }}
            options={(selectedRoute.directions || []).map(direction => ({
              value: direction.id,
              label: direction.title,
            }))}
            placeholder="All"
            value={graphParams.directionId}
          />
        </FormControl>
      ) : null}
      {selectedDirection ? (
        <>
          <FormControl className={classes.formControl}>
            <ReactSelect
              onChange={onSelectFirstStop}
              inputId="fromstop"
              textFieldProps={{
                label: (
                  <span style={labelStyle}>
                    Origin Stop{' '}
                    {graphParams.startStopId ? (
                      <Navlink
                        to={{
                          type: 'ROUTESCREEN',
                          payload: {
                            ...graphParams,
                            startStopId: null,
                            endStopId: null,
                          },
                          query: props.query,
                        }}
                      >
                        <BackspaceIcon className="clear-filter" />
                      </Navlink>
                    ) : null}
                  </span>
                ),
                InputLabelProps: {
                  htmlFor: 'fromstop',
                  shrink: true,
                },
              }}
              options={directionStops.map(firstStopId => ({
                value: firstStopId,
                label: (
                  selectedRoute.stops[firstStopId] || {
                    title: firstStopId,
                  }
                ).title,
              }))}
              placeholder="Search..."
              value={graphParams.startStopId}
              onOpen={() => setAllowHover(true)}
              onClose={handleSelectClose}
              onItemMouseOver={onStopMouseOver}
              onItemMouseOut={onStopMouseOut}
            />
          </FormControl>
          <FormControl className={classes.formControl}>
            <ReactSelect
              onChange={onSelectSecondStop}
              inputId="tostop"
              textFieldProps={{
                label: (
                  <span style={labelStyle}>
                    Destination Stop{' '}
                    {graphParams.endStopId ? (
                      <Navlink
                        to={{
                          type: 'ROUTESCREEN',
                          payload: {
                            ...graphParams,
                            endStopId: null,
                          },
                          query: props.query,
                        }}
                      >
                        <BackspaceIcon className="clear-filter" />
                      </Navlink>
                    ) : null}
                  </span>
                ),
                InputLabelProps: {
                  htmlFor: 'tostop',
                  shrink: true,
                },
              }}
              options={(secondStopList || []).map(secondStopId => ({
                value: secondStopId,
                label: (
                  selectedRoute.stops[secondStopId] || {
                    title: secondStopId,
                  }
                ).title,
              }))}
              placeholder="Search..."
              value={graphParams.endStopId}
              onOpen={() => setAllowHover(true)}
              onClose={handleSelectClose}
              onItemMouseOver={onStopMouseOver}
              onItemMouseOut={onStopMouseOut}
            />
          </FormControl>
        </>
      ) : null}
      <DateTimeRangeControls compareSupported />
    </div>
  );
}

const mapStateToProps = state => ({
  graphParams: state.graphParams,
  query: state.location.query,
});

const mapDispatchToProps = dispatch => {
  return {
    dispatch,
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(ControlPanel);

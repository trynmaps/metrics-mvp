/* eslint-disable react/prop-types */
import React, { useState } from 'react';
import { connect } from 'react-redux';
import { makeStyles } from '@material-ui/core/styles';
import FormControl from '@material-ui/core/FormControl';
// import StartStopIcon from '@material-ui/icons/DirectionsTransit';
// import EndStopIcon from '@material-ui/icons/Flag';
import Navlink from 'redux-first-router-link';
import BackspaceIcon from '@material-ui/icons/Backspace';
import red from '@material-ui/core/colors/red';
import { getDownstreamStopIds } from '../helpers/mapGeometry';
import ReactSelect from './ReactSelect';
import DateRangeControl from './DateRangeControl';
import TimeRangeControl from './TimeRangeControl';

const useStyles = makeStyles(() => ({
  root: {
    paddingLeft: 8,
  },
  formControl: {
    margin: '8px 8px 8px 0px',
    minWidth: 120,
    maxWidth: '100%',
  },
  backspaceIcon: {
    color: red[900],
    fontSize: 19,
    verticalAlign: '-4px',
    opacity: 0.6,
    '&:hover': {
      opacity: 1.0,
    },
  },
}));

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
                  <BackspaceIcon className={classes.backspaceIcon} />
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
                      <BackspaceIcon className={classes.backspaceIcon} />
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
                        <BackspaceIcon className={classes.backspaceIcon} />
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
                        <BackspaceIcon className={classes.backspaceIcon} />
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
      <span style={{ whiteSpace: 'nowrap' }}>
        <DateRangeControl dateRangeSupported />
        <TimeRangeControl />
      </span>
    </div>
  );
}

// for this entire component, now using graphParams values in Redux instead of local state.
const mapStateToProps = state => ({
  graphParams: state.graphParams,
  query: state.location.query,
});

const mapDispatchToProps = dispatch => {
  return {
    dispatch,
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(ControlPanel);

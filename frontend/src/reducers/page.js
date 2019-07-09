import { NOT_FOUND } from 'redux-first-router';

const components = {
  HOME: 'Home',
  ABOUT: 'About',
  ISOCHRONE: 'Isochrone',
  LANDING: 'Landing',
  DASHBOARD: 'Dashboard',
  ROUTESCREEN: 'Route',
  RECEIVED_GRAPH_PARAMS: 'Route',
  [NOT_FOUND]: 'NotFound',
};

export default (state = 'HOME', action = {}) =>
  components[action.type] || state;

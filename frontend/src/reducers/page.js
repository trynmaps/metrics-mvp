import { NOT_FOUND } from 'redux-first-router';

const components = {
  ABOUT: 'About',
  ISOCHRONE: 'Isochrone',
  LANDING: 'Landing',
  DASHBOARD: 'Dashboard',
  ROUTESCREEN: 'Route',
  DATADIAGNOSTIC: 'DataDiagnostic',
  [NOT_FOUND]: 'NotFound',
};

export default (state = 'DASHBOARD', action = {}) =>
  components[action.type] || state;

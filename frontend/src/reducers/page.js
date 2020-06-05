import { NOT_FOUND } from 'redux-first-router';

export const components = {
  ABOUT: 'About',
  ISOCHRONE: 'Isochrone',
  HOME: 'Home',
  DASHBOARD: 'Dashboard',
  ROUTESCREEN: 'RouteScreen',
  DATADIAGNOSTIC: 'DataDiagnostic',
  [NOT_FOUND]: 'NotFound',
};

/**
 * Find the current dispatch type.  This is the key of the "components" object
 * whose value matches the current page name.
 */
export function typeForPage(page) {
  let currentType = null;
  const types = Object.keys(components);
  for (let i = 0; i < types.length; i++) {
    if (page === components[types[i]]) {
      currentType = types[i];
      break;
    }
  }
  return currentType;
}

export default (state = 'DASHBOARD', action = {}) =>
  components[action.type] || state;

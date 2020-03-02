import { APP_NAME } from '../UIConstants';

const DEFAULT = APP_NAME;

export default (state = DEFAULT, action = {}) => {
  switch (action.type) {
    case 'DASHBOARD':
      return `Dashboard | ${DEFAULT}`;
    case 'ABOUT':
      return `About | ${DEFAULT}`;
    case 'ISOCHRONE':
      return `Isochrone | ${DEFAULT}`;
    case 'ROUTESCREEN':
      return `Routes | ${DEFAULT}`;
    default:
      return state;
  }
};

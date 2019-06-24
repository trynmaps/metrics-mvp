import { NOT_FOUND } from 'redux-first-router';

const components = {
  HOME: 'Home',
  ABOUT: 'About',
  LANDING: 'Landing',
  DASHBOARD: 'Dashboard',
  [NOT_FOUND]: 'NotFound',
};

export default (state = 'HOME', action = {}) =>
  components[action.type] || state;

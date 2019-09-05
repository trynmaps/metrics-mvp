import { handleGraphParams } from './actions';

export default {
  HOME: '/home',
  ABOUT: '/about',
  LANDING: '/landing',
  ISOCHRONE: '/isochrone',
  DASHBOARD: '/',
  DATADIAGNOSTIC: '/dataDiagnostic',
  ROUTESCREEN: {
    /*
    Redux first router path syntax
    https://github.com/faceyspacey/redux-first-router/issues/83
    the : symbol signifies variables
    the ? after the : means an optional paramter variable
    ()* shows am optional parameter label
    */
    path:
      '/route/:routeId/(direction)*/:directionId?/(startStop)*/:startStopId?/(endStop)*/:endStopId?',
    thunk: async (dispatch, getState) => {
      const { location } = getState();
      const { routeId, directionId, startStopId, endStopId } = location.payload;

      dispatch(
        handleGraphParams({
          routeId,
          directionId,
          startStopId,
          endStopId,
        }),
      );
    },
  },
};

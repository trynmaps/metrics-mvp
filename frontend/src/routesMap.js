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
      '/route/:route_id/(direction)*/:direction_id?/(start_stop)*/:start_stop_id?/(end_stop)*/:end_stop_id?',
    thunk: async (dispatch, getState) => {
      const { location } = getState();
      const {
        route_id,
        direction_id,
        start_stop_id,
        end_stop_id,
      } = location.payload;

      dispatch(
        handleGraphParams({
          route_id,
          direction_id,
          start_stop_id,
          end_stop_id,
        }),
      );
    },
  },
};

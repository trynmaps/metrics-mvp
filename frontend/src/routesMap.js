import { handleGraphParams } from './actions';
import { Agencies } from './config';

export default {
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
    path: `/route/:routeId/:directionId?/:startStopId?/:endStopId?`,
    thunk: async (dispatch, getState) => {
      const { location } = getState();
      const { routeId, directionId, startStopId, endStopId } = location.payload;

      // todo: add agency to path to support multiple agencies
      dispatch(
        handleGraphParams({
          agencyId: Agencies[0].id,
          routeId,
          directionId,
          startStopId,
          endStopId,
        }),
      );
    },
  },
};

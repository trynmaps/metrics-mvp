import { handleGraphParams } from './actions';
import { ROUTE, DIRECTION, FROM_STOP, TO_STOP } from './routeUtil';

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
    path: `/${ROUTE}/:routeId/(${DIRECTION})*/:directionId?/(${FROM_STOP})*/:startStopId?/(${TO_STOP})*/:endStopId?`,
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

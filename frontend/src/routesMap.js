import {handleGraphParams} from './actions';
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
    path: `/${ROUTE}/:route_id/(${DIRECTION})*/:direction_id?/(${FROM_STOP})*/:start_stop_id?/(${TO_STOP})*/:end_stop_id?`,
    thunk: async (dispatch, getState) => {
      const {location} = getState();
      const {route_id, direction_id,start_stop_id, end_stop_id } = location.payload;


      dispatch(handleGraphParams({
      	routeId: route_id,
      	directionId: direction_id,
      	startStopId: start_stop_id,
      	endStopId: end_stop_id
      }));
    }
  },
};

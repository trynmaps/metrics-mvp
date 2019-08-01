import { redirect, NOT_FOUND } from 'redux-first-router'
import {handleGraphParams} from './actions';
export default {
  HOME: '/home',
  ABOUT: '/about',
  LANDING: '/landing',
  ISOCHRONE: '/isochrone',
  DASHBOARD: '/',
  ROUTESCREEN: {
    path: '/route/:route_id/(direction)*/:direction_id?/(start_stop)*/:start_stop_id?/(end_stop)*/:end_stop_id?',
    thunk: async (dispatch, getState) => {
      const {location} = getState();
      const {route_id, direction_id,start_stop_id, end_stop_id } = location.payload;


      dispatch(handleGraphParams({
      	route_id,
      	direction_id,
      	start_stop_id,
      	end_stop_id
      }));
    }
  },
};

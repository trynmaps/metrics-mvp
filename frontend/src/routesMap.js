import { redirect, NOT_FOUND } from 'redux-first-router'

export default {
  HOME: '/home',
  ABOUT: '/about',
  LANDING: '/landing',
  DASHBOARD: '/',
  ROUTESCREEN: {
    path: '/route/:route_id/:direction_id?/:start_stop_id?/:end_stop_id?',
    thunk: async (dispatch, getState) => {
      const {location} = getState();
      const {route_id, direction_id,start_stop_id, end_stop_id } = location.payload
      debugger;

      dispatch({ type: 'RECEIVED_GRAPH_PARAMS', payload: {
      	route_id,
      	direction_id,
      	start_stop_id,
      	end_stop_id
      }});
    }
  },
};

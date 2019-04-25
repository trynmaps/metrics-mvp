const initialState = {
  fetching: false,
  routes: null,
};

export default (state = initialState, action) => {
  switch(action.type) {
    case "RECEIVED_ROUTES":
      return {...state,fetched:true,routes:action.payload};
    case "RECEIVED_ROUTE_CONFIG":
      let { routes } = state;
      const routeConfig = action.payload;
      const routeId = routeConfig.id;
      if (!routes) {
        routes = [];
      }

      // update the array of all routes to store full configuration
      // for the requested route (directions, stops, etc.)
      const route = routes.find(route => (route.id === routeId));
      if (route) {
        Object.assign(route, routeConfig);
      } else {
        routes.push(routeConfig);
      }
      return {...state, fetched:true, routes:routes.slice()};
    case "RECEIVED_ROUTES_ERROR":
      break;
    default:
      return state;
  }
}

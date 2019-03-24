export default function reducer(state={
	fetching: false,
	routes:null
}, action){
	switch(action.type){
		case "RECEIVED_ROUTES":{
			return {...state,fetched:true,routes:action.payload};
		}
        case "RECEIVED_ROUTE_CONFIG":{
            let { routes } = state;
            const routeConfig = action.payload;
            const routeId = routeConfig.id;
            if (!routes) {
              routes = [];
            }

            const route = routes.find(route => (route.id === routeId));
            if (route) {
              Object.assign(route, routeConfig);
            } else {
              routes.push(routeConfig);
            }

			return {...state, fetched:true, routes:routes.slice()};
		}
		case "RECEIVED_ROUTES_ERROR":
            break;
        default:
            break;
	}
	return state;
}


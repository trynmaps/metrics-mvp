import { combineReducers } from "redux"
import fetchGraphReducer from "./fetchGraphReducer";
import routesReducer from "./routesReducer";

export default combineReducers({
    graphData: fetchGraphReducer,
    routes: routesReducer
})
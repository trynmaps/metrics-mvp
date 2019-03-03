import { combineReducers } from "redux"
import fetchGraphReducer from "./fetchGraphReducer";

export default combineReducers({
	graphData: fetchGraphReducer
})
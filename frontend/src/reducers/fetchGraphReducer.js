export default function reducer(state={
	fetching: false,
	graphData:null
}, action){
	switch(action.type){
		case "RECEIVED_GRAPH_DATA":{
			return {...state,fetched:true,graphData:action.payload};	
		}
		case "RECEIVED_GRAPH_ERROR":{
		}	
	}
	return state;
}


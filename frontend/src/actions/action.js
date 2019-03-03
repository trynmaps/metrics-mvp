import axios from "axios";

export function fetchGraphData(data) {
    return function(dispatch) {
        axios.get("/metricsAPI", {
        
                params: {
                    route_id: data[0],
                    stop_id: data[1],
                    direction: data[2] === "inbound" ? "O" : "I",
                    date: data[3],
                    date2: data[4]
                }
            }) 
            .then((response) => {
                dispatch({ type: "RECEIVED_GRAPH_DATA", payload: response.data })
            })
            .catch((err) => {
                dispatch({ type: "RECEIVED_GRAPH_ERROR", payload: err })
            })
        }
    }
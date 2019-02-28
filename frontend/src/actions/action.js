import axios from "axios";

export function fetchGraphData() {
    return function(dispatch) {
        axios.post("/ajaxCall",{})
            .then((response) => {
                dispatch({ type: "RECEIVED_GRAPH_DATA", payload: response.data })
            })
            .catch((err) => {
                dispatch({ type: "RECEIVED_GRAPH_ERROR", payload: err })
            })
    }
}
/* eslint-disable no-case-declarations */

/**
 * This reducer tracks the loading (is fetching) state of all asynchronous
 * data calls, as described in:
 * https://medium.com/stashaway-engineering/react-redux-tips-better-way-to-handle-loading-flags-in-your-reducers-afda42a804c6
 *
 * The action names must follow this pattern:
 *
 * - REQUEST_XXX
 * - RECEIVED_XXX
 * - ERROR_XXX
 *
 * where XXX is something like GRAPH_DATA.
 *
 * Then state.loading.GRAPH_DATA will be true if the REQUEST was the last action and
 * false otherwise.
 *
 */
export default (state = {}, action) => {
  const { type } = action;
  const matches = /(REQUEST|RECEIVED|ERROR)_(.*)/.exec(type);

  // not a REQUEST_* / RECEIVED_* / FAILURE_* action, so we ignore them

  if (!matches) return state;

  const [, requestState, requestName] = matches;
  return {
    ...state,
    // Store whether a request is happening at the moment or not
    // e.g. will be true when receiving REQUEST_GRAPH_DATA
    //      and false when receiving RECEIVED_GRAPH_DATA / ERROR_GRAPH_DATA
    [requestName]: requestState === 'REQUEST',
  };
};

/**
 * Selector function returnig whether a loading indicator is needed.
 * This is a simplistic function that returns true if anything is being
 * fetched.  It could be enhanced to accept an argument specifying which
 * kinds of requests to return true for.
 *
 * @param state App state passed in via mapStateToProps
 * @returns Whether any loading is going on
 */
export function isLoadingRequest(state) {
  const isLoading = Object.keys(state.loading).reduce(
    (accumulator, currentValue) => accumulator || state.loading[currentValue],
    false,
  );
  return isLoading;
}

import React from 'react';
import { connect } from 'react-redux';
import { Box, CircularProgress } from '@material-ui/core';
import { isLoadingRequest } from '../reducers/loadingReducer';

/*
 * Renders a spinning progress icon when any requests are loading.
 */
function LoadingIndicator(props) {
  return props.isLoading ? (
    <Box p={1}>
      <CircularProgress
        variant="indeterminate"
        disableShrink
        style={{ color: 'white' }}
        size={24}
      />
    </Box>
  ) : null;
}

const mapStateToProps = state => ({
  isLoading: isLoadingRequest(state),
});

export default connect(mapStateToProps)(LoadingIndicator);

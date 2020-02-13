import React from 'react';
import { connect } from 'react-redux';
import Box from '@material-ui/core/Box';
import CircularProgress from '@material-ui/core/CircularProgress';
import { isLoadingRequest } from '../reducers/loadingReducer';

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

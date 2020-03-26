import React, { Fragment } from 'react';
import Link from 'redux-first-router-link';

export default function NotFound() {
  return (
    <Fragment>
      <h2>
        This train went off the rails!{' '}
        <span role="img" aria-label="train-crash">
          🚈💥
        </span>
      </h2>

      <p>
        Sorry, but we can&apos;t find what you&apos;re looking for. This link
        might be malformed.
      </p>

      <p>
        Try going <Link to="/">back to the main page</Link>.
      </p>
    </Fragment>
  );
}

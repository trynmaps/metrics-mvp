/**
 * Emoji wrapper component adapted from https://github.com/SeanMcP/a11y-react-emoji/blob/master/src/Emoji.tsx
 *
 * See also https://www.npmjs.com/package/a11y-react-emoji
 */

import React from 'react';
import { ROUTE_TYPE_EMOJIS } from '../UIConstants';

function Emoji(props) {
  const { label, symbol, ...rest } = props;
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label ? label : undefined}
      role="img"
      {...rest}
    >
      {symbol}
    </span>
    );
};

/**
 * Returns an accessible emoji corresponding to the given route type.
 *
 * @param type {Number} GTFS route type
 */
export function EmojiForRouteType(type) {
  const emojiProps = ROUTE_TYPE_EMOJIS[type];
  if (emojiProps) {
    return Emoji(emojiProps);
  } else {
    return '';
  }
}

export default Emoji;

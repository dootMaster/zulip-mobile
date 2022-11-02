/* @flow strict-local */
import React from 'react';
import type { Node } from 'react';
import { View } from 'react-native';

import ZulipTextIntl from './ZulipTextIntl';
import { createStyleSheet } from '../styles';

const styles = createStyleSheet({
  field: {
    flexDirection: 'row',
    marginTop: 5,
    marginBottom: 5,
    justifyContent: 'center',
  },
  error: {
    color: 'red',
    fontSize: 16,
  },
});

type Props = $ReadOnly<{|
  error: string,
|}>;

/**
 * Displays a styled error message.
 * If no message provided, component is not rendered.
 *
 * @prop error - The error message string.
 */
export default function ErrorMsg(props: Props): Node {
  const { error } = props;

  if (!error) {
    return null;
  }

  return (
    <View style={styles.field}>
      <ZulipTextIntl style={styles.error} text={error} />
    </View>
  );
}

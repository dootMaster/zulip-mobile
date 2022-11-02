/* @flow strict-local */
import React from 'react';
import type { Node } from 'react';
import { View } from 'react-native';

import ZulipText from '../common/ZulipText';
import { createStyleSheet } from '../styles';
import { numberWithSeparators } from '../utils/misc';

const styles = createStyleSheet({
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    borderBottomWidth: 1,
    borderColor: 'hsla(0, 0%, 50%, 0.25)',
  },
  key: {},
  size: {
    fontWeight: 'bold',
  },
});

type Props = $ReadOnly<{|
  text: string,
  size: number,
|}>;

export default function SizeItem(props: Props): Node {
  const { text, size } = props;

  return (
    <View style={styles.item}>
      <ZulipText style={styles.key} text={text} />
      <ZulipText style={styles.size} text={numberWithSeparators(size)} />
    </View>
  );
}

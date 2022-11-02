/* @flow strict-local */
import invariant from 'invariant';

import type { ReadWrite } from '../generics';
import type { PerAccountApplicableAction, FlagsState, Message } from '../types';
import {
  REGISTER_COMPLETE,
  MESSAGE_FETCH_COMPLETE,
  EVENT_NEW_MESSAGE,
  EVENT_UPDATE_MESSAGE_FLAGS,
  LOGOUT,
  LOGIN_SUCCESS,
  ACCOUNT_SWITCH,
} from '../actionConstants';
import { deeperMerge } from '../utils/misc';
import type { UserMessageFlag } from '../api/modelTypes';

type ReadWriteFlagsState = $Rest<ReadWrite<$ObjMap<FlagsState, <V>(V) => ReadWrite<V>>>, { ... }>;
type ReadWritePerFlagState = $Values<ReadWriteFlagsState>;

const initialState = {
  read: {},
  starred: {},
  collapsed: {},
  mentioned: {},
  wildcard_mentioned: {},
  has_alert_word: {},
  historical: {},
};

const addFlagsForMessages = (
  state: FlagsState,
  messages: $ReadOnlyArray<number>,
  flags: $ReadOnlyArray<UserMessageFlag>,
): FlagsState => {
  if (messages.length === 0 || flags.length === 0) {
    return state;
  }

  /* $FlowFixMe[incompatible-exact] - We should ignore flags from the server
     that we don't already know about. After all, we can't have any code
     intending to do anything with them. */
  const newState: ReadWriteFlagsState = {};

  flags.forEach(flag => {
    const perFlag: ReadWritePerFlagState = { ...(state[flag] || {}) };
    messages.forEach(message => {
      perFlag[message] = true;
    });
    newState[flag] = perFlag;
  });

  return {
    ...state,
    ...newState,
  };
};

const removeFlagForMessages = (
  state: FlagsState,
  messages: $ReadOnlyArray<number>,
  flag: string,
): FlagsState => {
  const newStateForFlag = { ...(state[flag] || {}) };
  messages.forEach(message => {
    delete newStateForFlag[message];
  });
  return {
    ...state,

    // TODO: We should ignore flags from the server that we don't already
    // know about. After all, we can't have any code intending to do
    // anything with them. Flow should be complaining here:
    //   https://chat.zulip.org/#narrow/stream/243-mobile-team/topic/Flow.20spread.20bug/near/1318081
    [flag]: newStateForFlag,
  };
};

const processFlagsForMessages = (
  state: FlagsState,
  messages: $ReadOnlyArray<Message>,
): FlagsState => {
  let stateChanged = false;
  /* $FlowFixMe[incompatible-exact] - We should ignore flags from the server
     that we don't already know about. After all, we can't have any code
     intending to do anything with them. */
  const newState: ReadWriteFlagsState = {};
  messages.forEach(msg => {
    (msg.flags || []).forEach(flag => {
      if (!state[flag] || !state[flag][msg.id]) {
        const perFlag: ReadWritePerFlagState = newState[flag] || (newState[flag] = {});
        perFlag[msg.id] = true;
        stateChanged = true;
      }
    });
  });

  /* $FlowFixMe[incompatible-indexer]: Flow can't follow this
     objects-as-maps logic. */
  return stateChanged ? deeperMerge(state, newState) : state;
};

const eventUpdateMessageFlags = (state, action) => {
  if (action.all) {
    if (action.op === 'add') {
      return addFlagsForMessages(initialState, Object.keys(action.allMessages).map(Number), [
        action.flag,
      ]);
    }

    if (action.op === 'remove') {
      // TODO: We should ignore flags from the server that we don't already
      // know about. After all, we can't have any code intending to do
      // anything with them. Flow should be complaining here:
      //   https://chat.zulip.org/#narrow/stream/243-mobile-team/topic/Flow.20spread.20bug/near/1318081
      return { ...state, [(action.flag: string)]: {} };
    }
  }

  if (action.op === 'add') {
    return addFlagsForMessages(state, action.messages, [action.flag]);
  }

  if (action.op === 'remove') {
    return removeFlagForMessages(state, action.messages, action.flag);
  }

  return state;
};

export default (
  state: FlagsState = initialState, // eslint-disable-line default-param-last
  action: PerAccountApplicableAction,
): FlagsState => {
  switch (action.type) {
    case REGISTER_COMPLETE:
    case LOGOUT:
    case LOGIN_SUCCESS:
    case ACCOUNT_SWITCH:
      return initialState;

    case MESSAGE_FETCH_COMPLETE:
      return processFlagsForMessages(state, action.messages);

    case EVENT_NEW_MESSAGE: {
      invariant(action.message.flags, 'message in EVENT_NEW_MESSAGE must have flags');
      return addFlagsForMessages(state, [action.message.id], action.message.flags);
    }

    case EVENT_UPDATE_MESSAGE_FLAGS:
      return eventUpdateMessageFlags(state, action);

    default:
      return state;
  }
};

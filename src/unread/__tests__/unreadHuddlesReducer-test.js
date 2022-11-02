/* @flow strict-local */
import deepFreeze from 'deep-freeze';

import unreadHuddlesReducer from '../unreadHuddlesReducer';
import { ACCOUNT_SWITCH, EVENT_UPDATE_MESSAGE_FLAGS } from '../../actionConstants';
import { NULL_ARRAY } from '../../nullObjects';
import * as eg from '../../__tests__/lib/exampleData';
import { makeUserId } from '../../api/idTypes';

describe('unreadHuddlesReducer', () => {
  describe('ACCOUNT_SWITCH', () => {
    test('resets state to initial state', () => {
      const initialState = deepFreeze([
        {
          user_ids_string: '0,1,2',
          unread_message_ids: [1, 2, 3],
        },
      ]);

      const action = deepFreeze({
        type: ACCOUNT_SWITCH,
        index: 1,
      });

      const expectedState = [];

      const actualState = unreadHuddlesReducer(initialState, action, eg.plusReduxState);

      expect(actualState).toEqual(expectedState);
    });
  });

  describe('REGISTER_COMPLETE', () => {
    test('received data from "unread_msgs.huddles" key replaces the current state ', () => {
      const initialState = deepFreeze([]);

      const action = eg.mkActionRegisterComplete({
        unread_msgs: {
          streams: [],
          huddles: [
            {
              user_ids_string: '0,1,2',
              unread_message_ids: [1, 2, 4, 5],
            },
          ],
          pms: [],
          mentions: [1, 2, 3],
        },
      });

      const expectedState = [
        {
          user_ids_string: '0,1,2',
          unread_message_ids: [1, 2, 4, 5],
        },
      ];

      const actualState = unreadHuddlesReducer(initialState, action, eg.plusReduxState);

      expect(actualState).toEqual(expectedState);
    });
  });

  describe('EVENT_NEW_MESSAGE', () => {
    test('if message id already exists, do not mutate state', () => {
      const user1 = eg.makeUser({ user_id: 1 });
      const user2 = eg.makeUser({ user_id: 2 });
      const user3 = eg.makeUser({ user_id: 3 });

      const message1 = eg.pmMessage({ id: 1, recipients: [user1, user2, user3] });
      const message2 = eg.pmMessage({ id: 2, recipients: [user1, user2, user3] });
      const message3 = eg.pmMessage({ id: 3, recipients: [user1, user2, user3] });

      const initialState = deepFreeze([
        {
          user_ids_string: `${user1.user_id},${user2.user_id},${user3.user_id}`,
          unread_message_ids: [message1.id, message2.id, message3.id],
        },
      ]);

      const action = eg.mkActionEventNewMessage(message2);

      const actualState = unreadHuddlesReducer(initialState, action, eg.plusReduxState);

      expect(actualState).toBe(initialState);
    });

    test('if message is not group, return original state', () => {
      const streamMessage = eg.streamMessage();
      const initialState = deepFreeze([
        {
          user_ids_string: '1,2,3',
          unread_message_ids: [1, 2, 3],
        },
      ]);

      const action = eg.mkActionEventNewMessage(streamMessage);

      const actualState = unreadHuddlesReducer(initialState, action, eg.plusReduxState);

      expect(actualState).toBe(initialState);
    });

    test('if message has "read" flag, do not mutate state', () => {
      const selfUser = { ...eg.selfUser, user_id: makeUserId(1) };
      const user2 = { ...eg.otherUser, user_id: makeUserId(2) };
      const user3 = { ...eg.thirdUser, user_id: makeUserId(3) };

      const initialState = deepFreeze([]);

      const message2 = eg.pmMessage({
        sender: user2,
        recipients: [selfUser, user2, user3],
        flags: ['read'],
      });

      const action = eg.mkActionEventNewMessage(message2, { ownUserId: selfUser.user_id });

      const actualState = unreadHuddlesReducer(initialState, action, eg.plusReduxState);

      expect(actualState).toBe(initialState);
    });

    test('if message id does not exist, append to state', () => {
      const selfUser = { ...eg.selfUser, user_id: makeUserId(1) };
      const user2 = { ...eg.otherUser, user_id: makeUserId(2) };
      const user3 = { ...eg.thirdUser, user_id: makeUserId(3) };

      const message4 = eg.pmMessage({ id: 4, recipients: [selfUser, user2, user3] });

      const initialState = deepFreeze([
        {
          user_ids_string: `${selfUser.user_id},${user2.user_id},${user3.user_id}`,
          unread_message_ids: [1, 2, 3],
        },
      ]);

      const action = eg.mkActionEventNewMessage(message4);

      const expectedState = [
        {
          user_ids_string: `${selfUser.user_id},${user2.user_id},${user3.user_id}`,
          unread_message_ids: [1, 2, 3, 4],
        },
      ];

      const actualState = unreadHuddlesReducer(initialState, action, eg.plusReduxState);

      expect(actualState).toEqual(expectedState);
    });

    test('if sender-ids string does not exist, append to state as new', () => {
      const user1 = { ...eg.selfUser, user_id: makeUserId(1) };
      const user2 = { ...eg.otherUser, user_id: makeUserId(2) };
      const user3 = { ...eg.thirdUser, user_id: makeUserId(3) };

      const message4 = eg.pmMessage({ id: 4, recipients: [user1, user2, user3] });
      const initialState = deepFreeze([
        {
          user_ids_string: '0,3,4',
          unread_message_ids: [1, 2, 3],
        },
      ]);

      const action = eg.mkActionEventNewMessage(message4);

      const expectedState = [
        {
          user_ids_string: '0,3,4',
          unread_message_ids: [1, 2, 3],
        },
        {
          user_ids_string: `${user1.user_id},${user2.user_id},${user3.user_id}`,
          unread_message_ids: [4],
        },
      ];

      const actualState = unreadHuddlesReducer(initialState, action, eg.plusReduxState);

      expect(actualState).toEqual(expectedState);
    });
  });

  describe('EVENT_UPDATE_MESSAGE_FLAGS', () => {
    test('when operation is "add" but flag is not "read" do not mutate state', () => {
      const initialState = deepFreeze([]);

      const action = {
        id: 1,
        type: EVENT_UPDATE_MESSAGE_FLAGS,
        all: false,
        allMessages: eg.makeMessagesState([]),
        messages: [1, 2, 3],
        flag: 'starred',
        op: 'add',
      };

      const actualState = unreadHuddlesReducer(initialState, action, eg.plusReduxState);

      expect(actualState).toBe(initialState);
    });

    test('if id does not exist do not mutate state', () => {
      const initialState = deepFreeze([
        {
          user_ids_string: '0,1,2',
          unread_message_ids: [1, 2, 3, 4, 5],
        },
        {
          user_ids_string: '0,3,4',
          unread_message_ids: [4, 5],
        },
      ]);

      const action = deepFreeze({
        id: 1,
        type: EVENT_UPDATE_MESSAGE_FLAGS,
        all: false,
        allMessages: eg.makeMessagesState([]),
        messages: [6, 7],
        flag: 'read',
        op: 'add',
      });

      const actualState = unreadHuddlesReducer(initialState, action, eg.plusReduxState);

      expect(actualState).toBe(initialState);
    });

    test('if ids are in state remove them', () => {
      const initialState = deepFreeze([
        {
          user_ids_string: '0,1,2',
          unread_message_ids: [1, 2, 3],
        },
        {
          user_ids_string: '0,3,4',
          unread_message_ids: [4, 5],
        },
      ]);

      const action = deepFreeze({
        id: 1,
        type: EVENT_UPDATE_MESSAGE_FLAGS,
        all: false,
        allMessages: eg.makeMessagesState([]),
        messages: [3, 4, 5, 6],
        flag: 'read',
        op: 'add',
      });

      const expectedState = [
        {
          user_ids_string: '0,1,2',
          unread_message_ids: [1, 2],
        },
      ];

      const actualState = unreadHuddlesReducer(initialState, action, eg.plusReduxState);

      expect(actualState).toEqual(expectedState);
    });

    test('when operation is "remove", add to unreads', () => {
      const initialState = deepFreeze([
        {
          user_ids_string: '0,1,2',
          unread_message_ids: [1, 2, 3, 4, 100],
        },
      ]);

      const action = deepFreeze({
        id: 1,
        type: EVENT_UPDATE_MESSAGE_FLAGS,
        all: false,
        allMessages: eg.makeMessagesState([]),
        messages: [10, 11, 12],
        flag: 'read',
        op: 'remove',
        message_details: new Map([
          [10, { type: 'private', user_ids: [1, 2].map(makeUserId) }],
          [11, { type: 'private', user_ids: [1, 2].map(makeUserId) }],
          [12, { type: 'private', user_ids: [1, 2, 3].map(makeUserId) }],
        ]),
      });

      const expectedState = [
        {
          user_ids_string: '0,1,2',
          unread_message_ids: [1, 2, 3, 4, 10, 11, 100],
        },
        {
          user_ids_string: '0,1,2,3',
          unread_message_ids: [12],
        },
      ];

      const actualState = unreadHuddlesReducer(
        initialState,
        action,
        eg.reduxStatePlus({ realm: { ...eg.plusReduxState.realm, user_id: makeUserId(0) } }),
      );

      expect(actualState).toEqual(expectedState);
    });

    test('on "remove", drop any duplicates', () => {
      const initialState = deepFreeze([
        { user_ids_string: '0,1,2', unread_message_ids: [1, 2, 3, 4] },
      ]);

      const action = deepFreeze({
        id: 1,
        type: EVENT_UPDATE_MESSAGE_FLAGS,
        all: false,
        allMessages: eg.makeMessagesState([]),
        messages: [2, 10],
        flag: 'read',
        op: 'remove',
        message_details: new Map([
          [2, { type: 'private', user_ids: [1, 2].map(makeUserId) }],
          [10, { type: 'private', user_ids: [1, 2].map(makeUserId) }],
        ]),
      });

      const expectedState = [{ user_ids_string: '0,1,2', unread_message_ids: [1, 2, 3, 4, 10] }];

      const actualState = unreadHuddlesReducer(
        initialState,
        action,
        eg.reduxStatePlus({ realm: { ...eg.plusReduxState.realm, user_id: makeUserId(0) } }),
      );

      expect(actualState).toEqual(expectedState);
    });

    test('when "all" is true reset state', () => {
      const initialState = deepFreeze([
        {
          user_ids_string: '0,1,2',
          unread_message_ids: [1, 2, 3, 4, 5],
        },
      ]);

      const action = deepFreeze({
        id: 1,
        type: EVENT_UPDATE_MESSAGE_FLAGS,
        all: true,
        allMessages: eg.makeMessagesState([]),
        messages: [],
        flag: 'read',
        op: 'add',
      });

      const actualState = unreadHuddlesReducer(initialState, action, eg.plusReduxState);

      expect(actualState).toBe(NULL_ARRAY);
    });
  });
});

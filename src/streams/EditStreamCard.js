/* @flow strict-local */
import React, { useState, useCallback, useMemo, useEffect, useContext } from 'react';
import type { Node } from 'react';
import { View } from 'react-native';

import type { Privacy } from './streamsActions';
import { ensureUnreachable } from '../types';
import { useSelector } from '../react-redux';
import { getRealm, getRealmUrl } from '../selectors';
import {
  Role,
  type CreatePublicOrPrivateStreamPolicyT,
  CreateWebPublicStreamPolicy,
} from '../api/permissionsTypes';
import {
  getCanCreatePublicStreams,
  getCanCreatePrivateStreams,
  getCanCreateWebPublicStreams,
  getOwnUserRole,
  roleIsAtLeast,
} from '../permissionSelectors';
import type { AppNavigationMethods } from '../nav/AppNavigator';
import Input from '../common/Input';
import InputRowRadioButtons from '../common/InputRowRadioButtons';
import ZulipTextIntl from '../common/ZulipTextIntl';
import ZulipButton from '../common/ZulipButton';
import styles from '../styles';
import { TranslationContext } from '../boot/TranslationProvider';
import type { LocalizableText } from '../types';
import { showConfirmationDialog } from '../utils/info';

type PropsBase = $ReadOnly<{|
  navigation: AppNavigationMethods,

  initialValues: {|
    name: string,
    description: string,
    privacy: Privacy,
  |},
|}>;

type PropsEditStream = $ReadOnly<{|
  ...PropsBase,

  isNewStream: false,
  onComplete: (changedValues: {|
    // Properties optional because some values might not have changed.

    +name?: string,
    +description?: string,
    +privacy?: Privacy,
  |}) => boolean | Promise<boolean>,
|}>;

type PropsCreateStream = $ReadOnly<{|
  ...PropsBase,

  isNewStream: true,
  onComplete: ({| name: string, description: string, privacy: Privacy |}) =>
    | boolean
    | Promise<boolean>,
|}>;

type Props = $ReadOnly<PropsEditStream | PropsCreateStream>;

function explainCreateWebPublicStreamPolicy(
  policy: CreateWebPublicStreamPolicy,
  realmName: string,
): LocalizableText {
  return {
    text: (() => {
      switch (policy) {
        case CreateWebPublicStreamPolicy.Nobody:
          return '{realmName} does not allow anybody to make web-public streams.';
        case CreateWebPublicStreamPolicy.OwnerOnly:
          return '{realmName} only allows organization owners to make web-public streams.';
        case CreateWebPublicStreamPolicy.AdminOrAbove:
          return '{realmName} only allows organization administrators or owners to make web-public streams.';
        case CreateWebPublicStreamPolicy.ModeratorOrAbove:
          return '{realmName} only allows organization moderators, administrators, or owners to make web-public streams.';
      }
    })(),
    values: { realmName },
  };
}

function explainCreatePublicStreamPolicy(
  policy: CreatePublicOrPrivateStreamPolicyT,
  realmName: string,
): LocalizableText {
  return {
    text: (() => {
      switch (policy) {
        // FlowIssue: sad that we end up having to write numeric literals here :-/
        //   But the most important thing to get from the type-checker here is
        //   that the ensureUnreachable works -- that ensures that when we add a
        //   new possible value, we'll add a case for it here.  Couldn't find a
        //   cleaner way to write this that still accomplished that. Discussion:
        //     https://github.com/zulip/zulip-mobile/pull/5384#discussion_r875147220
        case 2: // CreatePublicOrPrivateStreamPolicy.AdminOrAbove
          return '{realmName} only allows organization administrators or owners to make public streams.';
        case 4: // CreatePublicOrPrivateStreamPolicy.ModeratorOrAbove
          return '{realmName} only allows organization moderators, administrators, or owners to make public streams.';
        case 3: // CreatePublicOrPrivateStreamPolicy.FullMemberOrAbove
          return '{realmName} only allows full organization members, moderators, administrators, or owners to make public streams.';
        case 1: // CreatePublicOrPrivateStreamPolicy.MemberOrAbove
          return '{realmName} only allows organization members, moderators, administrators, or owners to make public streams.';
        default: {
          ensureUnreachable(policy);
          // (Unreachable as long as the cases are exhaustive.)
          return '';
        }
      }
    })(),
    values: { realmName },
  };
}

function explainCreatePrivateStreamPolicy(
  policy: CreatePublicOrPrivateStreamPolicyT,
  realmName: string,
): LocalizableText {
  return {
    text: (() => {
      switch (policy) {
        // FlowIssue: sad that we end up having to write numeric literals here :-/
        //   But the most important thing to get from the type-checker here is
        //   that the ensureUnreachable works -- that ensures that when we add a
        //   new possible value, we'll add a case for it here.  Couldn't find a
        //   cleaner way to write this that still accomplished that. Discussion:
        //     https://github.com/zulip/zulip-mobile/pull/5384#discussion_r875147220
        case 2: // CreatePublicOrPrivateStreamPolicy.AdminOrAbove
          return '{realmName} only allows organization administrators or owners to make private streams.';
        case 4: // CreatePublicOrPrivateStreamPolicy.ModeratorOrAbove
          return '{realmName} only allows organization moderators, administrators, or owners to make private streams.';
        case 3: // CreatePublicOrPrivateStreamPolicy.FullMemberOrAbove
          return '{realmName} only allows full organization members, moderators, administrators, or owners to make private streams.';
        case 1: // CreatePublicOrPrivateStreamPolicy.MemberOrAbove
          return '{realmName} only allows organization members, moderators, administrators, or owners to make private streams.';
        default: {
          ensureUnreachable(policy);
          // (Unreachable as long as the cases are exhaustive.)
          return '';
        }
      }
    })(),
    values: { realmName },
  };
}

/**
 * Most user-facing strings come from stream_privacy_policy_values in
 * static/js/stream_data.js. The ones in `disabledIfNotInitialValue` are the
 * exception; I made them up.
 */
function useStreamPrivacyOptions(initialValue: Privacy, isNewStream: boolean) {
  const {
    createPublicStreamPolicy,
    createPrivateStreamPolicy,
    webPublicStreamsEnabled,
    enableSpectatorAccess,
    createWebPublicStreamPolicy,
    name: realmName,
  } = useSelector(getRealm);
  const canCreatePublicStreams = useSelector(getCanCreatePublicStreams);
  const canCreatePrivateStreams = useSelector(getCanCreatePrivateStreams);
  const canCreateWebPublicStreams = useSelector(getCanCreateWebPublicStreams);
  const ownUserRole = useSelector(getOwnUserRole);
  const realmUrl = useSelector(getRealmUrl);

  const shouldDisableIfNotInitialValue = useCallback(
    <T: mixed>(canCreate: boolean, explainPolicy: (T, string) => LocalizableText, policy: T) => {
      if (!isNewStream && !roleIsAtLeast(ownUserRole, Role.Admin)) {
        return {
          title: 'Insufficient permission',
          message: 'Only organization administrators and owners can edit streams.',
        };
      }

      return (
        !canCreate && {
          title: 'Insufficient permission',
          message: explainPolicy(policy, realmName),
          learnMoreButton: roleIsAtLeast(ownUserRole, Role.Admin)
            ? {
                url: new URL('/help/configure-who-can-create-streams', realmUrl),
                text: 'Configure permissions',
              }
            : undefined,
        }
      );
    },
    [isNewStream, ownUserRole, realmName, realmUrl],
  );

  return useMemo(
    () =>
      [
        !(webPublicStreamsEnabled && enableSpectatorAccess)
          ? undefined
          : {
              key: 'web-public',
              title: 'Web-public',
              subtitle:
                'Organization members can join (guests must be invited by a subscriber); anyone on the Internet can view complete message history without creating an account',
              disabledIfNotInitialValue: shouldDisableIfNotInitialValue(
                canCreateWebPublicStreams,
                explainCreateWebPublicStreamPolicy,
                createWebPublicStreamPolicy,
              ),
            },
        {
          key: 'public',
          title: 'Public',
          subtitle:
            'Organization members can join (guests must be invited by a subscriber); organization members can view complete message history without joining',
          disabledIfNotInitialValue: shouldDisableIfNotInitialValue(
            canCreatePublicStreams,
            explainCreatePublicStreamPolicy,
            createPublicStreamPolicy,
          ),
        },
        {
          key: 'invite-only-public-history',
          title: 'Private, shared history',
          subtitle:
            'Must be invited by a subscriber; new subscribers can view complete message history; hidden from non-administrator users',
          disabledIfNotInitialValue: shouldDisableIfNotInitialValue(
            canCreatePrivateStreams,
            explainCreatePrivateStreamPolicy,
            createPrivateStreamPolicy,
          ),
        },
        {
          key: 'invite-only',
          title: 'Private, protected history',
          subtitle:
            'Must be invited by a subscriber; new subscribers can only see messages sent after they join; hidden from non-administrator users',
          disabledIfNotInitialValue: shouldDisableIfNotInitialValue(
            canCreatePrivateStreams,
            explainCreatePrivateStreamPolicy,
            createPrivateStreamPolicy,
          ),
        },
      ]
        .filter(Boolean)
        .map(x => {
          const { disabledIfNotInitialValue = false, ...rest } = x;

          return {
            ...rest,

            // E.g., if editing an existing stream that's already
            // web-public, let the user keep it that way, even if they
            // wouldn't have permission to switch to web-public from
            // something else. In particular, as the user is filling out the
            // form, let them accidentally choose a different setting, then
            // switch back to the first setting without making them submit
            // the accidental setting or restart the app.
            disabled: x.key !== initialValue && disabledIfNotInitialValue,
          };
        }),
    [
      initialValue,
      shouldDisableIfNotInitialValue,
      canCreatePublicStreams,
      createPublicStreamPolicy,
      canCreatePrivateStreams,
      createPrivateStreamPolicy,
      webPublicStreamsEnabled,
      canCreateWebPublicStreams,
      createWebPublicStreamPolicy,
      enableSpectatorAccess,
    ],
  );
}

export default function EditStreamCard(props: Props): Node {
  const { navigation, initialValues, isNewStream } = props;
  const _ = useContext(TranslationContext);

  const [name, setName] = useState<string>(props.initialValues.name);
  const [description, setDescription] = useState<string>(props.initialValues.description);
  const [privacy, setPrivacy] = useState<Privacy>(props.initialValues.privacy);
  // When adding more, update areInputsTouched.

  const [awaitingUserInput, setAwaitingUserInput] = useState<boolean>(true);
  const areInputsTouched =
    name !== initialValues.name
    || description !== initialValues.description
    || privacy !== initialValues.privacy;

  useEffect(
    () =>
      navigation.addListener('beforeRemove', e => {
        if (!(awaitingUserInput && areInputsTouched)) {
          return;
        }

        e.preventDefault();

        showConfirmationDialog({
          destructive: true,
          title: 'Discard changes',
          message: 'You have unsaved changes. Leave without saving?',
          onPressConfirm: () => navigation.dispatch(e.data.action),
          _,
        });
      }),
    [_, areInputsTouched, navigation, awaitingUserInput],
  );

  const handlePerformAction = useCallback(async () => {
    setAwaitingUserInput(false);
    let result = false;
    try {
      if (props.isNewStream) {
        result = await props.onComplete({ name, description, privacy });
      } else {
        result = await props.onComplete({
          name: initialValues.name !== name ? name : undefined,
          description: initialValues.description !== description ? description : undefined,
          privacy: initialValues.privacy !== privacy ? privacy : undefined,
        });
      }
    } finally {
      if (result) {
        navigation.goBack();
      } else {
        setAwaitingUserInput(true);
      }
    }
  }, [props, navigation, initialValues, name, description, privacy]);

  const privacyOptions = useStreamPrivacyOptions(props.initialValues.privacy, isNewStream);

  return (
    <View>
      <ZulipTextIntl text="Name" />
      <Input
        style={styles.marginBottom}
        placeholder="Name"
        autoFocus
        defaultValue={initialValues.name}
        onChangeText={setName}
      />
      <ZulipTextIntl text="Description" />
      <Input
        style={styles.marginBottom}
        placeholder="Description"
        defaultValue={initialValues.description}
        onChangeText={setDescription}
      />
      <InputRowRadioButtons
        navigation={navigation}
        label="Privacy"
        description="Who can access the stream?"
        items={privacyOptions}
        valueKey={privacy}
        onValueChange={setPrivacy}
      />
      <ZulipButton
        style={styles.marginTop}
        text={isNewStream ? 'Create' : 'Save'}
        disabled={name.length === 0}
        onPress={handlePerformAction}
      />
    </View>
  );
}

/* @flow strict-local */
import { PixelRatio } from 'react-native';
import invariant from 'invariant';
import formatDistanceToNow from 'date-fns/formatDistanceToNow';
import * as poll_data from '@zulip/shared/js/poll_data';

import template from './template';
import type {
  AggregatedReaction,
  FlagsState,
  GetText,
  Message,
  MessageLike,
  Outbox,
  MessageMessageListElement,
  Reaction,
  SubmessageData,
  UserId,
  WidgetData,
  UserStatus,
} from '../../types';
import type { BackgroundData } from '../backgroundData';
import { shortTime } from '../../utils/date';
import aggregateReactions from '../../reactions/aggregateReactions';
import { displayCharacterForUnicodeEmojiCode } from '../../emoji/data';
import processAlertWords from './processAlertWords';
import * as logging from '../../utils/logging';
import { getUserStatusFromModel } from '../../user-statuses/userStatusesCore';

const messageTagsAsHtml = (isStarred: boolean, timeEdited: number | void): string => {
  const pieces = [];
  if (timeEdited !== undefined) {
    const editedTime = formatDistanceToNow(timeEdited * 1000);
    pieces.push(template`<span class="message-tag">edited ${editedTime} ago</span>`);
  }
  if (isStarred) {
    pieces.push('<span class="message-tag">starred</span>');
  }
  return !pieces.length ? '' : template`<div class="message-tags">$!${pieces.join('')}</div>`;
};

// Like get_display_full_names in the web app's people.js, but also gives
// "You" so callers don't have to.
const getDisplayFullNames = (userIds, backgroundData, _) => {
  const { allUsersById, mutedUsers, ownUser } = backgroundData;
  return userIds.map(id => {
    const user = allUsersById.get(id);
    if (!user) {
      logging.warn('render reaction: no user for ID', { id });
      return '?';
    }

    if (id === ownUser.user_id) {
      return _('You');
    }

    if (mutedUsers.has(id)) {
      return _('Muted user');
    }

    return user.full_name;
  });
};

const messageReactionAsHtml = (
  backgroundData: BackgroundData,
  reaction: AggregatedReaction,
  shouldShowNames: boolean,
  _: GetText,
): string => {
  const { allImageEmojiById } = backgroundData;
  return template`<span onClick="" class="reaction${reaction.selfReacted ? ' self-voted' : ''}"
        data-name="${reaction.name}"
        data-code="${reaction.code}"
        data-type="${reaction.type}">$!${
    allImageEmojiById[reaction.code]
      ? template`<img src="${allImageEmojiById[reaction.code].source_url}"/>`
      : displayCharacterForUnicodeEmojiCode(reaction.code, backgroundData.serverEmojiData)
  }&nbsp;${
    // The web app puts this condition in get_vote_text in its reactions.js.
    shouldShowNames
      ? getDisplayFullNames(reaction.users, backgroundData, _).join(', ')
      : reaction.count
  }</span>`;
};

const messageReactionListAsHtml = (
  backgroundData: BackgroundData,
  reactions: $ReadOnlyArray<Reaction>,
  _: GetText,
): string => {
  const { ownUser, displayEmojiReactionUsers } = backgroundData;

  if (reactions.length === 0) {
    return '';
  }

  // See the web app's get_vote_text in its reactions.js.
  const shouldShowNames =
    displayEmojiReactionUsers
    // The API lets clients choose the threshold. We use 3 like the web app.
    && reactions.length <= 3;
  const htmlList = aggregateReactions(reactions, ownUser.user_id).map(r =>
    messageReactionAsHtml(backgroundData, r, shouldShowNames, _),
  );
  return template`<div class="reaction-list">$!${htmlList.join('')}</div>`;
};

const messageBody = (backgroundData: BackgroundData, message: Message | Outbox, _: GetText) => {
  const { alertWords, flags } = backgroundData;
  const { id, isOutbox, last_edit_timestamp, match_content, reactions } = (message: MessageLike);
  const content = match_content ?? message.content;
  return template`\
$!${processAlertWords(content, id, alertWords, flags)}
$!${isOutbox === true ? '<div class="loading-spinner outbox-spinner"></div>' : ''}
$!${messageTagsAsHtml(!!flags.starred[id], last_edit_timestamp)}
$!${messageReactionListAsHtml(backgroundData, reactions, _)}`;
};

/**
 * Render the body of a message that has submessages.
 *
 * Must not be called on a message without any submessages.
 */
const widgetBody = (message: Message, ownUserId: UserId) => {
  invariant(
    message.submessages !== undefined && message.submessages.length > 0,
    'should have submessages',
  );

  const widgetSubmessages: Array<{
    sender_id: number,
    content: SubmessageData,
    ...
  }> = message.submessages
    .filter(submessage => submessage.msg_type === 'widget')
    .sort((m1, m2) => m1.id - m2.id)
    .map(submessage => ({
      sender_id: submessage.sender_id,
      content: JSON.parse(submessage.content),
    }));

  const errorMessage = template`\
$!${message.content}
<div class="special-message"
 ><p>Interactive message</p
 ><p>To use, open on web or desktop</p
></div>`;

  const pollWidget = widgetSubmessages.shift();
  if (!pollWidget || !pollWidget.content) {
    return errorMessage;
  }

  /* $FlowFixMe[incompatible-type]: The first widget submessage should be
       a `WidgetData`; see jsdoc on `SubmessageData`. */
  const pollWidgetContent: WidgetData = pollWidget.content;

  if (pollWidgetContent.widget_type !== 'poll') {
    return errorMessage;
  }

  if (pollWidgetContent.extra_data == null) {
    // We don't expect this to happen in general, but there are some malformed
    // messages lying around that will trigger this [1]. The code here is slightly
    // different the webapp code, but mostly because the current webapp
    // behaviour seems accidental: an error is printed to the console, and the
    // code that is written to handle the situation is never reached.  Instead
    // of doing that, we've opted to catch this case here, and print out the
    // message (which matches the behaviour of the webapp, minus the console
    // error, although it gets to that behaviour in a different way). The bug
    // tracking fixing this on the webapp side is zulip/zulip#19145.
    // [1]: https://chat.zulip.org/#narrow/streams/public/near/582872
    return template`$!${message.content}`;
  }

  const pollData = new poll_data.PollData({
    message_sender_id: message.sender_id,
    current_user_id: ownUserId,
    is_my_poll: message.sender_id === ownUserId,
    question: pollWidgetContent.extra_data.question ?? '',
    options: pollWidgetContent.extra_data.options ?? [],
    // TODO: Implement this.
    comma_separated_names: () => '',
    report_error_function: (msg: string) => {
      logging.error(msg);
    },
  });

  for (const pollEvent of widgetSubmessages) {
    pollData.handle_event(pollEvent.sender_id, pollEvent.content);
  }

  const parsedPollData = pollData.get_widget_data();

  return template`\
<div class="poll-widget">
  <p class="poll-question">${parsedPollData.question}</p>
  <ul>
    $!${parsedPollData.options
      .map(
        option =>
          template`
        <li>
          <button
            class="poll-vote"
            data-voted="${option.current_user_vote ? 'true' : 'false'}"
            data-key="${option.key}"
          >${option.count}</button>
          <span class="poll-option">${option.option}</span>
        </li>`,
      )
      .join('')}
  </ul>
</div>`;
};

export const flagsStateToStringList = (flags: FlagsState, id: number): $ReadOnlyArray<string> =>
  Object.keys(flags).filter(key => flags[key][id]);

const senderEmojiStatus = (
  emoji: UserStatus['status_emoji'],
  backgroundData: BackgroundData,
): string =>
  emoji
    ? backgroundData.allImageEmojiById[emoji.emoji_code]
      ? template`\
<img
  class="status-emoji"
  src="${backgroundData.allImageEmojiById[emoji.emoji_code].source_url}"
/>`
      : template`\
<span class="status-emoji">$!${displayCharacterForUnicodeEmojiCode(
          emoji.emoji_code,
          backgroundData.serverEmojiData,
        )}</span>`
    : '';

/**
 * The HTML string for a message-list element of the "message" type.
 *
 * This is a private helper of messageListElementHtml.
 */
export default (
  backgroundData: BackgroundData,
  element: MessageMessageListElement,
  _: GetText,
): string => {
  const { message, isBrief } = element;
  const { id, timestamp } = message;
  const flagStrings = flagsStateToStringList(backgroundData.flags, id);
  const isUserMuted = !!message.sender_id && backgroundData.mutedUsers.has(message.sender_id);

  const divOpenHtml = template`\
<div
  class="msglist-element message ${isBrief ? 'message-brief' : 'message-full'}"
  id="msg-${id}"
  data-msg-id="${id}"
  data-mute-state="${isUserMuted ? 'hidden' : 'shown'}"
  $!${flagStrings.map(flag => template`data-${flag}="true" `).join('')}
>`;
  const messageTime = shortTime(new Date(timestamp * 1000), backgroundData.twentyFourHourTime);

  const timestampHtml = (showOnRender: boolean) => template`\
<div class="time-container">
  <div class="msg-timestamp ${showOnRender ? 'show' : ''}">
    ${messageTime}
  </div>
</div>`;
  const bodyHtml =
    message.submessages && message.submessages.length > 0
      ? widgetBody(message, backgroundData.ownUser.user_id)
      : messageBody(backgroundData, message, _);

  if (isBrief) {
    return template`\
$!${divOpenHtml}
  <div class="content">
    $!${timestampHtml(false)}
    $!${bodyHtml}
  </div>
</div>`;
  }

  const { sender_full_name, sender_id } = message;
  const avatarUrl = message.avatar_url
    .get(
      // 48 logical pixels; see `.avatar` and `.avatar img` in
      // src/webview/static/base.css.
      PixelRatio.getPixelSizeForLayoutSize(48),
    )
    .toString();
  const subheaderHtml = template`\
<div class="subheader">
  <div class="name-and-status-emoji" data-sender-id="${sender_id}">
    ${sender_full_name}$!${senderEmojiStatus(
    getUserStatusFromModel(backgroundData.userStatuses, sender_id).status_emoji,
    backgroundData,
  )}
  </div>
  <div class="static-timestamp">${messageTime}</div>
</div>`;
  const mutedMessageHtml = isUserMuted
    ? template`\
<div class="special-message muted-message-explanation">
  ${_('This message was hidden because it is from a user you have muted. Long-press to view.')}
</div>`
    : '';

  return template`\
$!${divOpenHtml}
  <div class="avatar">
    <img src="${avatarUrl}" alt="${sender_full_name}" class="avatar-img" data-sender-id="${sender_id}">
  </div>
  <div class="content">
    $!${subheaderHtml}
    $!${bodyHtml}
  </div>
  $!${mutedMessageHtml}
</div>`;
};

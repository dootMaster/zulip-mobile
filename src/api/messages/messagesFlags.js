/* @flow strict-local */
import type { ApiResponseSuccess, Auth } from '../transportTypes';
import type { UserMessageFlag } from '../modelTypes';
import { apiPost } from '../apiFetch';

export type ApiResponseMessagesFlags = {|
  ...$Exact<ApiResponseSuccess>,
  messages: $ReadOnlyArray<number>,
|};

export default (
  auth: Auth,
  messageIds: $ReadOnlyArray<number>,
  op: 'add' | 'remove',
  flag: UserMessageFlag,
): Promise<ApiResponseMessagesFlags> =>
  apiPost(auth, 'messages/flags', { messages: JSON.stringify(messageIds), flag, op });

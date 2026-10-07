/**
 * The connection state chat_display.js and nickname_display.js read. In the
 * P2P online version it is data_channel.js's `channel`; a replay has no
 * peer, so these are its values when no connection was ever made.
 */
'use strict';

export const channel = {
  amICreatedRoom: false,
  amIPlayer2: null,
  myChatEnabled: true,
  peerChatEnabled: true,
  myIsPeerNicknameVisible: true,
  peerIsPeerNicknameVisible: true,
};

/** No peer to tell. */
export function sendChatEnabledMessageToPeer() {}

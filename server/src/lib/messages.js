import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { Notification } from '../models/Notification.js';

// One conversation per listing and buyer, shared by chat and negotiation.
export function openConversation(book, buyer) {
  return Conversation.findOneAndUpdate(
    { book: book._id, buyer },
    { $setOnInsert: { seller: book.seller, isDemo: Boolean(book.isDemo) } },
    { upsert: true, returnDocument: 'after' },
  );
}

export async function sendMessage(conversation, sender, text, event = {}) {
  const senderIsBuyer = conversation.buyer.equals(sender._id);
  const message = await Message.create({ conversation: conversation._id, sender: sender._id, body: text, ...event });
  await Conversation.updateOne(
    { _id: conversation._id },
    { lastMessage: text.slice(0, 140), lastMessageAt: message.createdAt, $inc: { [senderIsBuyer ? 'sellerUnread' : 'buyerUnread']: 1 } },
  );
  // Negotiation events send their own request notification.
  if (event.kind) return message;
  // One rolling unread notification per conversation rather than one per message.
  await Notification.findOneAndUpdate(
    { user: senderIsBuyer ? conversation.seller : conversation.buyer, type: 'message', link: `/messages/${conversation._id}`, read: false },
    { message: `New message from ${sender.name}.`, createdAt: new Date() },
    { upsert: true, timestamps: false },
  );
  return message;
}

// The conversation a request's negotiation is posted in.
export const conversationFor = (request) =>
  openConversation({ _id: request.book._id ?? request.book, seller: request.seller, isDemo: request.isDemo }, request.buyer);

// Records a negotiation step in the request's conversation, with an optional note as a normal message after it.
export async function postEvent(request, sender, kind, text, note = '') {
  const conversation = await conversationFor(request);
  await sendMessage(conversation, sender, text, { kind, amount: request.price, request: request._id });
  if (note) await sendMessage(conversation, sender, note);
  return conversation;
}

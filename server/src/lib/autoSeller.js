// Scripted replies for fictional example sellers (User.isAutomatedSeller). Deterministic rules, no external AI.
// It only ever acts on the conversation or request a buyer's own authorised action touched, and every price
// change goes through the same handlers as a human seller (routes/requests.js ACTIONS).
import { Book } from '../models/Book.js';
import { Message } from '../models/Message.js';
import { OPEN_REQUEST_STATUSES, PurchaseRequest } from '../models/PurchaseRequest.js';
import { User } from '../models/User.js';
import { ACTIONS, createRequest } from '../routes/requests.js';
import { HttpError, rupees } from './http.js';
import { conversationFor, sendMessage } from './messages.js';

// Fractions of the listed price: accept at or above acceptAt, decline below rejectBelow, counter in between.
export const THRESHOLDS = { acceptAt: 0.9, rejectBelow: 0.6, suggestLow: 0.82 };

const round10 = (n) => Math.round(n / 10) * 10;
const ceil10 = (n) => Math.ceil(n / 10) * 10;
export const lowestPrice = (list) => Math.ceil(list * THRESHOLDS.acceptAt);

// The seller's answer to a buyer's offer. `ask` is the seller's last asking price; counters move halfway toward the
// offer but never below lowestPrice, so a negotiation always ends.
export function decide(offer, list, ask = list) {
  const lowest = lowestPrice(list);
  if (offer >= lowest || offer >= ask) return { action: 'accept' };
  if (offer < list * THRESHOLDS.rejectBelow) return { action: 'reject' };
  return { action: 'counter', amount: Math.max(lowest, Math.min(ask, round10((offer + ask) / 2))) };
}

const CURRENCY = /(?:(-)\s*)?(?:₹|\brs\.?|\binr)\s*(-)?\s*(\d[\d,]*)|(-)?\b(\d[\d,]*)\s*(?:rupees|rs\b|inr\b|\/-)/i;
const OFFER_WORDS = /\b(accept|offer|pay|settle|take|how about|give)\b/;
const BARE = /(?:^|[^\w.-])(-?)(\d[\d,]*)(?![\w.%])/;

// An amount written with a currency sign, or a bare number next to an offer word ("would you take 400").
export function parseAmount(text) {
  let m = text.match(CURRENCY);
  let negative;
  let digits;
  if (m) [negative, digits] = [m[1] || m[2] || m[4], m[3] ?? m[5]];
  else if (OFFER_WORDS.test(text) && (m = text.match(BARE))) [negative, digits] = [m[1], m[2]];
  else return null;
  const value = Number(digits.replace(/,/g, ''));
  return negative || !Number.isSafeInteger(value) ? { invalid: true } : { value };
}

const NEGATED = /\b(not|no|never)\b|n'?t\b/;
// First match wins. The third entry marks intents a negation cancels ("I haven't received it").
const INTENTS = [
  ['think', /\b(think about|let me think|maybe later)\b/],
  ['decline', /\b(no thanks|not interested|i'?ll pass|decline|reject)\b/],
  ['accept', /\b(accept|deal|agreed?|sounds good|i'?ll take it)\b/, true],
  ['discount', /\b(lower|reduce|less|discount|cheaper|best price|lowest|negotiable|negotiate|come down|too (high|much|expensive)|bargain)\b/],
  ['availability', /\b(available|availability|still (have|there|for sale|selling)|in stock|sold)\b/],
  ['condition', /\b(condition|damaged?|highlight\w*|torn|wear|worn|marks|markings|notes|pages|state of)\b/],
  ['edition', /\b(edition|version|year|published|publication|isbn)\b/],
  ['confirm', /\bconfirm\b/],
  ['meetup', /\b(meet|meeting|when|where|exchange|pick ?up|handover|hand over|location|place|time|wait)\b/],
  ['otherBooks', /\b(other books|any other|anything else|more books)\b/],
  ['thanks', /\b(thank|thanks|thx)\b/],
  ['bye', /\b(bye|see you|take care|great semester)\b/],
  ['greeting', /\b(hi|hello|hey|namaste|good (morning|afternoon|evening))\b/],
];
const COLLECTED = /\b(received|collected|got the book|picked (it )?up|have the book)\b/;

export function classify(text) {
  const t = text.toLowerCase();
  if (COLLECTED.test(t) && !NEGATED.test(t)) return { intent: 'collected' };
  const amount = parseAmount(t);
  if (amount) return amount.invalid ? { intent: 'invalidAmount' } : { intent: 'offer', amount: amount.value };
  const hit = INTENTS.find(([, re, negatable]) => re.test(t) && !(negatable && NEGATED.test(t)));
  if (!hit) return { intent: 'unknown' };
  return hit[0] === 'discount' ? { intent: 'discount', best: /\b(best|lowest)\b/.test(t) } : { intent: hit[0] };
}

const PLACES = ['the library entrance', 'the main cafeteria', 'the academic block lobby'];
const TIMES = ['tomorrow at 4 pm', 'tomorrow at 1 pm, after lectures', 'the day after tomorrow at 11 am'];
const pick = (options, n) => options[n % options.length];
const firstSentence = (text) => text.match(/^.*?[.!?](\s|$)/)?.[0].trim() ?? text;
const isOpen = (request) => request && OPEN_REQUEST_STATUSES.includes(request.status);
const lastAsk = (request) => request.history.findLast((h) => h.by?.equals(request.seller) && h.amount != null)?.amount ?? request.listPrice ?? request.price;

// Calls a negotiation handler exactly as its route would, as `user`.
async function act(name, request, user, data = {}) {
  const fresh = await PurchaseRequest.findById(request._id).populate('book', 'title');
  return ACTIONS[name](fresh, { user, data: { note: '', ...data } });
}

const automatedSeller = (id) => User.findOne({ _id: id, isAutomatedSeller: true }).select('name');

// The seller answers the buyer's offer on the table: accept, decline or counter.
async function answerOffer(request, seller) {
  const list = request.listPrice ?? request.price;
  const ask = lastAsk(request);
  const { action, amount } = decide(request.price, list, ask);
  if (action === 'accept') {
    return act('accept', request, seller, { note: `Great! We've agreed on ${rupees(request.price)}. We can now arrange the exchange.` });
  }
  if (action === 'reject') {
    return act('reject', request, seller, { note: `Sorry, ${rupees(request.price)} is too far below the listed ${rupees(list)}. Offers closer to ${rupees(lowestPrice(list))} work for me.` });
  }
  const note = amount === ask && ask !== list ? `${rupees(amount)} is my final price.` : `I can offer it for ${rupees(amount)}.`;
  return act('counter', request, seller, { amount, note });
}

async function say(conversation, seller, text) {
  await sendMessage(conversation, seller, text);
}

// After a buyer's offer, counter, accept, decline or cancel on a request (routes/requests.js).
export async function afterBuyerAction(request, buyer, name) {
  const seller = await automatedSeller(request.seller);
  if (!seller || !request.buyer.equals(buyer._id)) return;
  try {
    if (name === 'offer' || name === 'counter') return void (await answerOffer(request, seller));
    const reply = {
      accept: `Great! We've agreed on ${rupees(request.price)}. We can now arrange the exchange.`,
      reject: 'No problem. Feel free to make another offer if you change your mind.',
      cancel: 'Understood, the request is cancelled. Message me if you need the book later.',
    }[name];
    if (reply) await say(await conversationFor(request), seller, reply);
  } catch (err) {
    await recover(err, await conversationFor(request), seller);
  }
}

// A rule refused (say the book was reserved meanwhile): explain instead of failing the buyer's own action.
async function recover(err, conversation, seller) {
  if (!(err instanceof HttpError)) return console.error('Automated seller failed:', err);
  await say(conversation, seller, `Sorry, I couldn't do that: ${err.message.charAt(0).toLowerCase()}${err.message.slice(1)}.`);
}

// After a buyer's chat message in a conversation with an automated seller.
export async function onBuyerMessage(conversation, buyer, text) {
  if (!conversation.buyer.equals(buyer._id)) return;
  const seller = await automatedSeller(conversation.seller);
  if (!seller) return;
  try {
    const [book, request, replies] = await Promise.all([
      Book.findById(conversation.book),
      PurchaseRequest.findOne({ book: conversation.book, buyer: buyer._id }).sort({ createdAt: -1 }),
      Message.countDocuments({ conversation: conversation._id, sender: seller._id, kind: 'text' }),
    ]);
    const reply = await respond({ ...classify(text), text: text.toLowerCase() }, { book, request, buyer, seller, n: replies, conversationId: String(conversation._id) });
    if (reply) await say(conversation, seller, reply);
  } catch (err) {
    await recover(err, conversation, seller);
  }
}

function availability(book, request) {
  if (book.status === 'active') return 'Yes, it\'s still available. Are you interested in buying it?';
  if (book.status === 'reserved') {
    return request?.status === 'accepted' ? 'It\'s reserved for you. Let\'s arrange the exchange.' : 'It\'s reserved for another buyer right now. If that falls through, it will be available again.';
  }
  return request?.status === 'completed' ? 'You already have it. I hope it helps with the course!' : 'Sorry, it has already been sold.';
}

// Returns the seller's text reply, or nothing when a negotiation handler already posted one.
async function respond({ intent, amount, best, text }, { book, request, buyer, seller, n, conversationId }) {
  const open = isOpen(request) ? request : null;
  const agreed = open?.status === 'accepted';
  const sellerOffer = open?.status === 'pending' && open.offerBy === 'seller';
  const list = open?.listPrice ?? book.price;
  const spot = [...conversationId].reduce((sum, c) => sum + c.charCodeAt(0), 0);

  switch (intent) {
    case 'offer':
      if (agreed) return `We've already agreed on ${rupees(open.price)}.`;
      if (amount > list) return `No need to go above the listed ${rupees(list)}. I'm happy to sell at that price.`;
      if (!open) {
        if (book.status !== 'active') return availability(book, request);
        return void (await answerOffer(await createRequest(book, buyer, amount), seller));
      }
      if (!sellerOffer) return void (await answerOffer(open, seller));
      if (amount === open.price) return void (await act('accept', open, buyer));
      return void (await answerOffer(await act('counter', open, buyer, { amount }), seller));
    case 'invalidAmount':
      return 'That doesn\'t look like a valid amount. Please offer a whole number of rupees.';
    case 'accept':
      if (sellerOffer) {
        await act('accept', open, buyer);
        return `Great! We've agreed on ${rupees(open.price)}. We can now arrange the exchange.`;
      }
      if (agreed) return `We've already agreed on ${rupees(open.price)}.`;
      return `Glad you like it! Tell me what you'd like to pay, or offer the listed ${rupees(list)}.`;
    case 'decline':
      if (sellerOffer) {
        await act('reject', open, buyer);
        return 'No problem. Feel free to make another offer if you change your mind.';
      }
      if (agreed) return 'If you no longer want it, you can cancel the request from the deal card above.';
      return 'No problem. Let me know if you change your mind.';
    case 'think':
      return sellerOffer ? `Sure, take your time. My offer of ${rupees(open.price)} stands for now.` : 'Sure, take your time.';
    case 'discount': {
      const lowest = lowestPrice(list);
      if (agreed) return `We've already agreed on ${rupees(open.price)}.`;
      if (sellerOffer) {
        if (open.price <= lowest) return `${rupees(open.price)} is already the lowest I can go.`;
        const amount = Math.max(lowest, round10((open.price + (open.history.findLast((h) => h.by?.equals(open.buyer))?.amount ?? lowest)) / 2));
        // The seller lowers their own standing offer; it stays the buyer's turn to answer.
        const updated = await PurchaseRequest.findOneAndUpdate(
          { _id: open._id, status: 'pending', offerBy: 'seller', price: open.price },
          { price: amount, $push: { history: { status: 'countered', by: seller._id, amount, note: 'Reduced on request' } } },
          { returnDocument: 'after' },
        );
        if (!updated) return 'This offer has just changed. Please reload.';
        const conversation = await conversationFor(updated);
        await sendMessage(conversation, seller, `Counteroffer: ${rupees(amount)}`, { kind: 'counter', amount, request: updated._id });
        return amount === lowest ? `Alright, ${rupees(amount)} is the lowest I can go.` : `I can come down to ${rupees(amount)}.`;
      }
      if (best) return `My best price is ${rupees(lowest)}. Offer that and it's yours.`;
      return 'I can negotiate a little. What price did you have in mind?';
    }
    case 'availability':
      return availability(book, request);
    case 'condition':
      return `It's in ${book.condition.toLowerCase()} condition. ${firstSentence(book.description)}`;
    case 'edition':
      return book.edition
        ? `It's the ${book.edition} edition${book.publicationYear ? `, published in ${book.publicationYear}` : ''}.`
        : 'The listing doesn\'t state the edition, so I can\'t confirm it, sorry.';
    case 'confirm':
      return agreed ? 'Perfect. Let me know here once you\'ve collected the book and I\'ll mark it as sold.' : 'Let\'s agree on a price first, then we can confirm the exchange.';
    case 'meetup':
      if (!agreed) return 'Once we agree on a price, we can arrange to meet on campus.';
      if (/\b(different|another|later|earlier|reschedule|change)\b/.test(text)) return `Sure, ${pick(TIMES, spot + 1)} works too, same place.`;
      if (/\b(exactly|wait|arrive)\b/.test(text)) return `I'll be near ${pick(PLACES, spot)}. Message me here when you arrive.`;
      return `How about ${pick(TIMES, spot)} near ${pick(PLACES, spot)}? Please bring ${rupees(open.price)} in cash or UPI.`;
    case 'collected':
      if (agreed) {
        await act('complete', open, seller, { note: 'Thanks! I\'ve marked the book as sold. Good luck with the course!' });
        return undefined;
      }
      return request?.status === 'completed' ? 'Glad you have it!' : 'We haven\'t agreed on a sale yet. Would you like to make an offer?';
    case 'otherBooks':
      return 'You can see everything I\'m selling on my profile.';
    case 'thanks':
      return pick(['You\'re welcome!', 'Happy to help.'], n);
    case 'bye':
      return 'You too! Good luck with your studies.';
    case 'greeting':
      return `Hi! Thanks for your interest in "${book.title}". How can I help?`;
    default:
      return pick([
        'Sorry, I didn\'t quite follow. You can ask about availability, the condition or the price.',
        'I\'m not sure I understood. Would you like to know about the condition, or make an offer?',
      ], n);
  }
}

// Three suggested buyer messages for the conversation's current stage.
export function suggestionsFor(book, request, messages, buyerId) {
  const list = request?.listPrice ?? book.price;
  const buyerTexts = messages.filter((m) => m.kind === 'text' && String(m.sender) === String(buyerId));
  if (request?.status === 'completed') return ['Thanks again!', 'Do you have other books for this course?', 'Have a great semester!'];
  if (request?.status === 'accepted') {
    const since = messages.findLast((m) => m.kind === 'accepted')?.createdAt ?? 0;
    const arranged = buyerTexts.some((m) => m.createdAt >= since && ['meetup', 'confirm'].includes(classify(m.body).intent));
    return arranged
      ? ['I\'ve collected the book. Thank you!', 'Can we meet at a different time?', 'Where exactly should I wait?']
      : ['When can we meet?', 'Where should we exchange the book?', 'Thank you, I\'ll confirm the exchange.'];
  }
  if (request?.status === 'pending' && request.offerBy === 'seller') return ['I accept your offer.', 'Could you reduce it a little more?', 'I\'ll think about it.'];
  if (book.status !== 'active') return ['Will it be available again?', 'Do you have other books for this course?', 'Thanks anyway!'];
  const priced = request || buyerTexts.some((m) => ['offer', 'discount'].includes(classify(m.body).intent));
  if (!priced) return ['Is this book still available?', 'Can you tell me more about its condition?', 'Would you consider a lower price?'];
  const high = Math.min(list, ceil10(lowestPrice(list)));
  const low = Math.min(high, round10(list * THRESHOLDS.suggestLow));
  return [`Would you accept ${rupees(low)}?`, `Can we settle at ${rupees(high)}?`, 'What is your best price?'];
}

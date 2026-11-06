import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lastMessage: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now },
    buyerUnread: { type: Number, default: 0 },
    sellerUnread: { type: Number, default: 0 },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

conversationSchema.index({ book: 1, buyer: 1 }, { unique: true });
conversationSchema.index({ buyer: 1, lastMessageAt: -1 });
conversationSchema.index({ seller: 1, lastMessageAt: -1 });

export const Conversation = mongoose.model('Conversation', conversationSchema);

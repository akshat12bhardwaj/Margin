import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    // Negotiation events render as cards; `body` keeps a plain summary for previews.
    kind: { type: String, enum: ['text', 'offer', 'counter', 'accepted', 'rejected', 'cancelled', 'completed'], default: 'text' },
    amount: { type: Number },
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseRequest' },
  },
  { timestamps: true },
);

messageSchema.index({ conversation: 1, createdAt: -1 });

export const Message = mongoose.model('Message', messageSchema);

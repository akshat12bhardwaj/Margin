import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';

// Fictional sample sellers never sign in, so no notification is stored for them.
export async function notify(user, type, message, link = '') {
  if (await User.exists({ _id: user, isDemo: true })) return null;
  return Notification.create({ user, type, message, link });
}

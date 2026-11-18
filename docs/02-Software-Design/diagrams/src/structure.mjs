// Use-case, class, architecture and state diagrams. Coordinates are laid out by hand for readability.
import { C, Diagram, text } from './lib.mjs';

export function useCase() {
  const d = new Diagram(1460, 1190, 'Figure 2.1  Use-case diagram');
  d.rect('sys', 270, 44, 990, 1126, '', { fill: '#ffffff', sw: 1.6, r: 0 });
  d.raw(text(765, 62, 'Margin: Course Book Exchange Marketplace', { size: 13, weight: 'bold' }));
  d.actor('visitor', 90, 210, 'Visitor');
  d.actor('member', 90, 760, 'Member');
  d.actor('student', 40, 1040, 'Student');
  d.actor('faculty', 150, 1040, 'Faculty member');
  d.actor('admin', 1370, 470, 'Administrator');
  d.actor('google', 1370, 660, 'Google Identity\nService');
  d.raw(text(1370, 725, '«external system»', { size: 11, italic: true }));
  const uc = (id, x, y, label, rx = 108) => d.ellipse(id, x, y, rx, 25, label, { size: 12 });
  // Visitor (also available to members, by generalisation)
  uc('browse', 470, 100, 'Browse and search books');
  uc('view', 470, 165, 'View listing details');
  uc('register', 470, 230, 'Register');
  uc('reset', 470, 300, 'Reset password');
  uc('filter', 790, 100, 'Filter by subject, semester,\nprice and condition', 118);
  uc('login', 790, 330, 'Log in');
  uc('googleuc', 790, 450, 'Sign in with Google');
  // Member
  const memberUCs = [
    ['profile', 'Manage profile'], ['create', 'Create listing'], ['edit', 'Edit, deactivate or\ndelete own listing'], ['wish', 'Manage wishlist'],
    ['buy', 'Buy now (listed price)'], ['offer', 'Make an offer'], ['respond', 'Accept, decline or\ncounter an offer'], ['message', 'Message buyer or seller'],
    ['complete', 'Confirm exchange\n(mark as sold)'], ['cancel', 'Cancel request'], ['report', 'Report listing or user'], ['notify', 'View notifications'],
  ];
  memberUCs.forEach(([id, label], i) => uc(id, 470, 440 + i * 60, label));
  uc('request', 790, 710, 'Send purchase request');
  // Administrator
  uc('reports', 1110, 130, 'Review reports');
  uc('modbook', 1110, 200, 'Moderate listing\n(hide, remove, restore)');
  uc('moduser', 1110, 270, 'Suspend, deactivate\nor restore account');
  uc('dash', 1110, 340, 'View dashboard\nand audit log');
  uc('audit', 790, 200, 'Record audit entry');

  const S = (id) => d.shapes.get(id);
  const L = (id) => [S(id).cx - S(id).rx, S(id).cy];
  const R = (id) => [S(id).cx + S(id).rx, S(id).cy];
  // Generalisation: arrowheads stop below the parent actor's name.
  d.edge('student', 'member', { start: [40, 1004], end: [80, 822], head: 'triangle' });
  d.edge('faculty', 'member', { start: [150, 1004], end: [100, 822], head: 'triangle' });
  d.edge('member', 'visitor', { start: [90, 722], end: [90, 272], head: 'triangle' });
  // Associations attach at the near edge of each use case, so no line crosses another use case.
  for (const id of ['browse', 'view', 'register', 'reset']) d.edge('visitor', id, { start: [106, 202], end: L(id), head: null });
  d.edge('visitor', 'login', { start: [106, 206], via: [[340, 360]], end: L('login'), head: null });
  for (const [id] of memberUCs) d.edge('member', id, { start: [106, 752], end: L(id), head: null });
  for (const id of ['reports', 'modbook', 'moduser', 'dash', 'login']) d.edge('admin', id, { start: [1354, 462], end: R(id), head: null });
  d.edge('googleuc', 'google', { start: R('googleuc'), end: [1350, 650], head: null });
  // Include and extend
  d.edge('filter', 'browse', { start: L('filter'), end: R('browse'), dashed: true, head: 'open', label: '«extend»' });
  d.edge('googleuc', 'login', { start: [790, 425], end: [790, 355], dashed: true, head: 'open', label: '«extend»' });
  d.edge('buy', 'request', { start: R('buy'), end: [700, 700], dashed: true, head: 'open', label: '«include»' });
  d.edge('offer', 'request', { start: R('offer'), end: [700, 720], dashed: true, head: 'open', label: '«include»' });
  d.edge('reports', 'audit', { start: L('reports'), end: [870, 182], dashed: true, head: 'open', label: '«include»', labelAt: [940, 150] });
  d.edge('modbook', 'audit', { start: L('modbook'), end: R('audit'), dashed: true, head: 'open', label: '«include»' });
  d.edge('moduser', 'audit', { start: L('moduser'), end: [870, 218], dashed: true, head: 'open', label: '«include»', labelAt: [940, 252] });
  return d;
}

export function classDiagram() {
  const d = new Diagram(1640, 1260, 'Figure 2.2  Class diagram (Mongoose models in server/src/models)');
  const report = d.classBox('Report', 40, 50, 250, 'Report', ['targetType : book | user', 'category : ReportCategory', 'description : String', 'status : ReportStatus', 'decision : String', 'decidedAt : Date [0..1]'], ['file()', 'review(status, decision)']);
  const wish = d.classBox('Wishlist', 840, 130, 160, 'Wishlist', ['createdAt : Date'], ['add()', 'remove()']);
  const user = d.classBox('User', 560, 300, 260, 'User', ['name : String', 'email : String {unique}', 'passwordHash : String [0..1]', 'googleId : String [0..1] {unique}', 'role : Role', 'university : String', 'program : String', 'semester : Integer [0..1] {1..8}', 'designation : String', 'bio : String', 'status : AccountStatus', 'tokenVersion : Integer', 'isDemo : Boolean', 'isAutomatedSeller : Boolean'], ['register()', 'login()', 'updateProfile()', 'changePassword()']);
  const book = d.classBox('Book', 1060, 300, 270, 'Book', ['title : String', 'author : String', 'isbn : String [0..1]', 'subject : Subject', 'course : String [0..1]', 'semester : Integer [0..1] {1..8}', 'edition : String', 'publicationYear : Integer', 'description : String', 'price : Number {> 0}', 'condition : Condition', 'images : ImageRef [1..6]', 'status : BookStatus', 'flagged : Boolean', 'isDemo : Boolean'], ['create()', 'edit()', 'setStatus(active | inactive)', 'delete()']);
  const notif = d.classBox('Notification', 40, 470, 250, 'Notification', ['type : NotificationType', 'message : String', 'link : String', 'read : Boolean'], ['markRead()']);
  const audit = d.classBox('AuditLog', 40, 700, 250, 'AuditLog', ['action : String', 'targetType : user | book | report', 'targetId : ObjectId', 'reason : String', 'createdAt : Date']);
  const pr = d.classBox('PurchaseRequest', 760, 820, 260, 'PurchaseRequest', ['price : Number', 'listPrice : Number', 'offerBy : buyer | seller', 'message : String', 'status : RequestStatus', 'history : HistoryEntry [0..*]'], ['create(offer)', 'accept()', 'reject()', 'counter(amount)', 'cancel()', 'complete()']);
  const conv = d.classBox('Conversation', 1110, 820, 230, 'Conversation', ['lastMessage : String', 'lastMessageAt : Date', 'buyerUnread : Integer', 'sellerUnread : Integer'], ['open()', 'sendMessage(text)']);
  const msg = d.classBox('Message', 1420, 820, 210, 'Message', ['sender : User', 'body : String', 'kind : MessageKind', 'amount : Number [0..1]']);
  d.classBox('Role', 40, 960, 120, 'Role', ['student', 'faculty', 'admin'], [], { stereotype: 'enumeration' });
  d.classBox('BookStatus', 180, 960, 130, 'BookStatus', ['active', 'inactive', 'reserved', 'sold', 'deleted', 'hidden', 'removed'], [], { stereotype: 'enumeration' });
  d.classBox('RequestStatus', 330, 960, 140, 'RequestStatus', ['pending', 'accepted', 'rejected', 'cancelled', 'completed'], [], { stereotype: 'enumeration' });
  d.raw(text(490, 1220, 'Every class also has _id : ObjectId, createdAt and updatedAt. Subject is one of 39 names in shared/subjects.mjs. Operations are the API actions that change each document (server/src/routes).', { size: 11.5, anchor: 'start', fill: C.muted, italic: true }));

  const a = (from, to, o) => d.edge(from, to, { head: null, ...o });
  a('User', 'Book', { start: [user.right, 400], end: [book.x, 400], label: 'sells ▸', m1: '1', m2: '0..*' });
  a('User', 'Wishlist', { start: [760, user.y], via: [[760, 175]], end: [wish.x, 175], label: 'saves', labelAt: [790, 240], m1: '1', m2: '0..*' });
  a('Wishlist', 'Book', { start: [wish.right, 175], via: [[1150, 175]], end: [1150, book.y], m1: '0..*', m2: '1' });
  a('Report', 'User', { start: [report.right, 110], via: [[610, 110]], end: [610, user.y], label: 'reporter', m1: '0..*', m2: '1' });
  a('Report', 'User', { start: [report.right, 170], via: [[680, 170]], end: [680, user.y], label: 'targetUser', m1: '0..*', m2: '1' });
  a('Report', 'Book', { start: [165, report.y], via: [[165, 42], [1290, 42]], end: [1290, book.y], label: 'about', labelAt: [1180, 42], m1: '0..*', m2: '0..1' });
  a('Notification', 'User', { start: [notif.right, 540], end: [user.x, 540], label: 'receives', m1: '0..*', m2: '1' });
  a('AuditLog', 'User', { start: [audit.right, 760], via: [[600, 760]], end: [600, user.bottom], label: 'admin', m1: '0..*', m2: '1' });
  a('User', 'PurchaseRequest', { start: [700, user.bottom], via: [[700, 880]], end: [pr.x, 880], label: 'buyer', labelAt: [700, 740], m1: '1', m2: '0..*' });
  a('User', 'PurchaseRequest', { start: [790, user.bottom], end: [790, pr.y], label: 'seller', labelAt: [790, 740], m1: '1', m2: '0..*' });
  a('Book', 'PurchaseRequest', { start: [1090, book.bottom], end: [980, pr.y], label: 'for', m1: '1', m2: '0..*' });
  a('Book', 'Conversation', { start: [1230, book.bottom], end: [1230, conv.y], label: 'about', m1: '1', m2: '0..*' });
  a('User', 'Conversation', { start: [640, user.bottom], via: [[640, 1180], [1225, 1180]], end: [1225, conv.bottom], label: 'buyer / seller (two associations)', m1: '1', m2: '0..*' });
  d.edge('Conversation', 'Message', { start: [conv.right, 880], end: [msg.x, 880], head: null, tail: 'diamond', label: 'contains', labelAt: [1380, 912], m1: '1', m2: '0..*' });
  a('Message', 'PurchaseRequest', { start: [1525, msg.bottom], via: [[1525, 1080], [900, 1080]], end: [900, pr.bottom], label: 'records event of', m1: '0..*', m2: '0..1' });
  return d;
}

export function architecture() {
  const d = new Diagram(1340, 800, 'Figure 2.13  System architecture');
  d.rect('browser', 40, 60, 360, 300, '', { fill: '#ffffff', dash: true, r: 6 });
  d.raw(text(220, 80, 'Web browser', { size: 13, weight: 'bold' }));
  d.rect('spa', 70, 100, 300, 160, 'React 19 single-page app (Vite)\nclient/src/pages · components · context\nReact Router 7 · api.js (fetch, JSON)\nhooks.js (useFetch, useForm)', { fill: C.ext, size: 12 });
  d.rect('shared', 70, 290, 300, 50, 'shared/subjects.mjs\nsubject catalogue (client and server)', { fill: C.store, size: 12 });

  d.rect('server', 570, 60, 730, 380, '', { fill: '#ffffff', dash: true, r: 6 });
  d.raw(text(935, 80, 'Node.js server (Express 5), server/src', { size: 13, weight: 'bold' }));
  d.rect('mw', 600, 100, 670, 60, 'app.js: helmet (security headers, CSP) · express.json (100 kB) · cookie-parser · loadUser (JWT cookie)\nstatic /uploads · built client for production · central error handler', { fill: C.ext, size: 12 });
  d.rect('routes', 600, 185, 670, 70, 'REST routers under /api: auth · users · books · wishlist · requests · conversations · notifications · reports · admin\nmiddleware: validate (zod) · requireAuth / requireMember / requireAdmin · uploadImages (multer) · rate limits', { fill: C.fill, size: 12 });
  d.rect('lib', 600, 280, 670, 60, 'lib services: requests (cancelOpenRequests) · messages (conversationFor, postEvent) · notify · autoSeller (rules)\nstorage (disk or Cloudinary) · mail (SMTP or console) · schemas · http errors', { fill: C.fill, size: 12 });
  d.rect('models', 600, 365, 670, 50, 'Mongoose 9 models: User · Book · PurchaseRequest · Conversation · Message · Wishlist · Report · Notification · AuditLog', { fill: C.fill, size: 12 });

  d.rect('mongo', 600, 510, 330, 60, 'MongoDB 8 (local)\nacademic_marketplace', { fill: C.store, size: 12, weight: 'bold' });
  d.rect('files', 970, 510, 180, 60, 'server/uploads\n(listing photos)', { fill: C.store, size: 12 });
  d.rect('google', 40, 420, 360, 50, 'Google OAuth 2.0 / OpenID Connect (optional)', { fill: '#ffffff', size: 12 });
  d.rect('smtp', 40, 500, 360, 50, 'SMTP mail server (optional, password reset)', { fill: '#ffffff', size: 12 });
  d.rect('cloud', 40, 580, 360, 50, 'Cloudinary image hosting (optional)', { fill: '#ffffff', size: 12 });

  d.rect('tooling', 40, 660, 1260, 120, '', { fill: '#ffffff', dash: true, r: 6 });
  d.raw(text(670, 678, 'Development tooling (no runtime data flow)', { size: 12.5, weight: 'bold', fill: C.muted }));
  d.rect('scripts', 70, 695, 1200, 30, 'server/scripts: create-admin · seed-demo · remove-demo · migrate-subjects (run from the command line against MongoDB)', { fill: C.fill, size: 12 });
  d.rect('tests', 70, 735, 1200, 30, 'Tests: node:test + supertest (server/test, MongoDB test database) · Playwright (e2e/tests, separate e2e database)', { fill: C.fill, size: 12 });

  d.edge('spa', 'mw', { start: [370, 140], end: [600, 125], label: 'HTTPS JSON REST\nrequests + session cookie', labelAt: [485, 98] });
  d.edge('mw', 'spa', { start: [600, 145], end: [370, 165], dashed: true, head: 'open', label: 'JSON responses', labelAt: [485, 168] });
  d.edge('mw', 'routes', { start: [935, 160], end: [935, 185] });
  d.edge('routes', 'lib', { start: [935, 255], end: [935, 280] });
  d.edge('lib', 'models', { start: [935, 340], end: [935, 365] });
  d.edge('models', 'mongo', { start: [765, 415], end: [765, 510], label: 'Mongoose driver', labelAt: [845, 465] });
  d.edge('lib', 'files', { start: [1270, 320], via: [[1290, 320], [1290, 540]], end: [1150, 540] });
  d.edge('routes', 'google', { start: [600, 240], via: [[510, 240], [510, 445]], end: [400, 445] });
  d.edge('lib', 'smtp', { start: [600, 320], via: [[530, 320], [530, 525]], end: [400, 525] });
  d.edge('lib', 'cloud', { start: [600, 330], via: [[550, 330], [550, 605]], end: [400, 605] });
  d.edge('shared', 'routes', { start: [370, 315], via: [[450, 315], [450, 200]], end: [600, 200], dashed: true, head: 'open', label: 'imported by', labelAt: [450, 262] });
  return d;
}

export function states() {
  const d = new Diagram(1300, 640, 'Figure 2.14  State machines: purchase request and listing');
  const st = (id, x, y, w, label) => d.rect(id, x, y, w, 44, label, { r: 20, fill: C.fill, size: 12.5, weight: 'bold' });
  d.raw(text(320, 46, 'PurchaseRequest.status', { size: 13, weight: 'bold', fill: C.muted }));
  d.raw('<circle cx="70" cy="150" r="9" fill="#2f4436"/>');
  d.shapes.set('start1', { kind: 'ellipse', cx: 70, cy: 150, rx: 9, ry: 9 });
  st('pending', 150, 128, 140, 'pending');
  st('accepted', 420, 128, 140, 'accepted');
  st('completed', 420, 290, 140, 'completed');
  st('rejected', 150, 290, 140, 'rejected');
  st('cancelled', 150, 400, 140, 'cancelled');
  d.edge('start1', 'pending', { label: 'Buy now /\nMake an offer', labelAt: [105, 105] });
  d.edge('pending', 'pending', { start: [190, 128], via: [[190, 92], [250, 92]], end: [250, 128], label: 'counter(amount) by the party\nwhose turn it is', labelAt: [220, 78] });
  d.edge('pending', 'accepted', { label: 'accept\n(book: active → reserved)', labelAt: [355, 98] });
  d.edge('accepted', 'completed', { label: 'complete by seller\n(book → sold)', labelAt: [490, 215] });
  d.edge('pending', 'rejected', { label: 'reject', labelAt: [220, 215] });
  d.edge('pending', 'cancelled', { start: [150, 160], via: [[110, 160], [110, 420]], end: [150, 420], label: 'cancel', labelAt: [110, 300] });
  d.edge('accepted', 'cancelled', { start: [560, 160], via: [[620, 160], [620, 440], [380, 440]], end: [290, 425], label: 'cancel, moderation or\nsuspension (book → active)', labelAt: [620, 380] });
  d.raw(text(330, 520, 'One open request per buyer per listing, and at most one accepted or completed request per listing,\nare enforced by partial unique indexes. Each transition is a conditional update (compare-and-set).', { size: 11.5, fill: C.muted, italic: true }));

  d.raw(text(990, 46, 'Book.status', { size: 13, weight: 'bold', fill: C.muted }));
  d.raw('<circle cx="760" cy="150" r="9" fill="#2f4436"/>');
  d.shapes.set('start2', { kind: 'ellipse', cx: 760, cy: 150, rx: 9, ry: 9 });
  st('active', 830, 128, 120, 'active');
  st('reserved', 1080, 128, 120, 'reserved');
  st('sold', 1080, 290, 120, 'sold');
  st('inactive', 830, 290, 120, 'inactive');
  st('deleted', 830, 420, 120, 'deleted');
  st('hidden', 1080, 420, 120, 'hidden');
  st('removed', 1080, 540, 120, 'removed');
  d.edge('start2', 'active', { label: 'create', labelAt: [795, 128] });
  d.edge('active', 'reserved', { label: 'request accepted', labelAt: [1015, 120] });
  d.edge('reserved', 'sold', { label: 'exchange confirmed', labelAt: [1185, 215] });
  d.edge('reserved', 'active', { start: [1080, 165], end: [950, 165], label: 'request cancelled', labelAt: [1015, 182] });
  d.edge('active', 'inactive', { start: [870, 172], end: [870, 290], label: 'deactivate', labelAt: [855, 230] });
  d.edge('inactive', 'active', { start: [910, 290], end: [910, 172], label: 'reactivate', labelAt: [935, 250] });
  d.edge('inactive', 'deleted', { label: 'delete (also from active)', labelAt: [855, 375] });
  d.edge('inactive', 'hidden', { start: [950, 312], via: [[1010, 312], [1010, 442]], end: [1080, 442], label: 'admin hide (from active,\ninactive or reserved)', labelAt: [1058, 372] });
  d.edge('hidden', 'removed', { label: 'admin remove', labelAt: [1185, 505] });
  d.edge('hidden', 'active', { start: [1200, 430], via: [[1250, 430], [1250, 100], [890, 100]], end: [890, 128], dashed: true, head: 'open', label: 'admin restore', labelAt: [1250, 270] });
  return d;
}

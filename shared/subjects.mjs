// The one subject catalogue, imported by the server (validation, migration) and the client (forms, filters, icons).
// Names are stored on listings verbatim, so renaming one needs a data migration (server/scripts/migrate-subjects.js).
// icon: a key of ICONS in client/src/components/ui.jsx. art: a key of ART in client/src/components/BookCard.jsx.
// short: a compact label for cards and generated covers.
export const SUBJECT_GROUPS = [
  {
    name: 'Computer Science',
    art: 'laptop',
    subjects: [
      { name: 'Programming Fundamentals', short: 'Programming', icon: 'code' },
      { name: 'Data Structures and Algorithms', short: 'DS & Algorithms', icon: 'tree' },
      { name: 'Object-Oriented Programming', short: 'OOP', icon: 'braces' },
      { name: 'Database Management Systems', short: 'Databases', icon: 'database' },
      { name: 'Operating Systems', icon: 'monitor' },
      { name: 'Computer Networks', short: 'Networks', icon: 'network' },
      { name: 'Computer Organization and Architecture', short: 'Computer Architecture', icon: 'chip', art: 'chip' },
      { name: 'Software Engineering', icon: 'branch' },
      { name: 'Web Development', icon: 'globe' },
      { name: 'Artificial Intelligence', short: 'AI', icon: 'brain' },
      { name: 'Machine Learning', icon: 'spark' },
      { name: 'Data Science', icon: 'chart' },
      { name: 'Big Data Analytics', short: 'Big Data', icon: 'stack' },
      { name: 'Cybersecurity', icon: 'shield' },
      { name: 'Internet of Things', short: 'IoT', icon: 'signal' },
      { name: 'Cloud Computing', icon: 'cloud' },
      { name: 'Theory of Computation', icon: 'states' },
      { name: 'Compiler Design', icon: 'terminal' },
    ],
  },
  {
    name: 'Mathematics and Basic Sciences',
    art: 'sigma',
    subjects: [
      { name: 'Discrete Mathematics', short: 'Discrete Maths', icon: 'states' },
      { name: 'Calculus', icon: 'integral' },
      { name: 'Linear Algebra', icon: 'matrix' },
      { name: 'Differential Equations', icon: 'wave' },
      { name: 'Probability and Statistics', short: 'Statistics', icon: 'chart' },
      { name: 'Engineering Mathematics', short: 'Engineering Maths', icon: 'sigma' },
      { name: 'Physics', icon: 'atom', art: 'atom' },
      { name: 'Chemistry', icon: 'flask', art: 'atom' },
      { name: 'Environmental Science', short: 'Environment', icon: 'leaf', art: 'atom' },
    ],
  },
  {
    name: 'Core Engineering',
    art: 'gear',
    subjects: [
      { name: 'Basic Electrical and Electronics Engineering', short: 'Electrical & Electronics', icon: 'bolt', art: 'bolt' },
      { name: 'Digital Electronics', icon: 'chip', art: 'chip' },
      { name: 'Signals and Systems', short: 'Signals', icon: 'wave', art: 'chip' },
      { name: 'Engineering Mechanics', short: 'Mechanics', icon: 'gear' },
      { name: 'Engineering Graphics', short: 'Graphics', icon: 'ruler' },
      { name: 'Manufacturing Processes', short: 'Manufacturing', icon: 'gear' },
    ],
  },
  {
    name: 'Other Academic Subjects',
    art: 'briefcase',
    subjects: [
      { name: 'Economics', icon: 'trend', art: 'trend' },
      { name: 'Management', icon: 'briefcase' },
      { name: 'Communication Skills', short: 'Communication', icon: 'chat' },
      { name: 'Professional Ethics', short: 'Ethics', icon: 'scale' },
      { name: 'Entrepreneurship', icon: 'rocket' },
      // Lets a seller list a genuine course book the catalogue has not caught up with, without free text.
      { name: 'Other', short: 'Other subjects', icon: 'book' },
    ],
  },
];

export const SUBJECTS = SUBJECT_GROUPS.flatMap((g) => g.subjects.map((s) => ({ short: s.name, art: g.art, ...s, group: g.name })));
export const SUBJECT_NAMES = SUBJECTS.map((s) => s.name);
const BY_NAME = new Map(SUBJECTS.map((s) => [s.name, s]));
// Undefined for a name outside the catalogue, e.g. a legacy listing that has not been migrated.
export const subjectInfo = (name) => BY_NAME.get(name);

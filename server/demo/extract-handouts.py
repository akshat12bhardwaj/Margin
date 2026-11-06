# Pulls the reading-list sections out of every course handout into raw-references.json.
# Run from the repo root: python server/demo/extract-handouts.py "course-handouts of Subjects"
# Needs pdfplumber. DOCX is read from its XML, because some handouts keep book lists in text boxes
# that python-docx does not expose.
import html, json, pathlib, re, sys, zipfile
import pdfplumber

START = re.compile(r'^\W*(books?\s*:|(text ?books?|reference books?|refernce books?|reference links|recommended (books|reading)|suggested reading|reading material|bibliography|course resources)\b)', re.I)
STOP = re.compile(r'^\W*(assessment|evaluation|experiential|video|e-learning|internet links|note\b|percentage of course|open access|attendance|\d+\.\s*note)', re.I)


def docx_lines(path):
    xml = zipfile.ZipFile(path).read('word/document.xml').decode('utf8')
    lines = [html.unescape(re.sub(r'<[^>]+>', '', p)).strip() for p in xml.split('</w:p>')]
    # Text boxes are stored twice (drawing and fallback), so keep the first copy only.
    return list(dict.fromkeys(l for l in lines if l))


def pdf_lines(path):
    with pdfplumber.open(path) as pdf:
        return [l.strip() for page in pdf.pages for l in (page.extract_text() or '').split('\n') if l.strip()]


def sections(lines):
    found, current = [], None
    for line in lines:
        if START.match(line):
            current = {'heading': line, 'lines': []}
            found.append(current)
        elif STOP.match(line):
            current = None
        elif current is not None:
            current['lines'].append(line)
    return found


root = pathlib.Path(sys.argv[1])
documents = []
for f in sorted(root.rglob('*')):
    suffix = f.suffix.lower()
    if suffix not in ('.pdf', '.docx'):
        continue
    lines = pdf_lines(f) if suffix == '.pdf' else docx_lines(f)
    documents.append({'file': f.name, 'lineCount': len(lines), 'sections': sections(lines)})

out = pathlib.Path(__file__).with_name('raw-references.json')
out.write_text(json.dumps(documents, indent=1, ensure_ascii=False), encoding='utf8')
print(f'{len(documents)} documents; {sum(1 for d in documents if not d["sections"])} without a reading list')

"""One-off cleanup: remove kicker labels, em dashes and middots from source fragments."""
import re, glob, json

REQ_TITLES = {
 'forest': {'climate':'Characteristic climate','soil':'Characteristic soil types','distribution':'Global map of locations and latitudes','species':'Characteristic plant and animal species','problems':'Specific problems caused by humans','solutions':'Potential solutions','gallery':'Pictures','sources':'Sources cited'},
 'estuary': {'climate':'Characteristic climate and conditions','soil':'Bottom substrate','distribution':'Global map of locations and latitudes','species':'Characteristic plant and animal species','problems':'Specific problems caused by humans','solutions':'Potential solutions','gallery':'Pictures','sources':'Sources cited'},
}
TYPES = {'Structural','Physiological','Behavioral','Reproductive','Ecological','Life history'}

def adapt_type(t):
    parts = [p.strip() for p in t.split('·')]
    first = parts[0]
    if len(parts) > 1 and parts[1] in TYPES:
        return f"{first} and {parts[1].lower()} adaptation"
    if first == 'Ecological':
        return 'Ecological pattern'
    if first == 'Life history':
        return 'Life-history adaptation'
    return f"{first} adaptation"

def dashes(text):
    # spaced em dash introduces an explanation -> colon
    text = re.sub(r'\s+—\s+', ': ', text)
    # paired unspaced em dashes inside one sentence -> commas
    text = re.sub(r'—([^—.<>]{1,200}?)—', r', \1, ', text)
    # remaining single unspaced em dash -> colon if it ends a clause, else comma
    text = re.sub(r'—', ', ', text)
    text = text.replace(', ,', ',').replace(' ,', ',')
    return text

for path in glob.glob('src/sections/*.html') + glob.glob('src/pages/*.html') + glob.glob('src/partials/*.html'):
    s = open(path).read()
    eco = 'estuary' if 'estuary' in path else 'forest'
    # chapter kickers -> requirement title as h2
    def fix_chapter(m):
        block = m.group(0)
        cid = m.group(1)
        block = re.sub(r'\s*<p class="chapter__req">.*?</p>', '', block, flags=re.S)
        if cid in REQ_TITLES[eco]:
            block = re.sub(r'(<h2 id="[^"]+">).*?(</h2>)', lambda x: x.group(1) + REQ_TITLES[eco][cid] + x.group(2), block, flags=re.S)
        return block
    s = re.sub(r'<section class="chapter" id="([a-z]+)"[^>]*>\s*<header class="chapter__head">.*?</header>', fix_chapter, s, flags=re.S)
    s = re.sub(r'\s*<p class="chapter__req">.*?</p>', '', s, flags=re.S)
    s = re.sub(r'\s*<p class="eyebrow">.*?</p>', '', s, flags=re.S)
    # species role tag -> first fact
    def fix_role(m):
        role = m.group(1).replace(' · ', '; ')
        return m.group(2) + f'<dl class="species__facts">\n                <div><dt>Role</dt><dd>{role}</dd></div>'
    s = re.sub(r'<p class="species__role-tag">(.*?)</p>(.*?)<dl class="species__facts">', fix_role, s, flags=re.S)
    # adaptation type kicker -> trailing tag
    s = re.sub(r'<h5 class="adapt__title"><span class="adapt__type">(.*?)</span>(.*?)</h5>',
               lambda m: f'<h5 class="adapt__title">{m.group(2)} <span class="adapt__type">{adapt_type(m.group(1))}</span></h5>', s)
    # matrix "not applicable" dashes
    s = s.replace('<td class="n">—</td>', '<td class="n"></td>')
    s = s.replace(' · — = not a notable trait of this species', '. A blank cell means the trait is not notable for that species')
    s = s.replace(' · — = does not apply', '. A blank cell means it does not apply')
    s = s.replace(' · — = not applicable', '. A blank cell means not applicable')
    s = s.replace('● = documented and discussed in the profile below · ◐ = partly / general conifer trait', '● documented and discussed in the profile below; ◐ partly true or a general conifer trait')
    s = s.replace('● = key adaptation discussed in the profile · ◐ = partly true', '● key adaptation discussed in the profile; ◐ partly true')
    s = s.replace('● = key adaptation discussed in the profile · ◐ = partly', '● key adaptation discussed in the profile; ◐ partly true')
    # middots in remaining text
    s = s.replace(' · ', ', ').replace('·', '')
    s = dashes(s)
    open(path, 'w').write(s)

for path in glob.glob('src/figures/*.svg'):
    s = open(path).read().replace(' — ', ': ').replace('—', ', ').replace(' · ', ', ')
    open(path, 'w').write(s)
for path in ['src/data/images.json', 'src/data/refs/estuary.json', 'src/data/refs/forest.json', 'tools/.cache/selections.json']:
    s = open(path).read()
    s = re.sub(r'\s*—\s*', ': ', s) if 'refs' in path else dashes(s)
    open(path, 'w').write(s.replace(' · ', ', '))
print('done')

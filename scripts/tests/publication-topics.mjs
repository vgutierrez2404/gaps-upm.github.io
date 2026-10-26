import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse } from 'yaml';
import { publicationTopics, publicationTitle, publicationAnchor } from '../../src/lib/publication-topics.ts';
const topics=parse(fs.readFileSync(new URL('../../src/data/research_topics.yml',import.meta.url),'utf8'));
const classify = title => publicationTopics({citation:`**${title}.**`},topics);
assert.equal(classify('PANC: Prior-Aware Normalized Cut via Anchor-Augmented Token Graphs')[0],'vision');
assert(classify('Federated learning for hematological diseases').includes('biomedical'));
assert(classify('Federated learning for hematological diseases').includes('federated'));
assert.equal(classify('Neural Speech Synthesis')[0],'audio');
assert.equal(classify('No match here')[0],'other');
assert.deepEqual(publicationTopics({citation:'**Speech synthesis**',topics:['vision','ml']},topics),['vision','ml']);
assert.throws(()=>publicationTopics({citation:'X',topics:['unknown']},topics));
assert.throws(()=>publicationTopics({citation:'X',topics:[]},topics));
assert.equal(publicationTitle('A (2026). **Test title.** *Journal*'),'Test title');
assert.equal(publicationAnchor('Same citation'),publicationAnchor('Same citation'));
console.log('PASS: topic classification, multiple memberships, manual overrides, validation and stable anchors.');

const {publicationResearch}=await import('../../src/lib/publication-topics.ts');
const groups=parse(fs.readFileSync(new URL('../../src/data/publications.yml',import.meta.url),'utf8'));
const current=groups.find(group=>group.year===2026).items;
assert.equal(current.length,24);
for(const paper of current){
  assert(paper.topics?.length);
  assert.deepEqual(publicationTopics(paper,topics),paper.topics);
  assert(publicationResearch(paper,topics));
}
const byId=new Map(current.map(paper=>[paper.id,paper]));
assert(!byId.get('attentive-neural-processes-fast-trajectory-prediction-underwater-acoustic').topics.includes('audio'));
assert(!byId.get('differentiable-articulatory-copy-synthesis-biphonic-singing').topics.includes('generative'));
assert.deepEqual(byId.get('novel-oxygenscan-parameters-differentiate-unique-hemolytic-inflammatory-profiles').topics,['biomedical']);
assert.equal(byId.get('not-all-jensen-shannon-divergence-estimators-are-equal').topics[0],'ml');
assert.equal(byId.get('peer-reviewed-technical-communication').research.basis,'needs-source');
assert.equal(byId.get('peer-reviewed-technical-communication').research.methods.length,0);
assert.throws(()=>publicationResearch({citation:'Invalid',research:{area:'missing',tasks:[],methods:[],basis:'title'}},topics));
assert.throws(()=>publicationResearch({citation:'Invalid',research:{area:'ml',tasks:[''],methods:[],basis:'title'}},topics));
assert(groups.filter(group=>group.year!==2026).every(group=>group.items.every(paper=>!paper.research)));
console.log('PASS: all 24 classifications valid; ambiguous record flagged; conservative topic corrections; earlier years untouched.');

assert(!topics.some(topic => topic.id === 'segmentation'));
assert.deepEqual(byId.get('panc').topics, ['vision']);
assert(byId.get('panc').research.tasks.includes('Image segmentation'));

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('scholar_review', Path(__file__).parents[1] / 'update_publications_from_scholar.py')
m = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = m
SPEC.loader.exec_module(m)

CATALOGUE = '''- year: 2026
  items:
    - id: reviewed
      authors_tags: [camara]
      citation: "Reviewed Author (2026). **Existing work.** *Journal.*"
- year: 2025
  items:
    - id: older
      citation: "Author (2025). **Older reviewed work.** *Journal.*"
'''


def candidate(status='pending', year=2026, title='New verified work'):
    return dict(id='test', status=status, year=year, title=title, authors='M Camara', venue='Journal',
                url='https://example.org/paper', source_profiles=['Mateo'], candidate_author_tags=['camara'],
                confirmed_author_tags=['camara'], notes='')


class ReviewTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / 'publications.yml'
        self.path.write_text(CATALOGUE)

    def apply(self, entries, **kwargs):
        return m.apply_approved(dict(year=2026, candidates=entries), self.path, 2026, {'camara'}, **kwargs)

    def test_pending_rejected_and_other_year_do_not_publish(self):
        self.apply([candidate(), candidate('rejected'), candidate('pending', 2025)])
        self.assertEqual(self.path.read_text(), CATALOGUE)
        self.assertFalse(self.path.with_suffix('.yml.bak').exists())

    def test_approved_only_preserves_catalogue_and_is_idempotent(self):
        c = candidate('approved')
        self.assertEqual(self.apply([c]), 1)
        self.assertEqual(c['status'], 'imported')
        after = self.path.read_text()
        self.assertIn('id: reviewed', after)
        self.assertIn(CATALOGUE[CATALOGUE.index('- year: 2025'):], after)
        self.assertEqual(self.path.with_suffix('.yml.bak').read_text(), CATALOGUE)
        self.assertEqual(self.apply([candidate('approved')]), 0)
        self.assertEqual(after, self.path.read_text())

    def test_off_year_or_missing_authorship_aborts_all_changes(self):
        bad = candidate('approved', 2025)
        with self.assertRaises(ValueError): self.apply([candidate('approved'), bad])
        self.assertEqual(self.path.read_text(), CATALOGUE)
        c = candidate('approved'); c['confirmed_author_tags'] = []; c['candidate_author_tags'] = []
        with self.assertRaises(ValueError): self.apply([c])
        self.assertEqual(self.path.read_text(), CATALOGUE)

    def test_approval_uses_candidate_tags_without_separate_confirmation(self):
        c = candidate('approved'); c['confirmed_author_tags'] = []
        self.assertEqual(self.apply([c]), 1)
        self.assertIn('authors_tags: [camara]', self.path.read_text())

    def test_explicit_author_override_takes_precedence(self):
        c = candidate('approved'); c['candidate_author_tags'] = ['unknown']
        self.assertEqual(self.apply([c]), 1)
        self.assertIn('authors_tags: [camara]', self.path.read_text())

    def test_invalid_candidate_tags_abort_without_writing(self):
        c = candidate('approved'); c['confirmed_author_tags'] = []; c['candidate_author_tags'] = ['unknown']
        with self.assertRaises(ValueError): self.apply([c])
        self.assertEqual(self.path.read_text(), CATALOGUE)

    def test_exact_existing_title_not_imported(self):
        self.assertEqual(self.apply([candidate('approved', title='Existing work')]), 0)
        self.assertEqual(self.path.read_text(), CATALOGUE)

    def test_dry_run_leaves_approval_and_catalogue_unchanged(self):
        c = candidate('approved')
        self.assertEqual(self.apply([c], dry_run=True), 1)
        self.assertEqual(c['status'], 'approved')
        self.assertEqual(self.path.read_text(), CATALOGUE)

    def test_distinct_similar_titles_are_not_silently_deduplicated(self):
        self.assertNotEqual(m.normalize_title('Deep learning for speech enhancement'), m.normalize_title('Deep learning for speech recognition'))
        self.assertEqual(self.apply([candidate('approved', title='Deep learning for speech recognition')]), 1)

    def test_pagination_and_exact_year_boundary(self):
        profile = m.ScholarProfile('Mateo', 'id', 'https://scholar.google.com/citations?user=id', 'camara')
        first = [m.ScholarWork(f'Work {i}', year=2026) for i in range(100)]
        second = [m.ScholarWork('Old', year=2025)]
        with patch.object(m, 'fetch_scholar_page', side_effect=[first, second]) as fetch, patch.object(m.time, 'sleep'):
            self.assertEqual(len(m.fetch_scholar_works(profile, 1000, 20)), 101)
            self.assertEqual([call.args[3] for call in fetch.call_args_list], [0, 100])

    def test_parser_extracts_authors_without_verifying_them(self):
        parser = m.ScholarProfileParser()
        parser.feed('<tr class="gsc_a_tr"><td><a class="gsc_a_at" href="/citations?citation_for_view=x">New work</a><div class="gs_gray">Someone Else</div><div class="gs_gray">Journal</div></td><td><span class="gsc_a_h">2026</span></td></tr>')
        self.assertEqual(parser.rows[0]['authors'], 'Someone Else')
        self.assertEqual(parser.rows[0]['year'], '2026')


if __name__ == '__main__':
    unittest.main()

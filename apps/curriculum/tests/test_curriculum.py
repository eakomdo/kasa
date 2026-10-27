from conftest import STUDENT


def test_units_for_level_band_with_progress(as_user):
    r = as_user(STUDENT).get('/api/levels/b7/units/?lang=twi')
    assert r.status_code == 200
    units = r.json()
    assert units[0]['id'] == 'tw-greet' and units[0]['order'] == 1
    assert units[0]['progress'] == {'learned': 6, 'total': 10}
    assert all('jhs' in u['bands'] for u in units)


def test_vocabulary_carries_the_learners_mastery(as_user):
    words = as_user(STUDENT).get('/api/units/tw-greet/vocabulary/').json()
    assert words[0] == {
        'id': 'tw-greet-w1',
        'unitId': 'tw-greet',
        'lang': 'twi',
        'kind': 'word',
        'english': 'Good morning',
        'translation': 'Maakye',
        'audioUrl': None,
        'mastery': 4,
    }


def test_unknown_unit_is_404(as_user):
    assert as_user(STUDENT).get('/api/units/nope/').status_code == 404


def test_daily_feature(as_user):
    f = as_user(STUDENT).get('/api/daily-feature/?lang=ga').json()
    assert set(f) == {'kicker', 'local', 'english'}

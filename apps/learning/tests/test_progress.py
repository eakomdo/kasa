from conftest import STUDENT


def test_seeded_summary(as_user):
    s = as_user(STUDENT).get('/api/progress/summary/', {'lang': 'twi'}).json()
    assert s['streak'] == 4
    assert s['longestStreak'] == 4
    assert s['dueCount'] == 8
    assert s['learned'] == 14
    assert s['mastered'] == 4
    assert s['totalReviewed'] == 51
    assert len(s['history']) == 14
    assert s['history'][-1]['count'] == 0
    assert [b['id'] for b in s['badges']] == ['akwaaba']
    assert set(s) == {
        'streak',
        'longestStreak',
        'learned',
        'mastered',
        'dueCount',
        'newCount',
        'todayCount',
        'totalReviewed',
        'xpThisWeek',
        'history',
        'badges',
    }


def test_new_count_is_level_words_never_seen(as_user):
    s = as_user(STUDENT).get('/api/progress/summary/', {'lang': 'twi'}).json()
    # JHS units: greet 10, family 10, num 10, school 9, market 12, days 10, culture 9 = 70 words; 14 seen
    assert s['newCount'] == 70 - 14


def test_summary_is_per_language(as_user):
    s = as_user(STUDENT).get('/api/progress/summary/', {'lang': 'ga'}).json()
    assert s['learned'] == 0 and s['dueCount'] == 0

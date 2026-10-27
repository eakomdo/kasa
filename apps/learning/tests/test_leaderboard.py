from conftest import MODERATOR, STUDENT


def test_school_board_has_classmates_and_me(as_user):
    b = as_user(STUDENT).get('/api/leaderboard/', {'scope': 'school', 'lang': 'twi'}).json()
    assert b['label'] == 'Asafo M/A JHS'
    names = [e['displayName'] for e in b['entries']]
    assert 'Kwame O.' in names and 'Ama M.' in names
    assert all(e['school'] == 'Asafo M/A JHS' for e in b['entries'])
    assert b['me']['isMe'] is True
    assert [e['rank'] for e in b['entries']] == list(range(1, len(b['entries']) + 1))
    xps = [e['xp'] for e in b['entries']]
    assert xps == sorted(xps, reverse=True)


def test_region_and_national(as_user):
    c = as_user(STUDENT)
    region = c.get('/api/leaderboard/', {'scope': 'region'}).json()
    assert region['label'] == 'Ashanti Region'
    assert all(e['region'] == 'Ashanti' for e in region['entries'])
    national = c.get('/api/leaderboard/', {'scope': 'national'}).json()
    assert national['label'] == 'All of Ghana'
    assert len(national['entries']) > len(region['entries'])


def test_no_school_means_only_national_ranking(as_user):
    c = as_user(MODERATOR)  # Yaw has no school; region Eastern has no peers
    school = c.get('/api/leaderboard/', {'scope': 'school'}).json()
    assert school['entries'] == [] and school['me'] is None and school['label'] == 'Your school'
    national = c.get('/api/leaderboard/', {'scope': 'national'}).json()
    assert national['me'] is not None


def test_week_starts_on_monday(as_user):
    from datetime import date

    b = as_user(STUDENT).get('/api/leaderboard/').json()
    assert date.fromisoformat(b['weekStart']).weekday() == 0

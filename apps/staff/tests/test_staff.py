"""Community admin: reports, translation review, people and the overview."""

from apps.accounts.models import User
from apps.community.seed import seed_uuid
from apps.translate.models import Suggestion, VerifiedTranslation
from conftest import ADMIN, MODERATOR, STUDENT, TEACHER

FIIFI = 'fiifi.quansah@example.com'


def test_overview_shape_and_real_counts(as_user):
    r = as_user(MODERATOR).get('/api/admin/overview/')
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {'stats', 'signupsByDay', 'languageSplit', 'topRegions'}
    assert body['stats']['openReports'] == 3  # the two rude reports are one post
    assert body['stats']['pendingCommunities'] == 1
    assert body['stats']['verifiedTeachers'] == 2
    assert len(body['signupsByDay']) == 14
    assert sum(x['learners'] for x in body['languageSplit']) == User.objects.count()


def test_admin_area_is_staff_only(as_user):
    assert as_user(TEACHER).get('/api/admin/overview/').status_code == 403
    assert as_user(STUDENT).get('/api/admin/reports/').status_code == 403


def test_suspending_a_reported_author_blocks_their_posts(as_user):
    yaw = as_user(MODERATOR)
    queue = yaw.get('/api/admin/reports/?status=open').json()
    assert {'items', 'total', 'page', 'pageSize'} <= set(queue)
    rude = next(r for r in queue['items'] if r['targetId'] == str(seed_uuid('r-challenge-4')))
    assert rude['reportCount'] == 2
    r = yaw.post(f'/api/admin/reports/{rude["id"]}/resolve/', {'action': 'suspend_user', 'note': ''}, format='json')
    assert r.status_code == 200 and r.json()['status'] == 'resolved'
    assert User.objects.get(email=FIIFI).status == 'suspended'
    fiifi = as_user(FIIFI)
    reply = fiifi.post(f'/api/community/threads/{seed_uuid("t-challenge")}/replies/', {'body': 'sorry'}, format='json')
    assert reply.status_code == 403
    # Both reports on that post are closed
    assert not any(x['targetId'] == rude['targetId'] for x in yaw.get('/api/admin/reports/').json()['items'])


def test_remove_content_hides_the_post(as_user):
    yaw = as_user(MODERATOR)
    spam = next(
        r for r in yaw.get('/api/admin/reports/').json()['items'] if r['targetId'] == str(seed_uuid('r-challenge-3'))
    )
    yaw.post(f'/api/admin/reports/{spam["id"]}/resolve/', {'action': 'remove_content', 'note': 'advert'}, format='json')
    thread = as_user(STUDENT).get(f'/api/community/threads/{seed_uuid("t-challenge")}/').json()
    removed = next(x for x in thread['replies'] if x['id'] == spam['targetId'])
    assert removed['status'] == 'removed' and removed['body'] == ''


def test_teachers_cannot_be_suspended_from_the_queue(as_user):
    yaw = as_user(MODERATOR)
    report = next(
        r for r in yaw.get('/api/admin/reports/').json()['items'] if r['targetId'] == str(seed_uuid('r-pronounce-1'))
    )
    r = yaw.post(f'/api/admin/reports/{report["id"]}/resolve/', {'action': 'suspend_user'}, format='json')
    assert r.status_code == 400


def test_approved_suggestions_become_verified_translations(as_user):
    computer = Suggestion.objects.get(query='computer')
    r = as_user(ADMIN).post(f'/api/admin/suggestions/{computer.id}/review/', {'decision': 'approve'}, format='json')
    assert r.status_code == 200 and r.json()['status'] == 'approved'
    v = VerifiedTranslation.objects.get(lang='twi', english='computer')
    assert v.translation == 'Kɔmputa'
    assert (
        as_user(ADMIN)
        .post(f'/api/admin/suggestions/{computer.id}/review/', {'decision': 'approve'}, format='json')
        .status_code
        == 400
    )


def test_suggestion_queue_sorted_by_supporters(as_user):
    items = as_user(MODERATOR).get('/api/admin/suggestions/').json()['items']
    assert [i['supporters'] for i in items] == sorted((i['supporters'] for i in items), reverse=True)
    assert items[0]['query'] == 'computer'


def test_only_admins_change_roles(as_user):
    student = User.objects.get(email=STUDENT)
    assert (
        as_user(MODERATOR).patch(f'/api/admin/users/{student.id}/', {'role': 'teacher'}, format='json').status_code
        == 403
    )
    r = as_user(ADMIN).patch(f'/api/admin/users/{student.id}/', {'role': 'teacher'}, format='json')
    assert r.status_code == 200 and r.json()['role'] == 'teacher'


def test_moderators_suspend_students_but_not_admins_or_themselves(as_user):
    yaw = as_user(MODERATOR)
    student = User.objects.get(email=STUDENT)
    assert (
        yaw.patch(f'/api/admin/users/{student.id}/', {'status': 'suspended'}, format='json').json()['status']
        == 'suspended'
    )
    admin = User.objects.get(email=ADMIN)
    assert yaw.patch(f'/api/admin/users/{admin.id}/', {'status': 'suspended'}, format='json').status_code == 403
    me = User.objects.get(email=MODERATOR)
    assert yaw.patch(f'/api/admin/users/{me.id}/', {'status': 'suspended'}, format='json').status_code == 400


def test_user_search(as_user):
    page = as_user(MODERATOR).get('/api/admin/users/?q=asafo&pageSize=50').json()
    assert page['total'] >= 3
    assert {'reportsAgainst', 'levelLabel', 'lastActiveAt', 'displayName'} <= set(page['items'][0])


def test_archive_rules(as_user):
    assert as_user(MODERATOR).post('/api/admin/communities/twi-help/archive/').status_code == 403
    r = as_user(MODERATOR).post('/api/admin/communities/accra-ga/archive/')
    assert r.status_code == 200 and r.json()['status'] == 'archived'

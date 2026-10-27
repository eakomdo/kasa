"""
Contract tests for communities, memberships and discussions: the same cases as
the frontend's community.server.test.ts, run against the real API.
"""

import re

import pytest

from apps.accounts.models import User
from apps.community.models import Membership, ModerationLog
from apps.community.seed import seed_uuid
from apps.learning.models import BadgeAward
from apps.notifications.models import Notification
from conftest import MODERATOR, STUDENT, TEACHER

KWAME = 'kwame.owusu@example.com'
KOFI = 'kofi.asare@example.com'
YAA = 'yaa.pokuaa@example.com'
ESI = 'esi.quaye@example.com'
AKOSUA = 'akosua.agyeman@example.com'


def uid(email: str) -> str:
    return str(User.objects.get(email=email).id)


def latest_notification(email: str) -> Notification:
    return Notification.objects.filter(user__email=email).order_by('-created_at').first()


def new_community(**overrides):
    return {
        'name': 'Ejisu Twi debate club',
        'description': 'Students who want to practise speaking Twi by debating fun topics every week.',
        'kind': 'interest',
        'lang': 'twi',
        'bands': ['jhs'],
        'joinPolicy': 'request',
        'school': None,
        'region': 'Ashanti',
        'rules': ['Be kind and patient'],
        **overrides,
    }


def detail(client, cid: str) -> dict:
    r = client.get(f'/api/communities/{cid}/')
    assert r.status_code == 200, r.content
    return r.json()


# ---------------------------------------------------------------- Lists and visibility
def test_ama_sees_her_communities_and_discovers_the_rest(as_user):
    ama = as_user(STUDENT)
    mine = [c['id'] for c in ama.get('/api/communities/?scope=mine').json()]
    assert {'twi-help', 'bece-prep', 'announcements', 'asafo-jhs1b'} <= set(mine)
    discover = ama.get('/api/communities/?scope=discover').json()
    assert 'kumasi-bece' in [c['id'] for c in discover]
    assert all(c['status'] == 'active' for c in discover)
    assert not any((c['membership'] or {}).get('status') == 'member' for c in discover)
    assert {'memberCount', 'threadCount', 'createdBy', 'joinPolicy', 'staffOnlyPosting'} <= set(discover[0])


def test_pending_communities_are_hidden_from_everyone_but_creator_and_staff(as_user):
    assert as_user(STUDENT).get('/api/communities/sunyani-readers/').status_code == 404
    assert as_user(MODERATOR).get('/api/communities/sunyani-readers/').status_code == 200
    created = as_user(AKOSUA).get('/api/communities/?scope=created').json()
    assert next(c for c in created if c['id'] == 'sunyani-readers')['status'] == 'pending'


def test_join_code_only_goes_to_helpers_and_above(as_user):
    assert detail(as_user(STUDENT), 'asafo-jhs1b')['joinCode'] is None
    assert detail(as_user(KWAME), 'asafo-jhs1b')['joinCode'] == 'ASF-7B'
    assert detail(as_user(TEACHER), 'asafo-jhs1b')['joinCode'] == 'ASF-7B'


# ---------------------------------------------------------------- Creating
def test_student_proposal_goes_to_review_and_they_own_it(as_user):
    r = as_user(STUDENT).post('/api/communities/', new_community(), format='json')
    assert r.status_code == 201, r.content
    c = r.json()
    assert c['status'] == 'pending'
    assert c['membership'] == {'status': 'member', 'role': 'owner'}
    assert re.fullmatch(r'[A-Z]{3}-[1-9][A-Z]', c['joinCode'])
    assert c['permissions']['canRemovePosts'] is False
    assert c['id'] == 'ejisu-twi-debate-club'


def test_teacher_proposals_are_reviewed_but_staff_go_live(as_user):
    assert as_user(TEACHER).post('/api/communities/', new_community(), format='json').json()['status'] == 'pending'
    staff = as_user(MODERATOR).post('/api/communities/', new_community(name='Moderator tips'), format='json')
    assert staff.json()['status'] == 'active'


def test_validates_names_descriptions_rules_and_safety(as_user):
    ama = as_user(STUDENT)
    short = ama.post('/api/communities/', new_community(name='Hi'), format='json')
    assert short.status_code == 400 and 'name' in short.json()
    dup = ama.post('/api/communities/', new_community(name='twi HELP'), format='json')
    assert 'already exists' in dup.json()['name'][0]
    phone = ama.post(
        '/api/communities/',
        new_community(description='Call me on 024 123 4567 to join our group now'),
        format='json',
    )
    assert phone.status_code == 400
    many = ama.post('/api/communities/', new_community(rules=list('abcdefg')), format='json')
    assert many.status_code == 400


def test_learners_can_have_three_proposals_waiting(as_user):
    ama = as_user(STUDENT)
    for i in range(3):
        assert (
            ama.post('/api/communities/', new_community(name=f'Study circle {i + 1}'), format='json').status_code == 201
        )
    assert ama.post('/api/communities/', new_community(name='Study circle 4'), format='json').status_code == 429


# ---------------------------------------------------------------- Review
def test_approving_a_proposal_tells_the_creator(as_user):
    c = as_user(STUDENT).post('/api/communities/', new_community(), format='json').json()
    yaw = as_user(MODERATOR)
    queue = yaw.get('/api/admin/communities/?status=pending').json()
    assert c['id'] in [x['id'] for x in queue['items']]
    r = yaw.post(f'/api/admin/communities/{c["id"]}/review/', {'decision': 'approve'}, format='json')
    assert r.json()['status'] == 'active'
    assert latest_notification(STUDENT).kind == 'community_approved'


def test_rejecting_needs_a_reason_the_creator_sees(as_user):
    ama = as_user(STUDENT)
    c = ama.post('/api/communities/', new_community(), format='json').json()
    yaw = as_user(MODERATOR)
    assert (
        yaw.post(f'/api/admin/communities/{c["id"]}/review/', {'decision': 'reject'}, format='json').status_code == 400
    )
    yaw.post(
        f'/api/admin/communities/{c["id"]}/review/',
        {'decision': 'reject', 'note': 'Please add which school this is for.'},
        format='json',
    )
    assert detail(ama, c['id'])['reviewNote'] == 'Please add which school this is for.'
    assert latest_notification(STUDENT).kind == 'community_rejected'


def test_review_queue_is_staff_only(as_user):
    assert as_user(TEACHER).get('/api/admin/communities/').status_code == 403


# ---------------------------------------------------------------- Joining
def test_open_communities_join_instantly(as_user):
    r = as_user(STUDENT).post('/api/communities/pronunciation/join/', {}, format='json')
    assert r.json()['membership'] == {'status': 'member', 'role': 'member'}
    assert r.json()['community']['id'] == 'pronunciation'


def test_ask_to_join_sends_a_request_and_notifies_managers(as_user):
    ama = as_user(STUDENT)
    r = ama.post('/api/communities/kumasi-bece/join/', {'note': 'I am in JHS 1 at Asafo.'}, format='json')
    assert r.json()['membership']['status'] == 'pending'
    n = latest_notification(KWAME)
    assert n.kind == 'join_request' and n.href == '/community/c/kumasi-bece/manage'
    ama.post('/api/communities/kumasi-bece/leave/')
    assert detail(ama, 'kumasi-bece')['membership'] is None


def test_class_communities_need_the_right_code(as_user):
    esi = as_user(ESI)
    assert esi.post('/api/communities/asafo-jhs1b/join/', {'code': 'WRONG-1'}, format='json').status_code == 400
    r = esi.post('/api/communities/asafo-jhs1b/join/', {'code': 'asf-7b'}, format='json')
    assert r.json()['membership']['status'] == 'member'


def test_join_by_code_alone(as_user):
    esi = as_user(ESI)
    r = esi.post('/api/communities/join-by-code/', {'code': ' ASF-7B '}, format='json')
    assert r.json()['community']['id'] == 'asafo-jhs1b'
    assert esi.post('/api/communities/join-by-code/', {'code': 'ZZZ-9Z'}, format='json').status_code == 404


# ---------------------------------------------------------------- Managing members
def test_helpers_answer_requests_plain_members_cannot(as_user):
    kofi_id = uid(KOFI)
    yaa = as_user(YAA)
    assert yaa.post(f'/api/communities/kumasi-bece/requests/{kofi_id}/approve/').status_code == 403
    assert yaa.get('/api/communities/kumasi-bece/members/?status=pending').status_code == 403
    kwame = as_user(KWAME)
    pending = kwame.get('/api/communities/kumasi-bece/members/?status=pending').json()
    assert 'Bantama' in pending[0]['requestNote']
    assert kwame.post(f'/api/communities/kumasi-bece/requests/{kofi_id}/approve/').status_code == 200
    assert detail(as_user(KOFI), 'kumasi-bece')['membership'] == {'status': 'member', 'role': 'member'}
    assert latest_notification(KOFI).kind == 'join_approved'


def test_declining_tells_the_learner(as_user):
    as_user(KWAME).post(f'/api/communities/kumasi-bece/requests/{uid(KOFI)}/decline/')
    assert detail(as_user(KOFI), 'kumasi-bece')['membership'] is None
    assert latest_notification(KOFI).kind == 'join_declined'


def test_students_are_never_community_admins(as_user):
    kojo = as_user(TEACHER)
    r = kojo.patch(f'/api/communities/asafo-jhs1b/members/{uid(STUDENT)}/', {'role': 'admin'}, format='json')
    assert r.status_code == 400 and 'teachers or Kasa staff' in r.json()['detail']
    r = kojo.patch(f'/api/communities/asafo-jhs1b/members/{uid(STUDENT)}/', {'role': 'helper'}, format='json')
    assert r.status_code == 200 and r.json()['role'] == 'helper'
    assert latest_notification(STUDENT).kind == 'role_changed'


def test_student_owner_appoints_helpers_but_cannot_remove(as_user):
    kwame = as_user(KWAME)
    perms = detail(kwame, 'kumasi-bece')['permissions']
    assert perms['canEditSettings'] is True
    assert perms['canRemovePosts'] is False
    assert perms['canManageMembers'] is False
    assert perms['canAppointAdmins'] is False
    kwame.post(f'/api/communities/kumasi-bece/requests/{uid(KOFI)}/approve/')
    assert (
        kwame.patch(f'/api/communities/kumasi-bece/members/{uid(KOFI)}/', {'role': 'helper'}, format='json').status_code
        == 200
    )
    assert kwame.post(f'/api/communities/kumasi-bece/members/{uid(YAA)}/remove/').status_code == 403
    assert kwame.post(f'/api/community/threads/{seed_uuid("t-kumasi-week")}/remove/').status_code == 403


def test_teacher_owner_removes_members_but_cannot_leave(as_user):
    kojo = as_user(TEACHER)
    assert kojo.post(f'/api/communities/asafo-jhs1b/members/{uid(YAA)}/remove/').status_code == 200
    assert ModerationLog.objects.filter(action='remove_member').exists()
    leave = kojo.post('/api/communities/asafo-jhs1b/leave/')
    assert leave.status_code == 400 and 'Hand it to' in leave.json()['detail']


def test_ownership_only_goes_to_adults(as_user):
    kojo = as_user(TEACHER)
    r = kojo.post('/api/communities/asafo-jhs1b/transfer/', {'userId': uid(KWAME)}, format='json')
    assert r.status_code == 400


# ---------------------------------------------------------------- Discussions
def test_class_discussions_are_for_members_but_staff_can_read(as_user):
    esi = as_user(ESI)
    assert esi.get('/api/community/threads/?communityId=asafo-jhs1b').status_code == 403
    assert esi.get(f'/api/community/threads/{seed_uuid("t-asafo-reply")}/').status_code == 403
    staff_view = as_user(MODERATOR).get('/api/community/threads/?communityId=asafo-jhs1b').json()
    assert len(staff_view['items']) == 2
    assert staff_view['items'][0]['pinned'] is True
    assert staff_view['nextCursor'] is None


def test_hub_feed_comes_from_joined_communities_only(as_user):
    feed = as_user(STUDENT).get('/api/community/threads/').json()
    joined = set(Membership.objects.filter(user__email=STUDENT, status='member').values_list('community_id', flat=True))
    assert feed['items'] and all(t['communityId'] in joined for t in feed['items'])
    assert {'communityName', 'replyCount', 'score', 'myVote', 'hasAcceptedAnswer'} <= set(feed['items'][0])


@pytest.mark.parametrize('sort', ['active', 'new', 'top', 'unanswered'])
def test_feed_sorts(as_user, sort):
    r = as_user(STUDENT).get(f'/api/community/threads/?sort={sort}')
    assert r.status_code == 200
    if sort == 'unanswered':
        assert all(t['replyCount'] == 0 for t in r.json()['items'])


def test_non_members_cannot_post_and_announcements_are_staff_only(as_user):
    ama = as_user(STUDENT)
    thread = {
        'title': 'Where can I find more Ga words?',
        'body': 'I finished the greetings unit. What next?',
        'tags': [],
    }
    assert ama.post('/api/community/threads/', {**thread, 'communityId': 'ga-help'}, format='json').status_code == 403
    assert (
        ama.post('/api/community/threads/', {**thread, 'communityId': 'announcements'}, format='json').status_code
        == 403
    )
    ok = ama.post('/api/community/threads/', {**thread, 'communityId': 'twi-help'}, format='json')
    assert ok.status_code == 201 and ok.json()['communityName'] == 'Twi help'


def test_phone_numbers_are_blocked(as_user):
    r = as_user(STUDENT).post(
        '/api/community/threads/',
        {
            'communityId': 'twi-help',
            'title': 'Can someone help me revise?',
            'body': 'Please call me on 024 123 4567 so we can study.',
            'tags': [],
        },
        format='json',
    )
    assert r.status_code == 400 and 'body' in r.json()


def test_asker_is_notified_of_replies(as_user):
    r = as_user(KWAME).post(
        f'/api/community/threads/{seed_uuid("t-challenge")}/replies/', {'body': 'Day 3 done!'}, format='json'
    )
    assert r.status_code == 201
    n = latest_notification(STUDENT)
    assert n.kind == 'reply' and n.href == f'/community/t/{seed_uuid("t-challenge")}'


def test_helpers_pin_but_only_adult_admins_remove(as_user):
    kwame = as_user(KWAME)
    pin = kwame.post(f'/api/community/threads/{seed_uuid("t-asafo-reply")}/pin/')
    assert pin.json()['pinned'] is True
    assert kwame.post(f'/api/community/threads/{seed_uuid("t-asafo-reply")}/remove/').status_code == 403
    r = as_user(TEACHER).post(f'/api/community/replies/{seed_uuid("r-asafo-reply-1")}/remove/')
    assert r.status_code == 200
    removed = next(x for x in r.json()['replies'] if x['id'] == str(seed_uuid('r-asafo-reply-1')))
    assert removed['status'] == 'removed' and removed['body'] == ''


def test_accepting_an_answer_awards_boafo_and_notifies(as_user):
    r = as_user(STUDENT).post(f'/api/community/replies/{seed_uuid("r-asafo-reply-1")}/accept/')
    assert r.status_code == 200 and r.json()['hasAcceptedAnswer'] is True
    assert r.json()['replies'][0]['accepted'] is True
    assert BadgeAward.objects.filter(user__email=KWAME, badge='boafo').exists()
    assert latest_notification(KWAME).kind == 'answer_accepted'


def test_votes_update_score_and_block_self_votes(as_user):
    thread = seed_uuid('t-challenge')  # Ama's thread, base score 12
    kwame = as_user(KWAME)
    r = kwame.post(f'/api/community/threads/{thread}/vote/', {'value': 1}, format='json')
    assert r.json() == {'score': 13, 'myVote': 1}
    r = kwame.post(f'/api/community/threads/{thread}/vote/', {'value': -1}, format='json')
    assert r.json() == {'score': 11, 'myVote': -1}
    assert (
        as_user(STUDENT).post(f'/api/community/threads/{thread}/vote/', {'value': 1}, format='json').status_code == 400
    )


def test_reports_are_deduplicated_and_cannot_target_your_own_post(as_user):
    ama = as_user(STUDENT)
    body = {'targetType': 'reply', 'targetId': str(seed_uuid('r-challenge-3')), 'reason': 'spam', 'note': ''}
    assert ama.post('/api/community/reports/', body, format='json').json() == {'ok': True}
    assert ama.post('/api/community/reports/', body, format='json').status_code == 200
    from apps.community.models import Report

    assert Report.objects.filter(reporter__email=STUDENT, target_id=seed_uuid('r-challenge-3')).count() == 1
    own = {'targetType': 'thread', 'targetId': str(seed_uuid('t-challenge')), 'reason': 'other', 'note': ''}
    assert ama.post('/api/community/reports/', own, format='json').status_code == 400

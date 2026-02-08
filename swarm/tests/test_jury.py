import time
from swarm.jury.jury import JuryManager


def test_create_and_vote():
    jm = JuryManager()
    session = jm.create_session(tasks=['task-1'])
    assert session.session_id
    # Commit phase
    ok = jm.submit_commit(session.session_id, session.members[0], 'commitment-1')
    assert ok
    # Advance to reveal
    ok = jm.advance_to_reveal(session.session_id)
    assert ok
    # Reveal votes
    for m in session.members:
        jm.submit_reveal(session.session_id, m, True)
    # Aggregate
    result = jm.aggregate(session.session_id)
    assert result is True
    s = jm.get_session(session.session_id)
    assert s.state == 'completed'
    assert s.result is True

import hashlib
from swarm.jury import JuryManager


def test_jury_commit_reveal_flow():
    jm = JuryManager()
    s = jm.create_session(tasks=[{"id": "t1"}])

    # contributor commits
    vote = True
    nonce = "abc123"
    commitment = hashlib.sha256((str(int(vote)) + "|" + nonce).encode()).hexdigest()
    assert jm.submit_commit(s.session_id, 'contrib1', commitment) is True

    # advance to reveal
    assert jm.advance_to_reveal(s.session_id) is True

    # reveal
    assert jm.submit_reveal(s.session_id, 'contrib1', vote, nonce) is True

    # aggregate
    res = jm.aggregate(s.session_id)
    assert res['yes'] == 1 and res['no'] == 0 and res['result'] is True

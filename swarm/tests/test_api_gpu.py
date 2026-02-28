import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient
from swarm.api_server import SwarmAPIServer


@pytest.fixture
async def client(loop, aiohttp_client):
    server = SwarmAPIServer(host='127.0.0.1', port=0, total_gpus=2)
    app = web.Application()
    server.setup_routes(app)
    ts = await aiohttp_client(app)
    return ts


@pytest.mark.asyncio
async def test_gpu_register_and_task_flow(client: TestClient):
    # Register contributor
    r = await client.post('/api/gpu/register', json={'contributor_id': 'test-contrib', 'gpuInfo': {'vendor': 'nvidia', 'model': 'gtx', 'vram': 8192, 'cuda': True}})
    data = await r.json()
    assert data['success'] is True

    # Submit a task
    r = await client.post('/api/tasks/submit', json={'workload_type': 'general_compute', 'payload': {'foo': 'bar'}})
    td = await r.json()
    assert td['success'] is True
    task_id = td['task_id']

    # Request task
    r = await client.post('/api/tasks/request', json={'contributor_id': 'test-contrib'})
    req = await r.json()
    assert req['success'] is True
    assert req['task']['task_id'] == task_id

    # Submit result
    r = await client.post(f"/api/tasks/{task_id}/result", json={'contributor_id': 'test-contrib', 'success': True, 'result': {'message': 'done'}})
    res = await r.json()
    assert res['success'] is True

    # Check status
    r = await client.get(f"/api/tasks/{task_id}/status")
    s = await r.json()
    assert s['status'] in ('finished', 'completed', 'failed')

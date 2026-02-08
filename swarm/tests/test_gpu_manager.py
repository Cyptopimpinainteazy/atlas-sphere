from swarm.infra.gpu_manager import GPUManager, GPUCapabilities


def test_register_and_task_flow():
    gm = GPUManager(total_gpus=2)

    caps = GPUCapabilities(vendor='nvidia', device_name='gtx', vram_mb=8192, cuda=True)
    gm.register('contrib-1', 'wallet1', caps)

    tid = gm.enqueue_task('general_compute', {'foo': 'bar'})
    assert tid

    res = gm.assign_task_to('contrib-1')
    assert res.task is not None

    ok = gm.submit_result('contrib-1', res.task.task_id, True, {'message': 'ok'}, None)
    assert ok
    t = gm.get_task(res.task.task_id)
    assert t.status == 'completed' or t.status == 'finished' or t.status == 'completed'

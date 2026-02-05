import { expect } from 'chai';
import { Readable } from 'stream';
import {
  readEnv,
  firstCsv,
  json,
  readJson,
  notFound,
  badRequest,
  serverError,
} from '../src/utils';

class MockRes {
  public status?: number;
  public headers?: Record<string, unknown>;
  public body?: string;
  writeHead(status: number, headers: Record<string, unknown>) {
    this.status = status;
    this.headers = headers;
  }
  end(payload?: string) {
    this.body = payload;
  }
}

describe('utils', () => {
  it('readEnv returns undefined when unset and value when set', () => {
    delete process.env['TEST_ENV_FOO'];
    expect(readEnv('TEST_ENV_FOO')).to.be.undefined;
    process.env['TEST_ENV_FOO'] = 'bar';
    expect(readEnv('TEST_ENV_FOO')).to.equal('bar');
    delete process.env['TEST_ENV_FOO'];
  });

  it('firstCsv extracts the first non-empty CSV entry', () => {
    expect(firstCsv(undefined)).to.be.undefined;
    expect(firstCsv('')).to.be.undefined;
    expect(firstCsv('a,b,c')).to.equal('a');
    expect(firstCsv(' ,  first , second')).to.equal('first');
  });

  it('json writes status, headers and body', () => {
    const res = new MockRes();
    json(res as any, 201, { hello: 'world' });
    expect(res.status).to.equal(201);
    expect(res.headers).to.have.property('content-type');
    expect(res.body).to.equal(JSON.stringify({ hello: 'world' }));
  });

  it('notFound/badRequest/serverError wrapper helpers produce expected bodies', () => {
    const r1 = new MockRes();
    notFound(r1 as any);
    expect(r1.status).to.equal(404);
    expect(JSON.parse(r1.body || '{}').error).to.equal('not_found');

    const r2 = new MockRes();
    badRequest(r2 as any, 'bad input');
    expect(r2.status).to.equal(400);
    expect(JSON.parse(r2.body || '{}').message).to.equal('bad input');

    const r3 = new MockRes();
    serverError(r3 as any, 'oops');
    expect(r3.status).to.equal(500);
    expect(JSON.parse(r3.body || '{}').message).to.equal('oops');
  });

  it('readJson returns parsed JSON or undefined for empty body', async () => {
    // non-empty
    const payload = JSON.stringify({ a: 1 });
    const req = Readable.from([payload]) as any;
    const parsed = await readJson(req);
    expect(parsed).to.deep.equal({ a: 1 });

    // empty
    const req2 = Readable.from([]) as any;
    const parsed2 = await readJson(req2);
    expect(parsed2).to.be.undefined;
  });
});

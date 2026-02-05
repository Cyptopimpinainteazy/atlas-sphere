import { expect } from 'chai';
import {
  buildTimeoutProfile,
  getQuoteLegs,
  generateRouteId,
  normalizeAmount,
  DEFAULT_TIMEOUTS_SECONDS,
} from '../src/uas';

describe('UAS utilities', () => {
  it('buildTimeoutProfile returns expected structure and responderSeconds is half (min 60)', () => {
    const profile = buildTimeoutProfile('bitcoin', 'ethereum');
    expect(profile).to.have.keys([
      'btcSeconds',
      'evmSeconds',
      'svmSeconds',
      'x3vmSeconds',
      'initiatorSeconds',
      'responderSeconds',
    ]);

    expect(profile.btcSeconds).to.equal(DEFAULT_TIMEOUTS_SECONDS.bitcoin);
    expect(profile.evmSeconds).to.equal(DEFAULT_TIMEOUTS_SECONDS.ethereum);
    expect(profile.initiatorSeconds).to.equal(DEFAULT_TIMEOUTS_SECONDS.bitcoin);
    expect(profile.responderSeconds).to.equal(Math.max(60, Math.floor(DEFAULT_TIMEOUTS_SECONDS.bitcoin / 2)));
  });

  it('getQuoteLegs returns initiator and responder legs with correct timelocks', () => {
    const req = { fromChain: 'bitcoin' as const, toChain: 'ethereum' as const, asset: 'BTC', amount: '100' };
    const profile = buildTimeoutProfile(req.fromChain, req.toChain);
    const legs = getQuoteLegs(req, profile);
    expect(legs).to.have.length(2);
    expect(legs[0].role).to.equal('initiator');
    expect(legs[1].role).to.equal('responder');
    expect(legs[0].timelockSeconds).to.equal(profile.initiatorSeconds);
    expect(legs[1].timelockSeconds).to.equal(profile.responderSeconds);
  });

  it('generateRouteId returns a 32-char hex string and is random', () => {
    const id1 = generateRouteId();
    const id2 = generateRouteId();
    expect(id1).to.be.a('string');
    expect(id1).to.match(/^[0-9a-f]{32}$/);
    expect(id2).to.match(/^[0-9a-f]{32}$/);
    expect(id1).to.not.equal(id2);
  });

  it('normalizeAmount accepts bigint, number, and numeric strings and rejects invalid input', () => {
    expect(normalizeAmount(10n)).to.equal(10n);
    expect(normalizeAmount(42)).to.equal(42n);
    expect(normalizeAmount('123')).to.equal(123n);
    expect(() => normalizeAmount('   ')).to.throw('amount cannot be empty');
    expect(() => normalizeAmount({} as any)).to.throw('amount must be a string, number, or bigint');
  });
});

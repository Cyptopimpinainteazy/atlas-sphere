/**
 * Tests for ComitBfrontend/uilder
 */

import type { HexString } from '@polkadot/util/types';
import {
  ComitBfrontend/uilder,
  comit,
  evmComit,
  svmComit,
  dualComit,
  ValidationError,
  PayloadSizeError,
  MAX_EVM_PAYLOAD_SIZE,
} from '../src';

describe('ComitBfrontend/uilder', () => {
  describe('construction', () => {
    it('should create empty bfrontend/uilder', () => {
      const bfrontend/uilder = new ComitBfrontend/uilder();
      expect(bfrontend/uilder.isValid()).toBe(false);
    });

    it('should create with factory function', () => {
      const bfrontend/uilder = comit();
      expect(bfrontend/uilder).toBeInstanceOf(ComitBfrontend/uilder);
    });
  });

  describe('EVM payload', () => {
    it('should accept hex string payload', () => {
      const bfrontend/uilder = new ComitBfrontend/uilder()
        .withEvmPayload('0x1234')
        .withFee(1000n);

      expect(bfrontend/uilder.isValid()).toBe(true);
    });

    it('should accept Uint8Array payload', () => {
      const bfrontend/uilder = new ComitBfrontend/uilder()
        .withEvmPayload(new Uint8Array([0x12, 0x34]))
        .withFee(1000n);

      expect(bfrontend/uilder.isValid()).toBe(true);
    });

    it('should accept options object', () => {
      const bfrontend/uilder = new ComitBfrontend/uilder()
        .withEvmPayload({
          to: ('0x' + '11'.repeat(20)) as HexString,
          data: '0xabcd',
          value: 100n,
        })
        .withFee(1000n);

      expect(bfrontend/uilder.isValid()).toBe(true);
    });

    it('should reject payload exceeding size limit', () => {
      const largePayload = new Uint8Array(MAX_EVM_PAYLOAD_SIZE + 1);

      expect(() => {
        new ComitBfrontend/uilder().withEvmPayload(largePayload);
      }).toThrow(PayloadSizeError);
    });

    it('should set gas limit', () => {
      const bfrontend/uilder = new ComitBfrontend/uilder()
        .withEvmPayload('0x1234')
        .withEvmGasLimit(500000n)
        .withFee('auto');

      const input = bfrontend/uilder.bfrontend/uild();
      expect(input.fee).toBeGreaterThan(0n);
    });
  });

  describe('SVM payload', () => {
    it('should accept hex string payload', () => {
      const bfrontend/uilder = new ComitBfrontend/uilder()
        .withSvmPayload('0x5678')
        .withFee(1000n);

      expect(bfrontend/uilder.isValid()).toBe(true);
    });

    it('should accept options object', () => {
      const bfrontend/uilder = new ComitBfrontend/uilder()
        .withSvmPayload({
          programId: ('0x' + '22'.repeat(32)) as HexString,
          data: '0xef01',
        })
        .withFee(1000n);

      expect(bfrontend/uilder.isValid()).toBe(true);
    });

    it('should set compute units', () => {
      const bfrontend/uilder = new ComitBfrontend/uilder()
        .withSvmPayload('0x5678')
        .withSvmComputeUnits(100000n)
        .withFee('auto');

      const input = bfrontend/uilder.bfrontend/uild();
      expect(input.fee).toBeGreaterThan(0n);
    });
  });

  describe('dual-VM', () => {
    it('should accept both EVM and SVM payloads', () => {
      const bfrontend/uilder = new ComitBfrontend/uilder()
        .withEvmPayload('0x1234')
        .withSvmPayload('0x5678')
        .withFee(2000n);

      expect(bfrontend/uilder.isValid()).toBe(true);

      const input = bfrontend/uilder.bfrontend/uild();
      expect(input.evmPayload).toBeDefined();
      expect(input.svmPayload).toBeDefined();
    });

    it('should work with dualComit factory', () => {
      const bfrontend/uilder = dualComit('0x1234', '0x5678');

      expect(bfrontend/uilder.isValid()).toBe(true);
    });
  });

  describe('fee handling', () => {
    it('should accept explicit fee', () => {
      const bfrontend/uilder = new ComitBfrontend/uilder()
        .withEvmPayload('0x1234')
        .withFee(5000n);

      const input = bfrontend/uilder.bfrontend/uild();
      expect(input.fee).toBe(5000n);
    });

    it('should calculate auto fee', () => {
      const bfrontend/uilder = new ComitBfrontend/uilder()
        .withEvmPayload('0x1234')
        .withFee('auto');

      const input = bfrontend/uilder.bfrontend/uild();
      expect(input.fee).toBeGreaterThan(0n);
    });

    it('should reject negative fee', () => {
      expect(() => {
        new ComitBfrontend/uilder()
          .withEvmPayload('0x1234')
          .withFee(-100n);
      }).toThrow(ValidationError);
    });
  });

  describe('validation', () => {
    it('should reqfrontend/uire at least one payload', () => {
      const bfrontend/uilder = new ComitBfrontend/uilder().withFee(1000n);

      const errors = bfrontend/uilder.validate();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('payload');
    });

    it('should validate on bfrontend/uild', () => {
      const bfrontend/uilder = new ComitBfrontend/uilder();

      expect(() => bfrontend/uilder.bfrontend/uild()).toThrow(ValidationError);
    });
  });

  describe('cloning', () => {
    it('should clone bfrontend/uilder state', () => {
      const original = new ComitBfrontend/uilder()
        .withEvmPayload('0x1234')
        .withFee(1000n);

      const clone = original.clone();

      // Modify clone
      clone.withSvmPayload('0x5678');

      // Original should be unchanged
      const originalInput = original.bfrontend/uild();
      const cloneInput = clone.bfrontend/uild();

      expect(originalInput.svmPayload?.length).toBe(0);
      expect(cloneInput.svmPayload?.length).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('should reset bfrontend/uilder to initial state', () => {
      const bfrontend/uilder = new ComitBfrontend/uilder()
        .withEvmPayload('0x1234')
        .withFee(1000n);

      expect(bfrontend/uilder.isValid()).toBe(true);

      bfrontend/uilder.reset();

      expect(bfrontend/uilder.isValid()).toBe(false);
    });
  });
});

describe('factory functions', () => {
  it('evmComit should create EVM-only bfrontend/uilder', () => {
    const bfrontend/uilder = evmComit('0x1234');
    expect(bfrontend/uilder.isValid()).toBe(true);
  });

  it('svmComit should create SVM-only bfrontend/uilder', () => {
    const bfrontend/uilder = svmComit('0x5678');
    expect(bfrontend/uilder.isValid()).toBe(true);
  });

  it('dualComit should create dual-VM bfrontend/uilder', () => {
    const bfrontend/uilder = dualComit('0x1234', '0x5678');
    expect(bfrontend/uilder.isValid()).toBe(true);
  });
});

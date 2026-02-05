import axios from 'axios';
import x3vmConfig from '../config/x3vm-config';

export class X3VMBusinessHandler {
  constructor(private rpcUrl = x3vmConfig.rpcUrl) {}

  async submitSettlementExtrinsic(encodedExtrinsicHex: string) {
    // Submit encoded extrinsic to the X3VM node via JSON-RPC
    const body = {
      jsonrpc: '2.0',
      method: 'author_submitExtrinsic',
      params: [encodedExtrinsicHex],
      id: 1
    };
    try {
      const res = await axios.post(this.rpcUrl, body, { timeout: 10000 });
      return res.data;
    } catch (err) {
      console.error('[X3VM] submit failed', err.message || err);
      throw err;
    }
  }

  // Placeholder: Encoder will be implemented to convert business payload -> extrinsic
  encodeSettlement(payload: any): string {
    // TODO: implement SCALE encoding or call a utility
    return '0x' + Math.floor(Math.random() * 1e12).toString(16);
  }

  async handleSettlement(payload: any) {
    const extrinsic = this.encodeSettlement(payload);
    return await this.submitSettlementExtrinsic(extrinsic);
  }
}

export default X3VMBusinessHandler;

import { Connection, PublicKey } from '@solana/frontend/web3.js';
import { AnchorProvider, Program } from '@project-serum/anchor';
import { IDL as DexIDL } from '../idl/dex';
import { MEME_AGENT_PROGRAM_ID } from '../config/constants';

export class AbbyService {
  private connection: Connection;
  private provider: AnchorProvider;
  private program: Program;

  constructor(provider: AnchorProvider) {
    this.connection = provider.connection;
    this.provider = provider;
    this.program = new Program(DexIDL, MEME_AGENT_PROGRAM_ID, provider);
  }

  async initialize() {
    // Initialize ABBY's state on the blockchain
    const [abbyPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('abby')],
      this.program.programId
    );

    await this.program.methods
      .initialize()
      .accounts({
        abby: abbyPDA,
        user: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async interact(userInput: string) {
    // Process user input and generate ABBY's response
    const response = await fetch('/api/abby/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: userInput }),
    });
    
    return response.json();
  }

  async swapTokens(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: number,
    slippage: number = 1.0
  ) {
    // Execute token swap using the DEX
    const { transaction, signers } = await this.program.methods
      .swap(new anchor.BN(amount), slippage)
      .accounts({
        user: this.provider.wallet.publicKey,
        inputMint,
        outputMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();

    return { transaction, signers };
  }

  // Add more methods for ABBY's functionality
}

export default AbbyService;

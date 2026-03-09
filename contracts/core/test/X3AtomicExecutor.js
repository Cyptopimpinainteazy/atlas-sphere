const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("X3AtomicExecutor", function () {
  let Executor, executor, owner, relayer, challenger, addr3;

  beforeEach(async function () {
    [owner, relayer, challenger, addr3] = await ethers.getSigners();
    Executor = await ethers.getContractFactory("X3AtomicExecutor");
    executor = await Executor.deploy();
    
    // Set trusted relayer
    await executor.setTrustedRelayer(relayer.address, true);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await executor.owner()).to.equal(owner.address);
    });

    it("Should set owner as trusted relayer", async function () {
      expect(await executor.trustedRelayers(owner.address)).to.be.true;
    });
  });

  describe("Submitting Bundles", function () {
    const bundleId = ethers.id("bundle1");
    const receiptRoot = ethers.id("receipt_root_1");
    const finalizedBlock = 1000;
    const finalityCert = ethers.id("cert1");
    const legsHash = ethers.id("legs1");
    const legCount = 3;

    it("Should allow a trusted relayer to submit a valid bundle", async function () {
      await expect(
        executor.connect(relayer).submitAtomicBundle(
          bundleId, receiptRoot, finalizedBlock, finalityCert, legsHash, legCount
        )
      ).to.emit(executor, "BundleVerified")
       .withArgs(bundleId, receiptRoot, finalityCert, finalizedBlock, legCount, relayer.address);

      const record = await executor.getAtomicExecutionProof(bundleId);
      expect(record.status).to.equal(1); // BundleStatus.Verified
      expect(record.receiptRoot).to.equal(receiptRoot);
      expect(record.finalityCert).to.equal(finalityCert);
      expect(record.legCount).to.equal(legCount);
    });

    it("Should reject un-trusted relayers", async function () {
      await expect(
        executor.connect(addr3).submitAtomicBundle(
          bundleId, receiptRoot, finalizedBlock, finalityCert, legsHash, legCount
        )
      ).to.be.revertedWith("X3AE: not trusted relayer");
    });

    it("Should reject duplicate submissions", async function () {
      await executor.connect(relayer).submitAtomicBundle(
        bundleId, receiptRoot, finalizedBlock, finalityCert, legsHash, legCount
      );

      await expect(
        executor.connect(relayer).submitAtomicBundle(
          bundleId, receiptRoot, finalizedBlock, finalityCert, legsHash, legCount
        )
      ).to.be.revertedWith("X3AE: bundle exists");
    });
  });

  describe("Verification", function () {
    const bundleId = ethers.id("bundle2");
    const receiptRoot = ethers.id("receipt_root_2");
    const finalizedBlock = 2000;
    const finalityCert = ethers.id("cert2");
    const legsHash = ethers.id("legs2");
    const legCount = 2;

    beforeEach(async function () {
      await executor.connect(relayer).submitAtomicBundle(
        bundleId, receiptRoot, finalizedBlock, finalityCert, legsHash, legCount
      );
    });

    it("Should verify correct proof parameters", async function () {
      const valid = await executor.verify(bundleId, legsHash);
      expect(valid).to.be.true;
    });

    it("Should fail verification for unknown bundle", async function () {
      const valid = await executor.verify(ethers.id("unknown"), legsHash);
      expect(valid).to.be.false;
    });
  });

  describe("Challenges and Settlement", function () {
    const bundleId = ethers.id("bundle3");
    
    beforeEach(async function () {
      await executor.connect(relayer).submitAtomicBundle(
        bundleId, ethers.id("r"), 1, ethers.id("c"), ethers.id("l"), 1
      );
    });

    it("Should allow challenge within the window", async function () {
      await expect(executor.connect(challenger).challengeBundle(bundleId, "invalid finality"))
        .to.emit(executor, "BundleChallenged")
        .withArgs(bundleId, challenger.address, "invalid finality");

      const record = await executor.getAtomicExecutionProof(bundleId);
      expect(record.status).to.equal(3); // Challenged
    });

    it("Should allow settlement after challenge window", async function () {
      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");

      await expect(executor.connect(addr3).settleBundleOptimistic(bundleId))
        .to.emit(executor, "BundleSettled")
        .withArgs(bundleId, addr3.address);

      const record = await executor.getAtomicExecutionProof(bundleId);
      expect(record.status).to.equal(2); // Settled
    });

    it("Should reject optimistic settlement before window expires", async function () {
      await expect(
        executor.connect(addr3).settleBundleOptimistic(bundleId)
      ).to.be.revertedWith("X3AE: challenge window active");
    });
  });
});

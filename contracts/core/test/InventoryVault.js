const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("InventoryVault", function () {
  let Vault, vault, Token, token, owner, operator, guardian, user;
  const initialSupply = ethers.parseEther("10000");

  beforeEach(async function () {
    [owner, operator, guardian, user] = await ethers.getSigners();
    
    // Deploy ERC20 mock
    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    token = await ERC20Mock.deploy("Test Token", "TTK", owner.address, initialSupply);
    
    // Deploy Vault
    Vault = await ethers.getContractFactory("InventoryVault");
    vault = await Vault.deploy();

    // Assign roles
    const OPERATOR_ROLE = await vault.OPERATOR_ROLE();
    const GUARDIAN_ROLE = await vault.GUARDIAN_ROLE();
    
    await vault.grantRole(OPERATOR_ROLE, operator.address);
    await vault.grantRole(GUARDIAN_ROLE, guardian.address);
    
    // Approve vault to spend owner's tokens
    await token.connect(owner).approve(await vault.getAddress(), ethers.MaxUint256);
  });

  describe("Deposit & Withdraw", function () {
    it("Should allow admin to deposit tokens and auto-enable asset", async function () {
      const depositAmount = ethers.parseEther("1000");
      
      await expect(vault.connect(owner).deposit(await token.getAddress(), depositAmount))
        .to.emit(vault, "Deposited")
        .withArgs(await token.getAddress(), depositAmount, owner.address);

      const inv = await vault.inventories(await token.getAddress());
      expect(inv.balance).to.equal(depositAmount);
      expect(inv.enabled).to.be.true;
      
      // Default max exposure is 50%
      expect(inv.maxExposure).to.equal(depositAmount * 5000n / 10000n);
      
      const vaultBalance = await token.balanceOf(await vault.getAddress());
      expect(vaultBalance).to.equal(depositAmount);
    });

    it("Should allow admin to withdraw tokens", async function () {
      const depositAmount = ethers.parseEther("1000");
      await vault.connect(owner).deposit(await token.getAddress(), depositAmount);

      const withdrawAmount = ethers.parseEther("500");
      await expect(vault.connect(owner).withdraw(await token.getAddress(), withdrawAmount, user.address))
        .to.emit(vault, "Withdrawn")
        .withArgs(await token.getAddress(), withdrawAmount, user.address);

      const inv = await vault.inventories(await token.getAddress());
      expect(inv.balance).to.equal(ethers.parseEther("500"));
      expect(await token.balanceOf(user.address)).to.equal(withdrawAmount);
    });
  });

  describe("Drawing and Returning Capital", function () {
    const depositAmount = ethers.parseEther("2000");
    const opId = ethers.id("op1");
    
    beforeEach(async function () {
      await vault.connect(owner).deposit(await token.getAddress(), depositAmount);
    });

    it("Should allow operator to draw within exposure limit", async function () {
      const drawAmount = ethers.parseEther("500");
      
      await expect(vault.connect(operator).draw(await token.getAddress(), drawAmount, opId))
        .to.emit(vault, "Drawn")
        .withArgs(await token.getAddress(), drawAmount, opId);
        
      const inv = await vault.inventories(await token.getAddress());
      expect(inv.totalDrawn).to.equal(drawAmount);
      expect(await token.balanceOf(operator.address)).to.equal(drawAmount);
    });

    it("Should reject draw exceeding max exposure", async function () {
      const drawAmount = ethers.parseEther("1500"); // > 1000 (50% of 2000)
      
      await expect(vault.connect(operator).draw(await token.getAddress(), drawAmount, opId))
        .to.be.revertedWithCustomError(vault, "ExposureLimitExceeded");
    });

    it("Should track PnL when returning capital", async function () {
      const drawAmount = ethers.parseEther("500");
      await vault.connect(operator).draw(await token.getAddress(), drawAmount, opId);

      // Operator makes profit and returns more
      const returnAmount = ethers.parseEther("550");
      
      // Operator needs to approve vault
      await token.connect(owner).transfer(operator.address, returnAmount); // Ensure operator has enough to return profit
      await token.connect(operator).approve(await vault.getAddress(), ethers.MaxUint256);

      await expect(vault.connect(operator).returnCapital(await token.getAddress(), returnAmount, drawAmount, opId))
        .to.emit(vault, "Returned")
        .withArgs(await token.getAddress(), returnAmount, returnAmount - drawAmount, opId);

      const pnl = await vault.getPnL(await token.getAddress());
      expect(pnl).to.equal(ethers.parseEther("50"));
      
      const inv = await vault.inventories(await token.getAddress());
      expect(inv.balance).to.equal(depositAmount + ethers.parseEther("50")); // 2050
      expect(inv.totalDrawn).to.equal(0);
    });
  });

  describe("Emergency Controls", function () {
    it("Should allow guardian to pause, preventing operations", async function () {
      await vault.connect(guardian).pause();
      
      await expect(
        vault.connect(owner).deposit(await token.getAddress(), ethers.parseEther("100"))
      ).to.be.revertedWith("Pausable: paused");
      
      await vault.connect(guardian).unpause();
      
      await expect(
        vault.connect(owner).deposit(await token.getAddress(), ethers.parseEther("100"))
      ).to.emit(vault, "Deposited");
    });
  });
});

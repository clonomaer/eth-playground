const hre = require("hardhat");

const ethers = require("ethers");
const { expect } = require("chai");
const { formatBytes32String } = require("@ethersproject/strings");
const waitFor = require("../utils/waitFor");

describe("TrustlessPurchase", function () {
  let trustlessPurchase, owner, addr1, addr2, addr3;
  const value = ethers.utils.parseEther("20");

  before(async () => {
    [owner, addr1, addr2, addr3] = await hre.ethers.getSigners();
    const TrustlessPurchase = await hre.ethers.getContractFactory(
      "TrustlessPurchase"
    );
    trustlessPurchase = await TrustlessPurchase.deploy(value, addr1.address);
    // seller deploys the contract
    // price is an argument
  });

  it("Should not let buyer to deposit a different amount than double the price", async () => {
    const tx = trustlessPurchase
      .connect(addr1)
      .deposit({ value: ethers.utils.parseEther("1") });
    await expect(tx).to.be.reverted;
  });
  it("Should not let seller to deposit a different amount than the price", async () => {
    const tx = trustlessPurchase
      .connect(owner)
      .deposit({ value: ethers.utils.parseEther("1") });
    await expect(tx).to.be.reverted;
  });
  it("Should accept deposit if the amount is right for both parties", async () => {
    const tx1 = trustlessPurchase.connect(owner).deposit({ value });
    const tx2 = trustlessPurchase
      .connect(addr1)
      .deposit({ value: value.mul(2) });
    await expect(tx1).to.emit(trustlessPurchase, "SellerPaid");
    await expect(tx2).to.emit(trustlessPurchase, "BuyerPaid");
  });
  it("Should not accept deposit once the right amount for each party is deposited", async () => {
    const tx1 = trustlessPurchase.connect(owner).deposit({ value });
    const tx2 = trustlessPurchase
      .connect(addr1)
      .deposit({ value: value.mul(2) });
    await expect(tx1).to.be.reverted;
    await expect(tx2).to.be.reverted;
  });
  it("Should let both parties withdraw their funds if deal is not sealed yet", async () => {
    const ownerOldBalance = await trustlessPurchase.provider.getBalance(
      owner.address
    );
    await trustlessPurchase.connect(owner).withdraw();
    expect(
      ethers.utils.formatEther(
        (await trustlessPurchase.provider.getBalance(owner.address)).sub(
          ownerOldBalance
        )
      )
    ).to.match(/^19\.[0-9]+$/);
    const buyerOldBalance = await trustlessPurchase.provider.getBalance(
      addr1.address
    );
    await trustlessPurchase.connect(addr1).withdraw();
    expect(
      ethers.utils.formatEther(
        (await trustlessPurchase.provider.getBalance(addr1.address)).sub(
          buyerOldBalance
        )
      )
    ).to.match(/^39\.[0-9]+$/);
  });
  it("Should not let buyer seal the deal", async () => {
    await trustlessPurchase.connect(owner).deposit({ value });
    await trustlessPurchase.connect(addr1).deposit({ value: value.mul(2) });
    const tx = trustlessPurchase.connect(addr1).seal();
    await expect(tx).to.be.reverted;
  });
  it("Should let seller to seal the deal if both parties have deposited their share", async () => {
    const tx = trustlessPurchase.connect(owner).seal();
    await expect(tx).to.emit(trustlessPurchase, "DealSealed");
  });
  it("Should not accept deposit once deal is sealed", async () => {
    const tx1 = trustlessPurchase.connect(owner).deposit({ value });
    const tx2 = trustlessPurchase
      .connect(addr1)
      .deposit({ value: value.mul(2) });
    await expect(tx1).to.be.reverted;
    await expect(tx2).to.be.reverted;
  });
  it("Should not let parties withdraw if the deal is sealed", async () => {
    const tx = trustlessPurchase.connect(owner).withdraw();
    expect(tx).to.be.reverted;

    const tx2 = trustlessPurchase.connect(addr1).withdraw();
    expect(tx2).to.be.reverted;
  });
  it("Should let buyer to submit delivery", async () => {
    const tx = trustlessPurchase.connect(addr1).reportDelivery();
    expect(tx).to.emit(trustlessPurchase, "Delivered");
  });
  it("Should let parties withdraw their remaining share of funds once delivery is submitted", async () => {
    const ownerOldBalance = await trustlessPurchase.provider.getBalance(
      owner.address
    );
    await trustlessPurchase.connect(owner).withdraw();
    expect(
      ethers.utils.formatEther(
        (await trustlessPurchase.provider.getBalance(owner.address)).sub(
          ownerOldBalance
        )
      )
    ).to.match(/^39\.[0-9]+$/);
    const buyerOldBalance = await trustlessPurchase.provider.getBalance(
      addr1.address
    );
    await trustlessPurchase.connect(addr1).withdraw();
    expect(
      ethers.utils.formatEther(
        (await trustlessPurchase.provider.getBalance(addr1.address)).sub(
          buyerOldBalance
        )
      )
    ).to.match(/^19\.[0-9]+$/);
  });
  it("Should not let parties withdraw if they already withdrawn their share", async () => {
    const tx = trustlessPurchase.connect(owner).withdraw();
    expect(tx).to.be.reverted;

    const tx2 = trustlessPurchase.connect(addr1).withdraw();
    expect(tx2).to.be.reverted;
  });
  it("Should not accept deposit once the delivery is submitted", async () => {
    const tx1 = trustlessPurchase.connect(owner).deposit({ value });
    const tx2 = trustlessPurchase
      .connect(addr1)
      .deposit({ value: value.mul(2) });
    await expect(tx1).to.be.reverted;
    await expect(tx2).to.be.reverted;
  });
});

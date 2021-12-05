const hre = require("hardhat");

const ethers = require("ethers");
const { expect } = require("chai");
const { formatBytes32String } = require("@ethersproject/strings");
const waitFor = require("../utils/waitFor");

describe("BlindAuction", function () {
  let start, blindAuction, owner, addr1, addr2, addr3;
  const bidTimeout = 5000;
  const revealTimeout = 15000;
  function makeBid(amount, secret) {
    return ethers.utils.keccak256(
      new ethers.utils.AbiCoder().encode(
        ["uint256", "bytes32"],
        [ethers.utils.parseEther(amount), formatBytes32String(secret)]
      )
    );
  }
  before(async () => {
    [owner, addr1, addr2, addr3] = await hre.ethers.getSigners();

    start = Date.now();
    const BlindAuction = await hre.ethers.getContractFactory("BlindAuction");
    blindAuction = await BlindAuction.deploy(
      owner.address,
      Math.floor((start + bidTimeout) / 1000),
      Math.floor((start + bidTimeout + revealTimeout) / 1000)
    );
  });

  it("Should let make bid", async () => {
    const tx = blindAuction.connect(addr1).bid(makeBid("1200", "supersecret"));
    await expect(tx).to.emit(blindAuction, "NewBidAdded");
    const tx2 = blindAuction.connect(addr2).bid(makeBid("300", "supersecret"));
    await expect(tx2).to.emit(blindAuction, "NewBidAdded");
    const tx3 = blindAuction.connect(addr3).bid(makeBid("2000", "supersecret"));
    await expect(tx3).to.emit(blindAuction, "NewBidAdded");
  });

  it("Should revert an early reveal", async () => {
    const tx2 = blindAuction.connect(addr1).reveal("1200", "supersecret");
    await expect(tx2).to.be.reverted;
  });

  it("Should revert a late bid", async () => {
    console.log("waiting for bid window to close...");
    await waitFor(bidTimeout + 100);
    const tx = blindAuction.connect(addr1).bid(makeBid("1200", "supersecret"));
    await expect(tx).to.be.reverted;
  });

  it("Should revert a correct reveal with no funds sent", async () => {
    const tx = blindAuction
      .connect(addr1)
      .reveal(
        ethers.utils.parseEther("1200"),
        ethers.utils.formatBytes32String("supersecret")
      );
    await expect(tx).to.be.reverted;
  });

  it("Should revert a false reveal", async () => {
    const tx = blindAuction
      .connect(addr1)
      .reveal(
        ethers.utils.parseEther("5000"),
        ethers.utils.formatBytes32String("supersecret")
      );
    await expect(tx).to.be.reverted;
  });

  it("Should revert a correct reveal with wrong amount sent", async () => {
    const tx = blindAuction
      .connect(addr1)
      .reveal(
        ethers.utils.parseEther("1200"),
        ethers.utils.formatBytes32String("supersecret"),
        {
          value: ethers.utils.parseEther("1500"),
        }
      );
    await expect(tx).to.be.reverted;
  });

  it("Should accept a correct reveal", async () => {
    const tx = blindAuction
      .connect(addr1)
      .reveal(
        ethers.utils.parseEther("1200"),
        ethers.utils.formatBytes32String("supersecret"),
        {
          value: ethers.utils.parseEther("1200"),
        }
      );
    await expect(tx).to.emit(blindAuction, "NewHigherBid");
  });

  it("Should revert a lower reveal", async () => {
    const tx = blindAuction
      .connect(addr2)
      .reveal(
        ethers.utils.parseEther("300"),
        ethers.utils.formatBytes32String("supersecret"),
        {
          value: ethers.utils.parseEther("300"),
        }
      );
    await expect(tx).to.be.reverted;
  });

  it("Should top the winner with higher reveal", async () => {
    const tx = blindAuction
      .connect(addr3)
      .reveal(
        ethers.utils.parseEther("2000"),
        ethers.utils.formatBytes32String("supersecret"),
        {
          value: ethers.utils.parseEther("2000"),
        }
      );
    await expect(tx).to.emit(blindAuction, "NewHigherBid");
  });

  it("Should revert an early endAuction", async () => {
    const tx = blindAuction.connect(owner).endAuction();
    await expect(tx).to.be.reverted;
  });

  it("Should end auction and send funds to owner", async () => {
    const oldOwnerBalance = await blindAuction.provider.getBalance(
      owner.address
    );
    console.log("waiting for reveal window to close...");
    await waitFor(revealTimeout);
    const tx = blindAuction.connect(owner).endAuction();
    await expect(tx).to.emit(blindAuction, "AuctionEnded");
    await tx;
    await expect(
      ethers.utils.formatEther(
        (
          await blindAuction.provider.getBalance(owner.address)
        ).sub(oldOwnerBalance)
      )
    ).to.match(/^1999\.[0-9]*/);
  });
});

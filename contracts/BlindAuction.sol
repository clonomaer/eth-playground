//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

import "hardhat/console.sol";

contract BlindAuction {
    mapping(address => bytes32) bids;
    mapping(address => uint256) pendingReturns;
    uint256 biddingEnd;
    uint256 revealEnd;
    address payable public beneficiary;
    bool public isOver;
    uint256 highestBid;
    address highestBidAccount;

    constructor(
        address payable _beneficiary,
        uint256 _biddingEnd,
        uint256 _revealEnd
    ) {
        beneficiary = _beneficiary;
        biddingEnd = _biddingEnd;
        revealEnd = _revealEnd;
    }

    /// The function has been called too early.
    /// Try again at `time`.
    error TooEarly(uint256 time);
    /// The function has been called too late.
    /// It cannot be called after `time`.
    error TooLate(uint256 time);
    /// The function auctionEnd has already been called.
    error AuctionEndAlreadyCalled();

    event AuctionEnded(address winner, uint256 highestBid);
    event NewBidAdded(address issuer);
    event NewHigherBid(
        address oldHighestBidder,
        uint256 oldHighestBid,
        address newHighestBidder,
        uint256 newHighestBid
    );

    modifier onlyBefore(uint256 time) {
        if (block.timestamp >= time) revert TooLate(time);
        _;
    }
    modifier onlyAfter(uint256 time) {
        if (block.timestamp <= time) revert TooEarly(time);
        _;
    }

    function bid(bytes32 _blindedBid) external onlyBefore(biddingEnd) {
        bids[msg.sender] = _blindedBid;
        emit NewBidAdded(msg.sender);
    }

    function reveal(uint256 _amount, bytes32 _secret)
        external
        payable
        onlyAfter(biddingEnd)
        onlyBefore(revealEnd)
    {
        if (_amount <= highestBid) {
            revert("There already is a higher bid accepted.");
        }
        if (msg.value != _amount) {
            revert("Sent amount doesn't match the bid amount.");
        }
        if (bids[msg.sender] != keccak256(abi.encodePacked(_amount, _secret))) {
            revert("Provided fields don't match your bid.");
        }
        emit NewHigherBid(highestBidAccount, highestBid, msg.sender, _amount);
        pendingReturns[highestBidAccount] = highestBid;
        highestBid = _amount;
        highestBidAccount = msg.sender;
    }

    function withdraw() external {
        uint256 amount = pendingReturns[msg.sender];
        if (amount <= 0) {
            revert("You have no pending returns.");
        }
        pendingReturns[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
    }

    function endAuction() external onlyAfter(revealEnd) {
        if (isOver) {
            revert("Auction already ended.");
        }
        isOver = true;
        emit AuctionEnded(highestBidAccount, highestBid);
        beneficiary.transfer(highestBid);
    }
}

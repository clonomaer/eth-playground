//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

import "hardhat/console.sol";

contract TrustlessPurchase {
    bool public isSealed = false;
    bool public isDelivered = false;
    uint256 public value;
    address payable public seller;
    address payable public buyer;
    bool public sellerPaid = false;
    bool public buyerPaid = false;

    event SellerPaid();
    event BuyerPaid();
    event SellerWithdrawn();
    event BuyerWithdrawn();
    event DealSealed();
    event Delivered();

    error UnrecognizedParty();

    modifier only(address allowedAccount) {
        require(
            msg.sender == allowedAccount,
            "you are not allowed to call this method"
        );
        _;
    }

    constructor(uint256 _value, address payable _buyer) {
        value = _value;
        buyer = _buyer;
        seller = payable(msg.sender);
    }

    function transfer(address payable _destination, uint256 _amount) internal {
        (bool success, ) = _destination.call{value: _amount}("");
        require(success, "Transfer failed.");
    }

    function deposit() external payable {
        require(!isDelivered, "you shall not deposit to a fulfilled delivery");
        if (msg.sender == seller) {
            require(msg.value == value, "sent value doesn't match your share");
            require(sellerPaid == false, "you already paid your share");
            sellerPaid = true;
            emit SellerPaid();
            return;
        }
        if (msg.sender == buyer) {
            require(
                msg.value == value * 2,
                "sent value doesn't match your share"
            );
            require(buyerPaid == false, "you already paid your share");
            buyerPaid = true;
            emit BuyerPaid();
            return;
        }
        revert UnrecognizedParty();
    }

    function withdraw() external {
        require(
            !(isSealed && !isDelivered),
            "you are not allowed to widthraw at this point"
        );
        if (msg.sender == seller) {
            require(
                sellerPaid == true,
                "you are not allowed to withdraw when you haven't paid anything"
            );
            sellerPaid = false;
            if (isSealed && isDelivered) {
                transfer(seller, value * 2);
            } else {
                transfer(seller, value);
            }
            emit SellerWithdrawn();
            return;
        }
        if (msg.sender == buyer) {
            require(
                buyerPaid == true,
                "you are not allowed to withdraw when you haven't paid anything"
            );
            buyerPaid = false;
            if (isSealed && isDelivered) {
                transfer(buyer, value);
            } else {
                transfer(buyer, value * 2);
            }
            emit BuyerWithdrawn();
            return;
        }
        revert UnrecognizedParty();
    }

    function seal() external only(seller) {
        require(sellerPaid && buyerPaid, "both parties should pay the escrow");
        isSealed = true;
        emit DealSealed();
    }

    function reportDelivery() external only(buyer) {
        require(isSealed, "cannot report receive when deal is not sealed");
        isDelivered = true;
        emit Delivered();
    }
}

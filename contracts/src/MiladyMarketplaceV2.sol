// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

interface IERC721 {
    function ownerOf(uint256 tokenId) external view returns (address);
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
}

interface IERC1155 {
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external;
}

library ECDSA {
    function toEthSignedMessageHash(bytes32 hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }

    function recover(bytes32 hash, bytes calldata signature) internal pure returns (address) {
        if (signature.length != 65) return address(0);

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        if (v < 27) v += 27;
        if (v != 27 && v != 28) return address(0);

        return ecrecover(hash, v, r, s);
    }
}

contract MiladyMarketplaceV2 {
    enum ItemType {
        NATIVE,
        ERC20,
        ERC721,
        ERC1155
    }

    struct OfferItem {
        ItemType itemType;
        address token;
        uint256 identifier;
        uint256 amount;
    }

    struct ConsiderationItem {
        ItemType itemType;
        address token;
        uint256 identifier;
        uint256 amount;
        address recipient;
    }

    struct OrderComponents {
        address offerer;
        OfferItem[] offer;
        ConsiderationItem[] consideration;
        uint256 startTime;
        uint256 endTime;
        uint256 salt;
        uint256 counter;
    }

    struct Order {
        OrderComponents parameters;
        bytes signature;
    }

    struct AdvancedOrder {
        OrderComponents parameters;
        uint120 numerator;
        uint120 denominator;
        bytes signature;
    }

    struct OrderStatus {
        bool isValidated;
        bool isCancelled;
        uint256 totalFilled;
        uint256 totalSize;
    }

    struct BasicOrderParameters {
        address offerer;
        OfferItem offer;
        ConsiderationItem[] consideration;
        uint256 startTime;
        uint256 endTime;
        uint256 salt;
        uint256 counter;
        bytes signature;
    }

    struct FulfillmentComponent {
        uint256 orderIndex;
        uint256 itemIndex;
    }

    struct Fulfillment {
        FulfillmentComponent[] offerComponents;
        FulfillmentComponent[] considerationComponents;
    }

    struct CriteriaResolver {
        uint256 orderIndex;
        uint8 side;
        uint256 index;
        uint256 identifier;
        bytes32[] criteriaProof;
    }

    struct Execution {
        ItemType itemType;
        address token;
        address from;
        address to;
        uint256 identifier;
        uint256 amount;
    }

    string private constant _VERSION = "2.0.0-seaport-lite";
    string private constant _NAME = "Milady Marketplace V2";

    mapping(bytes32 => OrderStatus) private _orderStatus;
    mapping(address => uint256) private _counters;

    uint256 private _reentrancyLock;

    event OrderValidated(bytes32 indexed orderHash, address indexed offerer);
    event OrderCancelled(bytes32 indexed orderHash, address indexed offerer);
    event CounterIncremented(address indexed offerer, uint256 newCounter);
    event OrderFulfilled(
        bytes32 indexed orderHash,
        address indexed offerer,
        address indexed fulfiller,
        uint256 value
    );

    modifier nonReentrant() {
        require(_reentrancyLock == 0, "REENTRANCY");
        _reentrancyLock = 1;
        _;
        _reentrancyLock = 0;
    }

    function name() external pure returns (string memory contractName) {
        return _NAME;
    }

    function information()
        external
        view
        returns (
            string memory version,
            bytes32 domainSeparator,
            address conduitController
        )
    {
        return (_VERSION, _domainSeparator(), address(0));
    }

    function getCounter(address offerer) external view returns (uint256 counter) {
        return _counters[offerer];
    }

    function incrementCounter() external returns (uint256 newCounter) {
        newCounter = ++_counters[msg.sender];
        emit CounterIncremented(msg.sender, newCounter);
    }

    function getOrderHash(OrderComponents memory order) public view returns (bytes32 orderHash) {
        orderHash = keccak256(
            abi.encode(
                _domainSeparator(),
                order.offerer,
                _hashOffer(order.offer),
                _hashConsideration(order.consideration),
                order.startTime,
                order.endTime,
                order.salt,
                order.counter
            )
        );
    }

    function getOrderStatus(bytes32 orderHash)
        external
        view
        returns (
            bool isValidated,
            bool isCancelled,
            uint256 totalFilled,
            uint256 totalSize
        )
    {
        OrderStatus memory status = _orderStatus[orderHash];
        return (status.isValidated, status.isCancelled, status.totalFilled, status.totalSize);
    }

    function cancel(OrderComponents[] calldata orders) external returns (bool cancelled) {
        uint256 len = orders.length;
        for (uint256 i = 0; i < len; i++) {
            require(orders[i].offerer == msg.sender, "NOT_OFFERER");
            bytes32 orderHash = getOrderHash(orders[i]);
            _orderStatus[orderHash].isCancelled = true;
            emit OrderCancelled(orderHash, msg.sender);
        }
        return true;
    }

    function validate(Order[] calldata orders) external returns (bool validated) {
        uint256 len = orders.length;
        for (uint256 i = 0; i < len; i++) {
            bytes32 orderHash = getOrderHash(orders[i].parameters);
            OrderStatus storage status = _orderStatus[orderHash];

            if (!status.isValidated) {
                if (msg.sender != orders[i].parameters.offerer) {
                    require(_isSignedByOfferer(orderHash, orders[i].parameters.offerer, orders[i].signature), "BAD_SIG");
                }
                status.isValidated = true;
                if (status.totalSize == 0) {
                    status.totalSize = 1;
                }
                emit OrderValidated(orderHash, orders[i].parameters.offerer);
            }
        }
        return true;
    }

    function fulfillBasicOrder(BasicOrderParameters calldata parameters)
        external
        payable
        nonReentrant
        returns (bool fulfilled)
    {
        OfferItem[] memory singleOffer = new OfferItem[](1);
        singleOffer[0] = parameters.offer;

        OrderComponents memory orderParameters = OrderComponents({
            offerer: parameters.offerer,
            offer: singleOffer,
            consideration: parameters.consideration,
            startTime: parameters.startTime,
            endTime: parameters.endTime,
            salt: parameters.salt,
            counter: parameters.counter
        });

        bytes32 orderHash = getOrderHash(orderParameters);
        _assertOrderFillable(orderHash, orderParameters, parameters.signature);

        _transferOfferItems(parameters.offerer, msg.sender, singleOffer);
        _transferConsiderationItems(msg.sender, parameters.consideration, msg.value);

        _markFilled(orderHash);
        emit OrderFulfilled(orderHash, parameters.offerer, msg.sender, msg.value);
        return true;
    }

    function fulfillOrder(Order calldata order, bytes32 /*fulfillerConduitKey*/)
        public
        payable
        nonReentrant
        returns (bool fulfilled)
    {
        bytes32 orderHash = getOrderHash(order.parameters);
        _assertOrderFillable(orderHash, order.parameters, order.signature);

        _transferOfferItems(order.parameters.offerer, msg.sender, order.parameters.offer);
        _transferConsiderationItems(msg.sender, order.parameters.consideration, msg.value);

        _markFilled(orderHash);

        emit OrderFulfilled(orderHash, order.parameters.offerer, msg.sender, msg.value);
        return true;
    }

    function fulfillAdvancedOrder(
        AdvancedOrder calldata advancedOrder,
        CriteriaResolver[] calldata /*criteriaResolvers*/,
        bytes32 /*fulfillerConduitKey*/,
        address recipient
    ) external payable returns (bool fulfilled) {
        require(advancedOrder.numerator == advancedOrder.denominator, "NO_PARTIAL");
        address finalRecipient = recipient == address(0) ? msg.sender : recipient;

        bytes32 orderHash = getOrderHash(advancedOrder.parameters);
        _assertOrderFillable(orderHash, advancedOrder.parameters, advancedOrder.signature);

        _transferOfferItems(advancedOrder.parameters.offerer, finalRecipient, advancedOrder.parameters.offer);
        _transferConsiderationItems(msg.sender, advancedOrder.parameters.consideration, msg.value);

        _markFilled(orderHash);
        emit OrderFulfilled(orderHash, advancedOrder.parameters.offerer, msg.sender, msg.value);

        return true;
    }

    function fulfillAvailableOrders(
        Order[] calldata /*orders*/,
        FulfillmentComponent[][] calldata /*offerFulfillments*/,
        FulfillmentComponent[][] calldata /*considerationFulfillments*/,
        bytes32 /*fulfillerConduitKey*/,
        uint256 /*maximumFulfilled*/
    ) external pure returns (bool[] memory availableOrders, Execution[] memory executions) {
        revert("NOT_IMPLEMENTED_IN_LITE");
    }

    function fulfillAvailableAdvancedOrders(
        AdvancedOrder[] calldata /*advancedOrders*/,
        CriteriaResolver[] calldata /*criteriaResolvers*/,
        FulfillmentComponent[][] calldata /*offerFulfillments*/,
        FulfillmentComponent[][] calldata /*considerationFulfillments*/,
        bytes32 /*fulfillerConduitKey*/,
        address /*recipient*/,
        uint256 /*maximumFulfilled*/
    ) external pure returns (bool[] memory availableOrders, Execution[] memory executions) {
        revert("NOT_IMPLEMENTED_IN_LITE");
    }

    function matchOrders(
        Order[] calldata /*orders*/,
        Fulfillment[] calldata /*fulfillments*/
    ) external pure returns (Execution[] memory executions) {
        revert("NOT_IMPLEMENTED_IN_LITE");
    }

    function matchAdvancedOrders(
        AdvancedOrder[] calldata /*orders*/,
        CriteriaResolver[] calldata /*criteriaResolvers*/,
        Fulfillment[] calldata /*fulfillments*/,
        address /*recipient*/
    ) external pure returns (Execution[] memory executions) {
        revert("NOT_IMPLEMENTED_IN_LITE");
    }

    function _assertOrderFillable(
        bytes32 orderHash,
        OrderComponents memory order,
        bytes memory signature
    ) internal view {
        OrderStatus memory status = _orderStatus[orderHash];

        require(!status.isCancelled, "CANCELLED");
        require(status.totalFilled == 0, "ALREADY_FILLED");
        require(block.timestamp >= order.startTime, "NOT_STARTED");
        require(block.timestamp <= order.endTime, "EXPIRED");
        require(order.counter == _counters[order.offerer], "BAD_COUNTER");
        require(order.offer.length > 0, "NO_OFFER");
        require(order.consideration.length > 0, "NO_CONSIDERATION");

        if (!status.isValidated) {
            require(_isSignedByOfferer(orderHash, order.offerer, signature), "BAD_SIG");
        }
    }

    function _isSignedByOfferer(bytes32 orderHash, address offerer, bytes calldata signature) internal pure returns (bool) {
        address signer = ECDSA.recover(ECDSA.toEthSignedMessageHash(orderHash), signature);
        return signer == offerer;
    }

    function _isSignedByOfferer(bytes32 orderHash, address offerer, bytes memory signature) internal pure returns (bool) {
        address signer = _recoverMemory(ECDSA.toEthSignedMessageHash(orderHash), signature);
        return signer == offerer;
    }

    function _recoverMemory(bytes32 hash, bytes memory signature) internal pure returns (address) {
        if (signature.length != 65) return address(0);

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }

        if (v < 27) v += 27;
        if (v != 27 && v != 28) return address(0);

        return ecrecover(hash, v, r, s);
    }

    function _markFilled(bytes32 orderHash) internal {
        OrderStatus storage status = _orderStatus[orderHash];
        status.totalFilled = 1;
        if (status.totalSize == 0) {
            status.totalSize = 1;
        }
        status.isValidated = true;
    }

    function _transferOfferItems(address from, address to, OfferItem[] memory offer) internal {
        uint256 len = offer.length;
        for (uint256 i = 0; i < len; i++) {
            OfferItem memory item = offer[i];
            if (item.itemType == ItemType.ERC721) {
                IERC721(item.token).safeTransferFrom(from, to, item.identifier);
            } else if (item.itemType == ItemType.ERC1155) {
                IERC1155(item.token).safeTransferFrom(from, to, item.identifier, item.amount, "");
            } else if (item.itemType == ItemType.ERC20) {
                require(IERC20(item.token).transferFrom(from, to, item.amount), "ERC20_OFFER_FAIL");
            } else {
                revert("NATIVE_IN_OFFER_UNSUPPORTED");
            }
        }
    }

    function _transferConsiderationItems(
        address fulfiller,
        ConsiderationItem[] memory consideration,
        uint256 nativeValue
    ) internal {
        uint256 len = consideration.length;
        uint256 nativeSpent;

        for (uint256 i = 0; i < len; i++) {
            ConsiderationItem memory item = consideration[i];
            address recipient = item.recipient == address(0) ? fulfiller : item.recipient;

            if (item.itemType == ItemType.NATIVE) {
                nativeSpent += item.amount;
                (bool ok, ) = payable(recipient).call{value: item.amount}("");
                require(ok, "NATIVE_TRANSFER_FAIL");
            } else if (item.itemType == ItemType.ERC20) {
                require(IERC20(item.token).transferFrom(fulfiller, recipient, item.amount), "ERC20_TRANSFER_FAIL");
            } else if (item.itemType == ItemType.ERC721) {
                IERC721(item.token).safeTransferFrom(fulfiller, recipient, item.identifier);
            } else {
                IERC1155(item.token).safeTransferFrom(fulfiller, recipient, item.identifier, item.amount, "");
            }
        }

        require(nativeValue == nativeSpent, "BAD_MSG_VALUE");
    }

    function _hashOffer(OfferItem[] memory offer) internal pure returns (bytes32) {
        bytes32[] memory hashes = new bytes32[](offer.length);
        for (uint256 i = 0; i < offer.length; i++) {
            hashes[i] = keccak256(abi.encode(offer[i].itemType, offer[i].token, offer[i].identifier, offer[i].amount));
        }
        return keccak256(abi.encodePacked(hashes));
    }

    function _hashConsideration(ConsiderationItem[] memory consideration) internal pure returns (bytes32) {
        bytes32[] memory hashes = new bytes32[](consideration.length);
        for (uint256 i = 0; i < consideration.length; i++) {
            hashes[i] = keccak256(
                abi.encode(
                    consideration[i].itemType,
                    consideration[i].token,
                    consideration[i].identifier,
                    consideration[i].amount,
                    consideration[i].recipient
                )
            );
        }
        return keccak256(abi.encodePacked(hashes));
    }

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), _NAME, _VERSION));
    }

    receive() external payable {}
}

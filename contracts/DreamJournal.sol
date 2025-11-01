// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title DreamJournal - Encrypted Dream Journal Storage
/// @notice Stores encrypted dream content using FHE. Only encrypted data is stored on-chain.
/// @dev Dream text is encrypted as euint8[] (one byte per character)
contract DreamJournal is SepoliaConfig {
    struct Dream {
        address owner;
        string title; // Plaintext title for listing purposes
        euint8[] encContent; // FHE-encrypted dream content (one byte per character)
        uint64 createdAt; // Unix timestamp
    }

    Dream[] private _dreams;
    mapping(address => uint256[]) private _dreamsOf;

    event DreamCreated(uint256 indexed id, address indexed owner, string title, uint64 createdAt);

    /// @notice Create a new dream entry
    /// @param title Plaintext title for listing
    /// @param encContent Array of encrypted bytes (one externalEuint8 per character)
    /// @param inputProof The input proof for the encrypted content
    /// @return id The ID of the newly created dream
    function createDream(
        string calldata title,
        externalEuint8[] calldata encContent,
        bytes calldata inputProof
    ) external returns (uint256 id) {
        require(encContent.length > 0, "Empty content");

        Dream memory dream;
        dream.owner = msg.sender;
        dream.title = title;
        dream.createdAt = uint64(block.timestamp);

        // Import and store encrypted bytes
        dream.encContent = new euint8[](encContent.length);
        for (uint256 i = 0; i < encContent.length; i++) {
            euint8 b = FHE.fromExternal(encContent[i], inputProof);
            dream.encContent[i] = b;
            // Grant access: contract and owner can decrypt
            FHE.allowThis(b);
            FHE.allow(b, msg.sender);
        }

        // Persist and index
        _dreams.push(dream);
        id = _dreams.length - 1;
        _dreamsOf[msg.sender].push(id);

        emit DreamCreated(id, msg.sender, title, dream.createdAt);
    }

    /// @notice Get the number of dreams for a user
    /// @param user The user address
    /// @return count Number of dreams
    function getDreamCount(address user) external view returns (uint256 count) {
        return _dreamsOf[user].length;
    }

    /// @notice Get dream IDs for a user
    /// @param user The user address
    /// @return ids Array of dream IDs
    function getDreamIds(address user) external view returns (uint256[] memory ids) {
        return _dreamsOf[user];
    }

    /// @notice Get metadata for a dream (title, owner, timestamp)
    /// @param id The dream ID
    /// @return owner Owner address
    /// @return title Title string
    /// @return createdAt Timestamp
    function getDreamMeta(uint256 id)
        external
        view
        returns (address owner, string memory title, uint64 createdAt)
    {
        Dream storage dream = _dreams[id];
        require(dream.encContent.length > 0, "Dream does not exist");
        return (dream.owner, dream.title, dream.createdAt);
    }

    /// @notice Get the length of encrypted content for a dream
    /// @param id The dream ID
    /// @return length Number of encrypted bytes
    function getDreamContentLength(uint256 id) external view returns (uint256 length) {
        Dream storage dream = _dreams[id];
        require(dream.encContent.length > 0, "Dream does not exist");
        return dream.encContent.length;
    }

    /// @notice Get a single encrypted byte at a specific index
    /// @param id The dream ID
    /// @param index The byte index
    /// @return encByte The encrypted byte
    function getDreamContentByte(uint256 id, uint256 index) external view returns (euint8 encByte) {
        Dream storage dream = _dreams[id];
        require(index < dream.encContent.length, "Index out of bounds");
        return dream.encContent[index];
    }
}


# CryptoNote Library for Tauri Integration
cmake_minimum_required(VERSION 3.5)

set(CMAKE_CXX_STANDARD 11)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

project(cryptonote_tauri)

# Include directories
include_directories(include src external "${CMAKE_BINARY_DIR}/version")

# Platform-specific includes
if(APPLE)
  include_directories(SYSTEM /usr/include/malloc)
  enable_language(ASM)
elseif(UNIX)
  include_directories(src/Platform/Linux)
elseif(WIN32)
  include_directories(src/Platform/Windows)
endif()

# Core CryptoNote sources
set(CRYPTONOTE_SOURCES
  # Common utilities
  src/Common/Base58.cpp
  src/Common/Base64.cpp
  src/Common/CommandLine.cpp
  src/Common/Util.cpp
  src/Common/StringTools.cpp
  src/Common/JsonValue.cpp
  src/Common/ConsoleTools.cpp
  src/Common/MemoryInputStream.cpp
  src/Common/PathTools.cpp
  src/Common/DnsTools.cpp
  src/Common/StdInputStream.cpp
  src/Common/StdOutputStream.cpp
  src/Common/StreamTools.cpp
  src/Common/StringOutputStream.cpp
  src/Common/StringView.cpp
  src/Common/VectorOutputStream.cpp
  
  # Cryptographic operations
  src/crypto/chacha8.c
  src/crypto/crypto-ops-data.c
  src/crypto/crypto-ops.c
  src/crypto/crypto.cpp
  src/crypto/hash.c
  src/crypto/keccak.c
  src/crypto/random.c
  src/crypto/tree-hash.c
  src/crypto/blake256.c
  src/crypto/groestl.c
  src/crypto/hash-extra-blake.c
  src/crypto/hash-extra-groestl.c
  src/crypto/hash-extra-jh.c
  src/crypto/hash-extra-skein.c
  src/crypto/jh.c
  src/crypto/oaes_lib.c
  src/crypto/skein.c
  src/crypto/slow-hash.c
  src/crypto/slow-hash.cpp
  src/crypto/aesb.c
  
  # CryptoNote Core
  src/CryptoNoteCore/BlockchainIndices.cpp
  src/CryptoNoteCore/BlockchainMessages.cpp
  src/CryptoNoteCore/BlockIndex.cpp
  src/CryptoNoteCore/CoreConfig.cpp
  src/CryptoNoteCore/CryptoNoteBasic.cpp
  src/CryptoNoteCore/CryptoNoteTools.cpp
  src/CryptoNoteCore/Currency.cpp
  src/CryptoNoteCore/DepositIndex.cpp
  src/CryptoNoteCore/InvestmentIndex.cpp
  src/CryptoNoteCore/MinerConfig.cpp
  src/CryptoNoteCore/Transaction.cpp
  src/CryptoNoteCore/Account.cpp
  src/CryptoNoteCore/Blockchain.cpp
  src/CryptoNoteCore/Checkpoints.cpp
  src/CryptoNoteCore/CryptoNoteBasicImpl.cpp
  src/CryptoNoteCore/Core.cpp
  src/CryptoNoteCore/CryptoNoteFormatUtils.cpp
  src/CryptoNoteCore/CryptoNoteSerialization.cpp
  src/CryptoNoteCore/Difficulty.cpp
  src/CryptoNoteCore/IBlock.cpp
  src/CryptoNoteCore/Miner.cpp
  src/CryptoNoteCore/TransactionExtra.cpp
  src/CryptoNoteCore/TransactionPool.cpp
  src/CryptoNoteCore/TransactionPrefixImpl.cpp
  src/CryptoNoteCore/TransactionUtils.cpp
  
  # Wallet Legacy
  src/WalletLegacy/KeysStorage.cpp
  src/WalletLegacy/WalletLegacy.cpp
  src/WalletLegacy/WalletHelper.cpp
  src/WalletLegacy/WalletLegacySerializer.cpp
  src/WalletLegacy/WalletLegacySerialization.cpp
  src/WalletLegacy/WalletTransactionSender.cpp
  src/WalletLegacy/WalletUnconfirmedTransactions.cpp
  src/WalletLegacy/WalletUserTransactionsCache.cpp
  
  # Wallet Core
  src/Wallet/LegacyKeysImporter.cpp
  src/Wallet/WalletAsyncContextCounter.cpp
  src/Wallet/WalletErrors.cpp
  
  # Transfers
  src/Transfers/BlockchainSynchronizer.cpp
  src/Transfers/SynchronizationState.cpp
  src/Transfers/TransfersConsumer.cpp
  src/Transfers/TransfersContainer.cpp
  src/Transfers/TransfersSubscription.cpp
  src/Transfers/TransfersSynchronizer.cpp
  
  # System
  src/System/ContextGroup.cpp
  src/System/Event.cpp
  src/System/EventLock.cpp
  src/System/InterruptedException.cpp
  src/System/Ipv4Address.cpp
  src/System/TcpStream.cpp
  
  # HTTP
  src/HTTP/HttpRequest.cpp
  src/HTTP/HttpParser.cpp
  src/HTTP/HttpParserErrorCodes.cpp
  src/HTTP/HttpResponse.cpp
  
  # RPC
  src/Rpc/HttpClient.cpp
  src/Rpc/JsonRpc.cpp
  
  # P2P
  src/P2p/NetNode.cpp
  src/P2p/LevinProtocol.cpp
  src/P2p/NetNodeConfig.cpp
  src/P2p/PeerListManager.cpp
  
  # CryptoNote Protocol
  src/CryptoNoteProtocol/CryptoNoteProtocolHandler.cpp
  
  # Logging
  src/Logging/ILogger.cpp
  src/Logging/LoggerGroup.cpp
  src/Logging/CommonLogger.cpp
  src/Logging/LoggerManager.cpp
  src/Logging/FileLogger.cpp
  src/Logging/StreamLogger.cpp
  src/Logging/ConsoleLogger.cpp
  src/Logging/LoggerMessage.cpp
  src/Logging/LoggerRef.cpp
  
  # Blockchain Explorer
  src/BlockchainExplorer/BlockchainExplorer.cpp
  src/BlockchainExplorer/BlockchainExplorerDataBuilder.cpp
  src/BlockchainExplorer/BlockchainExplorerErrors.cpp
  
  # Serialization
  src/Serialization/BinaryInputStreamSerializer.cpp
  src/Serialization/BinaryOutputStreamSerializer.cpp
  src/Serialization/JsonInputValueSerializer.cpp
  src/Serialization/JsonOutputStreamSerializer.cpp
  src/Serialization/KVBinaryInputStreamSerializer.cpp
  src/Serialization/KVBinaryOutputStreamSerializer.cpp
  src/Serialization/SerializationOverloads.cpp
  
  # InProcess Node
  src/InProcessNode/InProcessNode.cpp
  src/InProcessNode/InProcessNodeErrors.cpp
  
  # Node RPC Proxy
  src/NodeRpcProxy/NodeErrors.cpp
  src/NodeRpcProxy/NodeRpcProxy.cpp
  
  # P2P NetNode Config
  src/P2p/NetNodeConfig.cpp
)

# Platform-specific sources
if(UNIX)
  list(APPEND CRYPTONOTE_SOURCES
    src/external/miniupnpc/minissdpc.c
  )
endif()

# Create static library
add_library(cryptonote_tauri STATIC ${CRYPTONOTE_SOURCES})

# Compiler flags
if(MSVC)
  target_compile_definitions(cryptonote_tauri PRIVATE _CRT_SECURE_NO_WARNINGS _WIN32_WINNT=0x0600 STATICLIB)
else()
  target_compile_definitions(cryptonote_tauri PRIVATE _GNU_SOURCE)
endif()

# Link libraries
if(UNIX)
  target_link_libraries(cryptonote_tauri pthread resolv)
endif()

# Set output directory
set_target_properties(cryptonote_tauri PROPERTIES
  ARCHIVE_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/lib"
  LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/lib"
  RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
)

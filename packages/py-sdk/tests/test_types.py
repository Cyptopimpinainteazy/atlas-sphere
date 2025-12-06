"""Tests for Atlas Sphere SDK types."""

import pytest
from atlas_sphere_sdk.types import (
    AccountId,
    AssetId,
    ComitId,
    ComitPayload,
    ExecutionReceipt,
    ChainInfo,
    AccountInfo,
    BlockHeader,
    AtlasError,
    ConnectionError,
    AuthorizationError,
)


class TestAccountId:
    """Tests for AccountId type."""
    
    def test_from_ss58(self):
        """Test creating AccountId from SS58 address."""
        addr = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
        account = AccountId.from_ss58(addr)
        assert account.ss58 == addr
    
    def test_from_bytes(self):
        """Test creating AccountId from bytes."""
        data = bytes(32)
        account = AccountId.from_bytes(data)
        assert account.raw == data
    
    def test_str_representation(self):
        """Test string representation."""
        addr = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
        account = AccountId.from_ss58(addr)
        assert str(account) == addr


class TestComitPayload:
    """Tests for ComitPayload."""
    
    def test_create_evm_payload(self):
        """Test creating EVM payload."""
        payload = ComitPayload(
            evm_payload=b"\x01\x02\x03",
            evm_gas_limit=100_000,
            svm_payload=None,
            svm_compute_limit=0,
        )
        assert payload.evm_payload == b"\x01\x02\x03"
        assert payload.evm_gas_limit == 100_000
        assert payload.svm_payload is None
    
    def test_create_svm_payload(self):
        """Test creating SVM payload."""
        payload = ComitPayload(
            evm_payload=None,
            evm_gas_limit=0,
            svm_payload=b"\x04\x05\x06",
            svm_compute_limit=200_000,
        )
        assert payload.svm_payload == b"\x04\x05\x06"
        assert payload.svm_compute_limit == 200_000
    
    def test_create_dual_payload(self):
        """Test creating dual EVM+SVM payload."""
        payload = ComitPayload(
            evm_payload=b"\x01\x02\x03",
            evm_gas_limit=100_000,
            svm_payload=b"\x04\x05\x06",
            svm_compute_limit=200_000,
        )
        assert payload.evm_payload == b"\x01\x02\x03"
        assert payload.svm_payload == b"\x04\x05\x06"


class TestExecutionReceipt:
    """Tests for ExecutionReceipt."""
    
    def test_success_receipt(self):
        """Test successful execution receipt."""
        receipt = ExecutionReceipt(
            success=True,
            gas_used=50_000,
            return_data=b"\x00\x00\x00\x01",
            logs=[],
            error_message=None,
        )
        assert receipt.success is True
        assert receipt.gas_used == 50_000
        assert receipt.return_data == b"\x00\x00\x00\x01"
    
    def test_failure_receipt(self):
        """Test failed execution receipt."""
        receipt = ExecutionReceipt(
            success=False,
            gas_used=21_000,
            return_data=b"",
            logs=[],
            error_message="Out of gas",
        )
        assert receipt.success is False
        assert receipt.error_message == "Out of gas"


class TestChainInfo:
    """Tests for ChainInfo."""
    
    def test_chain_info(self):
        """Test ChainInfo creation."""
        info = ChainInfo(
            chain_name="Atlas Sphere Testnet",
            chain_id=42,
            token_symbol="ATLAS",
            token_decimals=18,
            ss58_format=42,
            genesis_hash="0x123abc...",
            best_number=1000,
            finalized_number=990,
        )
        assert info.chain_name == "Atlas Sphere Testnet"
        assert info.chain_id == 42
        assert info.token_decimals == 18


class TestAccountInfo:
    """Tests for AccountInfo."""
    
    def test_account_info(self):
        """Test AccountInfo creation."""
        info = AccountInfo(
            address="5GrwvaEF...",
            nonce=5,
            free_balance=1_000_000,
            reserved_balance=500_000,
            is_authorized=True,
        )
        assert info.nonce == 5
        assert info.free_balance == 1_000_000
        assert info.is_authorized is True


class TestBlockHeader:
    """Tests for BlockHeader."""
    
    def test_block_header(self):
        """Test BlockHeader creation."""
        header = BlockHeader(
            hash="0xabc123...",
            parent_hash="0xdef456...",
            number=100,
            state_root="0x111...",
            extrinsics_root="0x222...",
        )
        assert header.number == 100
        assert header.hash.startswith("0x")


class TestErrors:
    """Tests for error types."""
    
    def test_atlas_error(self):
        """Test AtlasError."""
        error = AtlasError("Something went wrong")
        assert str(error) == "Something went wrong"
    
    def test_connection_error(self):
        """Test ConnectionError inherits from AtlasError."""
        error = ConnectionError("Failed to connect")
        assert isinstance(error, AtlasError)
    
    def test_authorization_error(self):
        """Test AuthorizationError inherits from AtlasError."""
        error = AuthorizationError("Not authorized")
        assert isinstance(error, AtlasError)

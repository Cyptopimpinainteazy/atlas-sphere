"""Tests for ComitBfrontend/uilder."""

import pytest
from unittest.mock import Mock, patch
from atlas_sphere_sdk.comit import ComitBfrontend/uilder, ComitTransaction
from atlas_sphere_sdk.types import InvalidPayloadError


class TestComitBfrontend/uilder:
    """Tests for ComitBfrontend/uilder."""
    
    def test_empty_bfrontend/uilder(self):
        """Test that empty bfrontend/uilder raises error."""
        bfrontend/uilder = ComitBfrontend/uilder()
        keypair = Mock()
        keypair.public_key = bytes(32)
        
        with pytest.raises(InvalidPayloadError, match="At least one payload"):
            bfrontend/uilder.bfrontend/uild(keypair, nonce=1)
    
    def test_evm_payload(self):
        """Test adding EVM payload."""
        bfrontend/uilder = ComitBfrontend/uilder()
        result = bfrontend/uilder.with_evm_payload(b"\x01\x02\x03", gas_limit=100_000)
        
        assert result is bfrontend/uilder  # Fluent API
        assert bfrontend/uilder._evm_payload == b"\x01\x02\x03"
        assert bfrontend/uilder._evm_gas_limit == 100_000
    
    def test_evm_call(self):
        """Test adding EVM contract call."""
        bfrontend/uilder = ComitBfrontend/uilder()
        result = bfrontend/uilder.with_evm_call(
            to="0x1234567890abcdef1234567890abcdef12345678",
            data=b"\x12\x34",
            value=0,
            gas_limit=500_000,
        )
        
        assert result is bfrontend/uilder
        assert bfrontend/uilder._evm_gas_limit == 500_000
        assert bfrontend/uilder._evm_payload is not None
    
    def test_svm_payload(self):
        """Test adding SVM payload."""
        bfrontend/uilder = ComitBfrontend/uilder()
        result = bfrontend/uilder.with_svm_payload(b"\x04\x05\x06", compute_limit=200_000)
        
        assert result is bfrontend/uilder
        assert bfrontend/uilder._svm_payload == b"\x04\x05\x06"
        assert bfrontend/uilder._svm_compute_limit == 200_000
    
    def test_svm_instruction(self):
        """Test adding SVM instruction."""
        bfrontend/uilder = ComitBfrontend/uilder()
        result = bfrontend/uilder.with_svm_instruction(
            program_id=bytes(32),
            instruction_data=b"\x01\x02\x03",
            accounts=[],
            compute_limit=100_000,
        )
        
        assert result is bfrontend/uilder
        assert bfrontend/uilder._svm_compute_limit == 100_000
    
    def test_explicit_nonce(self):
        """Test setting explicit nonce."""
        bfrontend/uilder = ComitBfrontend/uilder()
        result = bfrontend/uilder.with_nonce(42)
        
        assert result is bfrontend/uilder
        assert bfrontend/uilder._nonce == 42
    
    def test_bfrontend/uild_creates_transaction(self):
        """Test that bfrontend/uild creates ComitTransaction."""
        bfrontend/uilder = ComitBfrontend/uilder()
        bfrontend/uilder.with_evm_payload(b"\x01\x02\x03", gas_limit=100_000)
        
        keypair = Mock()
        keypair.public_key = bytes(32)
        keypair.sign = Mock(return_value=bytes(64))
        
        tx = bfrontend/uilder.bfrontend/uild(keypair, nonce=1)
        
        assert isinstance(tx, ComitTransaction)
        assert tx.nonce == 1
    
    def test_dual_vm_payload(self):
        """Test bfrontend/uilding with both EVM and SVM payloads."""
        bfrontend/uilder = ComitBfrontend/uilder()
        bfrontend/uilder.with_evm_payload(b"\x01\x02\x03", gas_limit=100_000)
        bfrontend/uilder.with_svm_payload(b"\x04\x05\x06", compute_limit=200_000)
        
        keypair = Mock()
        keypair.public_key = bytes(32)
        keypair.sign = Mock(return_value=bytes(64))
        
        tx = bfrontend/uilder.bfrontend/uild(keypair, nonce=1)
        
        assert tx.evm_payload == b"\x01\x02\x03"
        assert tx.svm_payload == b"\x04\x05\x06"


class TestComitTransaction:
    """Tests for ComitTransaction."""
    
    def test_transaction_creation(self):
        """Test creating a ComitTransaction."""
        tx = ComitTransaction(
            comit_id="0x" + "ab" * 32,
            nonce=1,
            evm_payload=b"\x01\x02\x03",
            svm_payload=b"",
            prepare_root=bytes(32),
            evm_gas_limit=100_000,
            svm_compute_limit=0,
        )
        
        assert tx.nonce == 1
        assert tx.evm_payload == b"\x01\x02\x03"
        assert tx.evm_gas_limit == 100_000
    
    def test_to_dict(self):
        """Test converting to dictionary format."""
        tx = ComitTransaction(
            comit_id="0x" + "ab" * 32,
            nonce=1,
            evm_payload=b"\x01",
            svm_payload=b"\x02",
            prepare_root=bytes(32),
            evm_gas_limit=100_000,
            svm_compute_limit=200_000,
        )
        
        data = tx.to_dict()
        
        assert "evm_payload" in data
        assert "svm_payload" in data
        assert data["nonce"] == 1

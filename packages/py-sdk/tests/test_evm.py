"""Tests for EVM client."""

import pytest
from atlas_sphere_sdk.evm import EvmClient, EvmTransaction, encode_function_call


class TestEvmClient:
    """Tests for EvmClient."""
    
    def test_init(self, mock_client):
        """Test EvmClient initialization."""
        evm = EvmClient(mock_client)
        assert evm._client is mock_client
    
    def test_build_contract_call(self, mock_client):
        """Test building a contract call."""
        evm = EvmClient(mock_client)
        
        tx = evm.build_contract_call(
            to="0x1234567890abcdef1234567890abcdef12345678",
            function_signature="transfer(address,uint256)",
            "0x" + "ab" * 20,
            1000,
        )
        
        assert isinstance(tx, EvmTransaction)
        assert tx.to == "0x1234567890abcdef1234567890abcdef12345678"
        assert tx.data is not None


class TestEvmTransaction:
    """Tests for EvmTransaction."""
    
    def test_transaction_creation(self):
        """Test creating an EVM transaction."""
        tx = EvmTransaction(
            to="0x1234567890abcdef1234567890abcdef12345678",
            value=0,
            data=b"\x12\x34\x56\x78",
            gas_limit=100_000,
        )
        
        assert tx.to == "0x1234567890abcdef1234567890abcdef12345678"
        assert tx.value == 0
        assert tx.gas_limit == 100_000
    
    def test_to_payload_dict(self):
        """Test converting to payload dictionary."""
        tx = EvmTransaction(
            to="0x1234567890abcdef1234567890abcdef12345678",
            value=1000,
            data=b"\xab\xcd",
            gas_limit=50_000,
        )
        
        payload = tx.to_payload()
        
        assert payload["to"] == "0x1234567890abcdef1234567890abcdef12345678"
        assert payload["value"] == 1000
        assert payload["gas_limit"] == 50_000


class TestEncodeFunctionCall:
    """Tests for function call encoding."""
    
    def test_encode_simple_function(self):
        """Test encoding a simple function call."""
        data = encode_function_call(
            "balanceOf(address)",
            "0x" + "ab" * 20,
        )
        
        assert isinstance(data, bytes)
        assert len(data) >= 4  # At least the selector
    
    def test_encode_with_multiple_args(self):
        """Test encoding with multiple arguments."""
        data = encode_function_call(
            "transfer(address,uint256)",
            "0x" + "ab" * 20,
            1000,
        )
        
        assert isinstance(data, bytes)
        # 4 bytes selector + 32 bytes address + 32 bytes uint256
        assert len(data) == 4 + 32 + 32

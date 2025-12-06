"""Tests for SVM client."""

import pytest
from atlas_sphere_sdk.svm import SvmClient, SvmInstruction, SvmAccount


class TestSvmClient:
    """Tests for SvmClient."""
    
    def test_init(self, mock_client):
        """Test SvmClient initialization."""
        svm = SvmClient(mock_client)
        assert svm._client is mock_client
    
    def test_build_instruction(self, mock_client):
        """Test building an instruction."""
        svm = SvmClient(mock_client)
        
        instruction = svm.build_instruction(
            program_id=bytes(32),
            data=b"\x01\x02\x03",
            accounts=[],
        )
        
        assert isinstance(instruction, SvmInstruction)
        assert instruction.program_id == bytes(32)
        assert instruction.data == b"\x01\x02\x03"
    
    def test_build_transfer(self, mock_client):
        """Test building a transfer instruction."""
        svm = SvmClient(mock_client)
        
        # System program ID (11111111111111111111111111111111)
        instruction = svm.build_transfer(
            from_pubkey=bytes(32),
            to_pubkey=bytes(32),
            lamports=1_000_000,
        )
        
        assert isinstance(instruction, SvmInstruction)
        assert len(instruction.accounts) == 2


class TestSvmInstruction:
    """Tests for SvmInstruction."""
    
    def test_instruction_creation(self):
        """Test creating an SVM instruction."""
        instruction = SvmInstruction(
            program_id=bytes(32),
            accounts=[],
            data=b"\x01\x02\x03",
        )
        
        assert instruction.program_id == bytes(32)
        assert instruction.data == b"\x01\x02\x03"
        assert instruction.accounts == []
    
    def test_instruction_with_accounts(self):
        """Test instruction with accounts."""
        accounts = [
            SvmAccount(pubkey=bytes(32), is_signer=True, is_writable=True),
            SvmAccount(pubkey=bytes(32), is_signer=False, is_writable=True),
        ]
        
        instruction = SvmInstruction(
            program_id=bytes(32),
            accounts=accounts,
            data=b"\x00",
        )
        
        assert len(instruction.accounts) == 2
        assert instruction.accounts[0].is_signer is True
        assert instruction.accounts[1].is_signer is False
    
    def test_to_payload(self):
        """Test converting to payload."""
        instruction = SvmInstruction(
            program_id=bytes(32),
            accounts=[],
            data=b"\x01\x02\x03",
        )
        
        payload = instruction.to_payload()
        
        assert "program_id" in payload
        assert "accounts" in payload
        assert "data" in payload


class TestSvmAccount:
    """Tests for SvmAccount."""
    
    def test_account_creation(self):
        """Test creating an SVM account."""
        account = SvmAccount(
            pubkey=bytes(32),
            is_signer=True,
            is_writable=True,
        )
        
        assert account.pubkey == bytes(32)
        assert account.is_signer is True
        assert account.is_writable is True
    
    def test_readonly_account(self):
        """Test read-only account."""
        account = SvmAccount(
            pubkey=bytes(32),
            is_signer=False,
            is_writable=False,
        )
        
        assert account.is_signer is False
        assert account.is_writable is False
    
    def test_to_dict(self):
        """Test converting to dictionary."""
        account = SvmAccount(
            pubkey=bytes(32),
            is_signer=True,
            is_writable=False,
        )
        
        d = account.to_dict()
        
        assert "pubkey" in d
        assert d["is_signer"] is True
        assert d["is_writable"] is False

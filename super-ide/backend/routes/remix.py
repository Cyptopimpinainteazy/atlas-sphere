"""
Remix — Solidity compilation and deployment endpoints.
Uses solcjs for compilation (or calls out to solc binary).
"""

import os
import json
import logging
import subprocess
import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger("remix")


class CompileRequest(BaseModel):
    source: str
    version: str = "0.8.24"
    optimize: bool = False
    runs: int = 200


class DeployRequest(BaseModel):
    abi: list = []
    bytecode: str = ""
    constructorArgs: list = []
    environment: str = "js-vm"
    rpcUrl: str = ""


@router.post("/compile")
async def compile_solidity(req: CompileRequest):
    """Compile Solidity source code."""
    # Try using solc if available, otherwise provide a simulated response
    try:
        # Write source to temp file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".sol", delete=False) as f:
            f.write(req.source)
            temp_path = f.name

        # Build solc input JSON
        solc_input = {
            "language": "Solidity",
            "sources": {"contract.sol": {"content": req.source}},
            "settings": {
                "optimizer": {"enabled": req.optimize, "runs": req.runs},
                "outputSelection": {
                    "*": {"*": ["abi", "evm.bytecode", "evm.deployedBytecode"]}
                },
            },
        }

        # Try running solc
        result = subprocess.run(
            ["solc", "--standard-json"],
            input=json.dumps(solc_input),
            capture_output=True,
            text=True,
            timeout=30,
        )

        os.unlink(temp_path)

        if result.returncode == 0:
            output = json.loads(result.stdout)
            errors = output.get("errors", [])
            contracts = {}

            for source_name, source_contracts in output.get("contracts", {}).items():
                for name, contract in source_contracts.items():
                    contracts[name] = {
                        "abi": contract.get("abi", []),
                        "bytecode": contract.get("evm", {}).get("bytecode", {}).get("object", ""),
                    }

            return {
                "success": len([e for e in errors if e.get("severity") == "error"]) == 0,
                "contracts": contracts,
                "errors": [
                    {
                        "severity": e.get("severity", "warning"),
                        "message": e.get("formattedMessage", e.get("message", "")),
                    }
                    for e in errors
                ],
            }
        else:
            return {
                "success": False,
                "contracts": {},
                "errors": [{"severity": "error", "message": result.stderr or "Compilation failed"}],
            }

    except FileNotFoundError:
        # solc not installed — provide helpful message
        logger.info("solc not found, returning guidance")
        return {
            "success": False,
            "contracts": {},
            "errors": [
                {
                    "severity": "warning",
                    "message": (
                        "Solidity compiler (solc) not found on PATH. "
                        "Install it via: npm install -g solc, or download from "
                        "https://docs.soliditylang.org/en/latest/installing-solidity.html"
                    ),
                }
            ],
        }
    except Exception as e:
        return {
            "success": False,
            "contracts": {},
            "errors": [{"severity": "error", "message": str(e)}],
        }


@router.post("/deploy")
async def deploy_contract(req: DeployRequest):
    """Deploy a compiled contract (stub — requires web3 integration)."""
    if req.environment == "js-vm":
        # Simulated deployment
        import hashlib
        fake_addr = "0x" + hashlib.sha256(req.bytecode[:20].encode()).hexdigest()[:40]
        return {
            "success": True,
            "address": fake_addr,
            "transactionHash": "0x" + hashlib.sha256(fake_addr.encode()).hexdigest()[:64],
            "environment": "JavaScript VM (simulated)",
        }
    else:
        return {
            "success": False,
            "error": f"Environment '{req.environment}' not yet supported in backend. Use the frontend for MetaMask/RPC deployment.",
        }

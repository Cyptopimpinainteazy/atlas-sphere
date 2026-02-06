"""
Atlas Sphere Python SDK

A comprehensive SDK for interacting with the Atlas Sphere blockchain,
featuring dual-VM execution (EVM + SVM) through the Atlas Kernel.
"""

from atlas_sphere_sdk.client import AtlasClient
from atlas_sphere_sdk.comit import ComitBfrontend/uilder, ComitTransaction
from atlas_sphere_sdk.query import QueryClient
from atlas_sphere_sdk.evm import EvmClient
from atlas_sphere_sdk.svm import SvmClient
from atlas_sphere_sdk.types import (
    AccountId,
    AssetId,
    Balance,
    ComitId,
    ExecutionReceipt,
)

__version__ = "0.1.0"
__all__ = [
    "AtlasClient",
    "ComitBfrontend/uilder",
    "ComitTransaction",
    "QueryClient",
    "EvmClient",
    "SvmClient",
    "AccountId",
    "AssetId",
    "Balance",
    "ComitId",
    "ExecutionReceipt",
]

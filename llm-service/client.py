"""
Substreams Skills LLM Client for Python
Simple interface for querying Substreams skills via HTTP
"""

import requests
import json
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from enum import Enum
import time


class Provider(Enum):
    """Available LLM providers"""
    OLLAMA = "ollama"
    OPENROUTER = "openrouter"


class SkillCategory(Enum):
    """Available Substreams skill categories"""
    DEVELOPMENT = "substreams-dev"
    SQL = "substreams-sql"
    TESTING = "substreams-testing"
    SINKS = "substreams-sink"
    RUST = "rust-expert"


@dataclass
class QueryResponse:
    """Response from LLM query"""
    provider: str
    model: str
    response: str
    response_time: int
    token_estimate: int
    success: bool
    metadata: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

    @classmethod
    def from_json(cls, data: Dict[str, Any]) -> 'QueryResponse':
        """Create from JSON response"""
        return cls(
            provider=data.get('provider'),
            model=data.get('model'),
            response=data.get('response', ''),
            response_time=data.get('responseTime', 0),
            token_estimate=data.get('tokenEstimate', 0),
            success=data.get('success', False),
            metadata=data.get('metadata'),
            error=data.get('error'),
        )

    def __str__(self) -> str:
        return self.response


class SubstreamsSkillsClient:
    """Client for querying Substreams skills via LLM router"""

    def __init__(
        self,
        endpoint: str = "http://localhost:3000",
        default_provider: str = "ollama",
        default_model: Optional[str] = None,
        timeout: int = 30,
    ):
        """
        Initialize the client

        Args:
            endpoint: URL of the LLM router service
            default_provider: Default provider (ollama or openrouter)
            default_model: Default model to use
            timeout: Request timeout in seconds
        """
        self.endpoint = endpoint.rstrip('/')
        self.default_provider = default_provider
        self.default_model = default_model
        self.timeout = timeout
        self.session = requests.Session()

    def _request(
        self,
        method: str,
        path: str,
        **kwargs
    ) -> Dict[str, Any]:
        """Make HTTP request to router"""
        url = f"{self.endpoint}{path}"
        kwargs.setdefault('timeout', self.timeout)

        try:
            response = self.session.request(method, url, **kwargs)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"Request error: {e}")
        except json.JSONDecodeError as e:
            raise RuntimeError(f"Invalid JSON response: {e}")

    def query(
        self,
        query: str,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        use_failover: bool = False,
    ) -> QueryResponse:
        """
        Query the LLM directly

        Args:
            query: The prompt/query text
            provider: Provider to use (overrides default)
            model: Model to use (overrides default)
            temperature: Sampling temperature
            use_failover: Use failover chain if provider fails

        Returns:
            QueryResponse with the model's response
        """
        payload = {
            "query": query,
            "provider": provider or self.default_provider,
            "model": model or self.default_model,
            "temperature": temperature,
            "use_failover": use_failover,
        }

        data = self._request(
            'POST',
            '/query',
            json=payload,
            headers={'Content-Type': 'application/json'},
        )

        return QueryResponse.from_json(data)

    def query_skill(
        self,
        skill: str,
        question: str,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
    ) -> QueryResponse:
        """
        Query a specific Substreams skill

        Args:
            skill: Skill name (substreams-dev, substreams-sql, etc.)
            question: The question to ask
            provider: Provider to use (overrides default)
            model: Model to use (overrides default)
            temperature: Sampling temperature

        Returns:
            QueryResponse with the model's response
        """
        payload = {
            "question": question,
            "provider": provider or self.default_provider,
            "model": model or self.default_model,
            "temperature": temperature,
        }

        data = self._request(
            'POST',
            f'/skill/{skill}',
            json=payload,
            headers={'Content-Type': 'application/json'},
        )

        return QueryResponse.from_json(data)

    # Skill-specific methods
    def ask_development(
        self,
        question: str,
        **kwargs
    ) -> QueryResponse:
        """Ask about Substreams development"""
        return self.query_skill(SkillCategory.DEVELOPMENT.value, question, **kwargs)

    def ask_sql(
        self,
        question: str,
        **kwargs
    ) -> QueryResponse:
        """Ask about SQL database sinks"""
        return self.query_skill(SkillCategory.SQL.value, question, **kwargs)

    def ask_testing(
        self,
        question: str,
        **kwargs
    ) -> QueryResponse:
        """Ask about testing strategies"""
        return self.query_skill(SkillCategory.TESTING.value, question, **kwargs)

    def ask_sinks(
        self,
        question: str,
        **kwargs
    ) -> QueryResponse:
        """Ask about building sinks"""
        return self.query_skill(SkillCategory.SINKS.value, question, **kwargs)

    def ask_rust(
        self,
        question: str,
        **kwargs
    ) -> QueryResponse:
        """Ask about Rust programming"""
        return self.query_skill(SkillCategory.RUST.value, question, **kwargs)

    def get_health(self) -> Dict[str, Any]:
        """Get health status of router and providers"""
        return self._request('GET', '/health')

    def get_models(self) -> Dict[str, Any]:
        """Get available models and providers"""
        return self._request('GET', '/models')

    def get_metrics(self) -> Dict[str, Any]:
        """Get metrics and statistics"""
        return self._request('GET', '/metrics')

    def compare_providers(
        self,
        query: str,
        providers: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Compare responses from multiple providers

        Args:
            query: The query to compare
            providers: List of provider names to compare

        Returns:
            Dict mapping provider names to responses
        """
        if providers is None:
            providers = [Provider.OLLAMA.value, Provider.OPENROUTER.value]

        results = {}
        for provider in providers:
            try:
                result = self.query(query, provider=provider)
                results[provider] = {
                    'success': True,
                    'response': result.response,
                    'response_time': result.response_time,
                }
            except Exception as e:
                results[provider] = {
                    'success': False,
                    'error': str(e),
                }

        return results


class SubstreamsSkillsAssistant:
    """High-level assistant for Substreams development"""

    def __init__(self, client: Optional[SubstreamsSkillsClient] = None):
        """
        Initialize the assistant

        Args:
            client: SubstreamsSkillsClient instance
        """
        self.client = client or SubstreamsSkillsClient()

    def help_with_manifest(self, question: str) -> str:
        """Get help with substreams.yaml manifest"""
        response = self.client.ask_development(
            f"Help me with substreams.yaml configuration: {question}"
        )
        return str(response)

    def help_with_rust_module(self, question: str) -> str:
        """Get help with Rust module implementation"""
        response = self.client.ask_rust(question)
        return str(response)

    def help_with_protobuf(self, question: str) -> str:
        """Get help with protobuf schema design"""
        response = self.client.ask_development(
            f"Help me design protobuf schema: {question}"
        )
        return str(response)

    def help_with_sql_sink(self, question: str) -> str:
        """Get help with SQL sink implementation"""
        response = self.client.ask_sql(question)
        return str(response)

    def help_with_testing(self, question: str) -> str:
        """Get help with Substreams testing"""
        response = self.client.ask_testing(question)
        return str(response)

    def compare_models(self, question: str) -> Dict[str, str]:
        """Compare responses from different models"""
        comparison = self.client.compare_providers(question)
        return {
            provider: result.get('response', result.get('error', ''))
            for provider, result in comparison.items()
        }


# Example usage and CLI
if __name__ == '__main__':
    import sys

    def main():
        """Command-line interface"""
        client = SubstreamsSkillsClient()

        # Check health
        try:
            health = client.get_health()
            print(f"✓ Router healthy: {health['status']}")
        except Exception as e:
            print(f"✗ Router error: {e}")
            sys.exit(1)

        # Get models
        models = client.get_models()
        print(f"\nAvailable providers: {list(models.keys())}")

        # Example queries
        examples = [
            ("Ask about Substreams development", "substreams-dev",
             "What is a map module and how does it work?"),
            ("Ask about SQL sinks", "substreams-sql",
             "How do I set up a PostgreSQL sink?"),
            ("Ask about testing", "substreams-testing",
             "How do I unit test a Substreams module?"),
        ]

        print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

        for title, skill, question in examples:
            print(f"\n{title}:")
            print(f"Q: {question}")

            try:
                response = client.query_skill(skill, question)
                print(f"Provider: {response.provider}/{response.model}")
                print(f"Time: {response.response_time}ms")
                print(f"\nA: {response.response[:500]}...\n")
            except Exception as e:
                print(f"Error: {e}\n")

        # Comparison example
        print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print("\nComparing providers:")
        test_query = "What is a Substreams index module?"

        comparison = client.compare_providers(test_query)
        for provider, result in comparison.items():
            status = "✓" if result['success'] else "✗"
            print(f"{status} {provider}: {result.get('response_time', 'Error')}ms")

    main()

#!/usr/bin/env python3
"""
LLM Reconnaissance Tool - Enhanced Version
Advanced features for comprehensive LLM endpoint discovery
"""

import asyncio
import aiohttp
import json
import time
import socket
import ipaddress
import concurrent.futures
from typing import Dict, List, Optional, Tuple, Set
from dataclasses import dataclass, asdict
from enum import Enum
import re
import urllib.parse
from datetime import datetime
import hashlib

class LLMProvider(Enum):
    OPENAI_COMPATIBLE = "openai_compatible"
    OLLAMA = "ollama"
    LM_STUDIO = "lm_studio"
    ANTHROPIC = "anthropic"
    HUGGINGFACE = "huggingface"
    TOGETHER_AI = "together_ai"
    REPLICATE = "replicate"
    TEXT_GENERATION_WEBUI = "text_generation_webui"
    KOBOLDAI = "koboldai"
    VLLM = "vllm"
    FASTCHAT = "fastchat"
    PETALS = "petals"
    LOCALAI = "localai"
    GPT4ALL = "gpt4all"

@dataclass
class EndpointResult:
    url: str
    provider: LLMProvider
    port: int
    is_accessible: bool
    response_time: float
    status_code: Optional[int]
    server_header: Optional[str]
    content_type: Optional[str]
    api_version: Optional[str]
    models_available: List[str] = None
    auth_required: bool = False
    vulnerabilities: List[str] = None
    fingerprint: Dict = None
    last_seen: str = None

    def __post_init__(self):
        if self.models_available is None:
            self.models_available = []
        if self.vulnerabilities is None:
            self.vulnerabilities = []
        if self.fingerprint is None:
            self.fingerprint = {}
        if self.last_seen is None:
            self.last_seen = datetime.now().isoformat()

@dataclass
class ScanResult:
    target: str
    scan_start: str
    scan_end: str
    total_targets: int
    endpoints_found: List[EndpointResult]
    search_queries: Dict[str, List[str]]
    statistics: Dict
    recommendations: List[str]

class EnhancedLLMRecon:
    def __init__(self, max_concurrent: int = 50, timeout: int = 10):
        self.max_concurrent = max_concurrent
        self.timeout = timeout
        self.session = None

        # Enhanced port list with more LLM services
        self.llm_ports = {
            11434: [LLMProvider.OLLAMA],
            1234: [LLMProvider.LM_STUDIO],
            8000: [LLMProvider.OPENAI_COMPATIBLE, LLMProvider.VLLM, LLMProvider.FASTCHAT],
            8080: [LLMProvider.OPENAI_COMPATIBLE, LLMProvider.HUGGINGFACE],
            3000: [LLMProvider.OPENAI_COMPATIBLE],
            5000: [LLMProvider.KOBOLDAI, LLMProvider.PETALS],
            5001: [LLMProvider.KOBOLDAI],
            7860: [LLMProvider.TEXT_GENERATION_WEBUI, LLMProvider.HUGGINGFACE],
            8501: [LLMProvider.STREAMLIT],  # For some LLM web UIs
            9090: [LLMProvider.GPT4ALL],
            21001: [LLMProvider.FASTCHAT],
            4000: [LLMProvider.LOCALAI]
        }

        # Enhanced endpoint detection
        self.provider_endpoints = {
            LLMProvider.OLLAMA: [
                "/api/tags", "/api/version", "/api/ps",
                "/v1/models", "/v1/chat/completions"
            ],
            LLMProvider.LM_STUDIO: [
                "/v1/models", "/v1/chat/completions", "/health"
            ],
            LLMProvider.OPENAI_COMPATIBLE: [
                "/v1/models", "/v1/chat/completions", "/v1/completions",
                "/v1/embeddings", "/v1/images/generations", "/health"
            ],
            LLMProvider.TEXT_GENERATION_WEBUI: [
                "/api/v1/model", "/api/v1/generate", "/api/v1/chat",
                "/api/v1/token-count"
            ],
            LLMProvider.KOBOLDAI: [
                "/api/v1/model", "/api/v1/generate", "/api/v1/chat"
            ],
            LLMProvider.VLLM: [
                "/v1/models", "/v1/chat/completions", "/health", "/v1/completions"
            ],
            LLMProvider.FASTCHAT: [
                "/v1/models", "/v1/chat/completions", "/worker_get_status"
            ]
        }

        # Vulnerability patterns
        self.vuln_patterns = {
            "open_access": "No authentication required",
            "info_disclosure": ["api_key", "secret", "password", "token", "key"],
            "default_creds": ["admin/admin", "user/pass", "root/root"],
            "exposed_models": "model list accessible",
            "rate_limit_bypass": "unlimited requests",
            "prompt_injection": "system prompt leak"
        }

    async def init_session(self):
        """Initialize aiohttp session"""
        if self.session is None:
            self.session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=self.timeout),
                headers={
                    'User-Agent': 'LLM-Recon-Educational/2.0 (Research Only)'
                }
            )

    async def close_session(self):
        """Close aiohttp session"""
        if self.session:
            await self.session.close()

    async def test_endpoint_async(self, base_url: str, endpoint: str, provider: LLMProvider) -> Optional[EndpointResult]:
        """Async endpoint testing with enhanced fingerprinting"""
        await self.init_session()

        try:
            url = urllib.parse.urljoin(base_url, endpoint)
            start_time = time.time()

            async with self.session.get(url) as response:
                response_time = time.time() - start_time
                content = await response.text()

                # Enhanced fingerprinting
                fingerprint = self._fingerprint_response(content, response.headers)

                # Check for models
                models = self._extract_models(content, provider)

                # Vulnerability assessment
                vulnerabilities = self._check_vulnerabilities(content, response.headers, response.status)

                result = EndpointResult(
                    url=url,
                    provider=provider,
                    port=int(base_url.split(':')[-1]),
                    is_accessible=response.status < 400,
                    response_time=round(response_time, 3),
                    status_code=response.status,
                    server_header=response.headers.get('server'),
                    content_type=response.headers.get('content-type'),
                    api_version=self._extract_api_version(content),
                    models_available=models,
                    auth_required=self._check_auth_required(response.status, content),
                    vulnerabilities=vulnerabilities,
                    fingerprint=fingerprint
                )

                return result

        except Exception as e:
            return EndpointResult(
                url=urllib.parse.urljoin(base_url, endpoint),
                provider=provider,
                port=int(base_url.split(':')[-1]),
                is_accessible=False,
                response_time=self.timeout,
                status_code=None,
                server_header=None,
                content_type=None,
                vulnerabilities=["connection_error"]
            )

    def _fingerprint_response(self, content: str, headers: Dict) -> Dict:
        """Advanced response fingerprinting"""
        fingerprint = {
            "content_hash": hashlib.md5(content.encode()).hexdigest()[:8],
            "content_length": len(content),
            "has_json": "{" in content and "}" in content,
            "has_html": "<html" in content.lower(),
            "server_type": headers.get('server', 'unknown'),
            "powered_by": headers.get('x-powered-by', 'unknown')
        }

        # Detect specific LLM signatures
        if "ollama" in content.lower():
            fingerprint["llm_signature"] = "ollama"
        elif "lm-studio" in content.lower():
            fingerprint["llm_signature"] = "lm-studio"
        elif "text-generation-webui" in content.lower():
            fingerprint["llm_signature"] = "text-generation-webui"

        return fingerprint

    def _extract_models(self, content: str, provider: LLMProvider) -> List[str]:
        """Extract available models from API responses"""
        models = []

        try:
            if provider == LLMProvider.OLLAMA:
                data = json.loads(content)
                if "models" in data:
                    models = [m.get("name", "") for m in data["models"]]

            elif provider in [LLMProvider.OPENAI_COMPATIBLE, LLMProvider.LM_STUDIO, LLMProvider.VLLM]:
                data = json.loads(content)
                if "data" in data:
                    models = [m.get("id", "") for m in data["data"]]

        except (json.JSONDecodeError, KeyError):
            pass

        return models

    def _extract_api_version(self, content: str) -> Optional[str]:
        """Extract API version from response"""
        try:
            data = json.loads(content)
            return data.get("version") or data.get("api_version")
        except:
            return None

    def _check_auth_required(self, status: int, content: str) -> bool:
        """Check if authentication is required"""
        if status == 401:
            return True
        if "unauthorized" in content.lower() or "authentication" in content.lower():
            return True
        return False

    def _check_vulnerabilities(self, content: str, headers: Dict, status: int) -> List[str]:
        """Comprehensive vulnerability assessment"""
        vulnerabilities = []

        # Check for open access
        if status < 400 and not self._check_auth_required(status, content):
            vulnerabilities.append("open_access")

        # Check for information disclosure
        content_lower = content.lower()
        for pattern in self.vuln_patterns["info_disclosure"]:
            if pattern in content_lower:
                vulnerabilities.append("info_disclosure")
                break

        # Check for exposed model information
        if "model" in content_lower and ("id" in content_lower or "name" in content_lower):
            vulnerabilities.append("exposed_models")

        return vulnerabilities

    async def scan_target_async(self, target: str) -> ScanResult:
        """Async scanning of target with enhanced features"""
        scan_start = datetime.now().isoformat()

        # Parse target (IP, range, or domain)
        targets = self._parse_targets(target)

        print(f"🔍 Enhanced LLM Reconnaissance on: {target}")
        print(f"📊 Total targets to scan: {len(targets)}")

        all_endpoints = []
        tasks = []

        # Create tasks for all target-port combinations
        for ip in targets:
            for port, providers in self.llm_ports.items():
                base_url = f"http://{ip}:{port}"
                for provider in providers:
                    for endpoint in self.provider_endpoints.get(provider, []):
                        tasks.append(self.test_endpoint_async(base_url, endpoint, provider))

        # Execute with concurrency control
        semaphore = asyncio.Semaphore(self.max_concurrent)

        async def limited_task(task):
            async with semaphore:
                return await task

        # Run all tasks concurrently
        results = await asyncio.gather(*[limited_task(task) for task in tasks], return_exceptions=True)

        # Process results
        for result in results:
            if isinstance(result, EndpointResult) and result.is_accessible:
                all_endpoints.append(result)

        # Remove duplicates (same URL)
        unique_endpoints = self._deduplicate_endpoints(all_endpoints)

        scan_end = datetime.now().isoformat()

        # Generate statistics
        stats = self._generate_statistics(unique_endpoints, len(targets))

        # Generate search queries
        search_queries = self._generate_search_queries(target)

        # Generate recommendations
        recommendations = self._generate_recommendations(unique_endpoints)

        return ScanResult(
            target=target,
            scan_start=scan_start,
            scan_end=scan_end,
            total_targets=len(targets),
            endpoints_found=unique_endpoints,
            search_queries=search_queries,
            statistics=stats,
            recommendations=recommendations
        )

    def _parse_targets(self, target: str) -> List[str]:
        """Parse target specification into IP list"""
        targets = []

        try:
            # Handle CIDR notation
            if "/" in target:
                network = ipaddress.ip_network(target, strict=False)
                targets = [str(ip) for ip in network.hosts()]
                # Limit to reasonable size for demo
                targets = targets[:100]
            else:
                # Single IP or domain
                targets = [target]
        except:
            # Fallback to single target
            targets = [target]

        return targets

    def _deduplicate_endpoints(self, endpoints: List[EndpointResult]) -> List[EndpointResult]:
        """Remove duplicate endpoints"""
        seen = set()
        unique = []

        for endpoint in endpoints:
            key = (endpoint.url, endpoint.provider)
            if key not in seen:
                seen.add(key)
                unique.append(endpoint)

        return unique

    def _generate_statistics(self, endpoints: List[EndpointResult], total_targets: int) -> Dict:
        """Generate comprehensive statistics"""
        provider_count = {}
        port_count = {}
        vuln_count = {}

        for endpoint in endpoints:
            provider_count[endpoint.provider.value] = provider_count.get(endpoint.provider.value, 0) + 1
            port_count[endpoint.port] = port_count.get(endpoint.port, 0) + 1

            for vuln in endpoint.vulnerabilities:
                vuln_count[vuln] = vuln_count.get(vuln, 0) + 1

        return {
            "total_endpoints_found": len(endpoints),
            "total_targets_scanned": total_targets,
            "providers_found": provider_count,
            "ports_found": port_count,
            "vulnerabilities_found": vuln_count,
            "success_rate": len(endpoints) / max(total_targets * len(self.llm_ports), 1)
        }

    def _generate_search_queries(self, target: str) -> Dict[str, List[str]]:
        """Generate search queries for different engines"""
        return {
            "censys": [
                f'port:11434 {target}',
                f'port:1234 {target}',
                f'port:8000 "/v1/chat/completions" {target}',
                f'port:7860 "text-generation-webui" {target}'
            ],
            "zoomeye": [
                f'port:11434 {target}',
                f'port:1234 {target}',
                f'app:"ollama" {target}'
            ],
            "shodan": [
                f'port:11434 {target}',
                f'port:1234 {target}',
                f'port:8000 {target} "/v1/chat/completions"'
            ],
            "google_dorks": [
                f'inurl:":11434" {target} -github',
                f'inurl:":1234" {target} -github',
                f'inurl:"/api" "ollama" {target}',
                f'inurl:".env" "OPENAI_API_KEY" {target} -github'
            ]
        }

    def _generate_recommendations(self, endpoints: List[EndpointResult]) -> List[str]:
        """Generate security recommendations based on findings"""
        recommendations = [
            "Always obtain explicit permission before scanning systems",
            "Use responsible disclosure practices for any findings",
            "Implement proper authentication and access controls",
            "Regular security audits of exposed services",
            "Monitor access logs for unauthorized usage"
        ]

        # Add specific recommendations based on findings
        vuln_types = set()
        for endpoint in endpoints:
            vuln_types.update(endpoint.vulnerabilities)

        if "open_access" in vuln_types:
            recommendations.append("CRITICAL: Found endpoints with no authentication - implement API keys immediately")

        if "info_disclosure" in vuln_types:
            recommendations.append("WARNING: Sensitive information may be exposed - review API responses")

        if "exposed_models" in vuln_types:
            recommendations.append("Model information is publicly accessible - consider restricting this endpoint")

        return recommendations

    def generate_html_report(self, result: ScanResult) -> str:
        """Generate enhanced HTML report"""
        html = f"""
<!DOCTYPE html>
<html>
<head>
    <title>Enhanced LLM Reconnaissance Report</title>
    <style>
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }}
        .container {{ max-width: 1200px; margin: 0 auto; background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }}
        .stats {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; padding: 20px; }}
        .stat-card {{ background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #667eea; }}
        .endpoint {{ background: #e8f4f8; margin: 10px; padding: 20px; border-radius: 8px; border-left: 4px solid #17a2b8; }}
        .vulnerability {{ background: #ffe8e8; border-left: 4px solid #dc3545; padding: 15px; margin: 10px 0; border-radius: 5px; }}
        .safe {{ background: #e8ffe8; border-left: 4px solid #28a745; padding: 15px; margin: 10px 0; border-radius: 5px; }}
        .search-queries {{ background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; }}
        .query-group {{ margin-bottom: 15px; }}
        .query-group h4 {{ color: #495057; margin-bottom: 10px; }}
        .query {{ background: white; padding: 8px; margin: 2px 0; border-radius: 4px; font-family: monospace; border: 1px solid #dee2e6; }}
        table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }}
        th {{ background: #f8f9fa; font-weight: 600; }}
        .recommendations {{ background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0; }}
        .rec-item {{ margin: 10px 0; padding-left: 20px; position: relative; }}
        .rec-item:before {{ content: "⚠️"; position: absolute; left: 0; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Enhanced LLM Reconnaissance Report</h1>
            <p><strong>Target:</strong> {result.target}</p>
            <p><strong>Scan Time:</strong> {result.scan_start} to {result.scan_end}</p>
            <p><strong>Targets Scanned:</strong> {result.total_targets}</p>
        </div>

        <div class="stats">
            <div class="stat-card">
                <h3>{result.statistics['total_endpoints_found']}</h3>
                <p>Endpoints Found</p>
            </div>
            <div class="stat-card">
                <h3>{len(result.statistics['providers_found'])}</h3>
                <p>Providers Detected</p>
            </div>
            <div class="stat-card">
                <h3>{len(result.statistics['vulnerabilities_found'])}</h3>
                <p>Vulnerability Types</p>
            </div>
            <div class="stat-card">
                <h3>{result.statistics['success_rate']:.1%}</h3>
                <p>Success Rate</p>
            </div>
        </div>

        <h2>📍 Discovered Endpoints</h2>
"""

        for endpoint in result.endpoints_found:
            vuln_html = ""
            if endpoint.vulnerabilities:
                vuln_html = '<div class="vulnerability"><h4>⚠️ Potential Issues:</h4><ul>'
                for vuln in endpoint.vulnerabilities:
                    vuln_html += f'<li>{vuln.replace("_", " ").title()}</li>'
                vuln_html += '</ul></div>'
            else:
                vuln_html = '<div class="safe">✅ No obvious vulnerabilities detected</div>'

            models_info = ""
            if endpoint.models_available:
                models_info = f"<p><strong>Available Models:</strong> {', '.join(endpoint.models_available[:3])}{'...' if len(endpoint.models_available) > 3 else ''}</p>"

            html += f"""
        <div class="endpoint">
            <h3>{endpoint.provider.value.title()} Endpoint</h3>
            <p><strong>URL:</strong> {endpoint.url}</p>
            <p><strong>Port:</strong> {endpoint.port}</p>
            <p><strong>Response Time:</strong> {endpoint.response_time}s</p>
            <p><strong>Status:</strong> {endpoint.status_code or 'Unknown'}</p>
            {models_info}
            {vuln_html}
        </div>
"""

        html += """
        <h2>🔍 Search Engine Queries</h2>
        <div class="search-queries">
"""

        for engine, queries in result.search_queries.items():
            html += f"""
            <div class="query-group">
                <h4>{engine.title()} Queries:</h4>
"""
            for query in queries:
                html += f'<div class="query">{query}</div>'
            html += "</div>"

        html += """
        </div>

        <h2>📊 Detailed Statistics</h2>
        <table>
            <tr><th>Metric</th><th>Value</th></tr>
"""

        for key, value in result.statistics.items():
            if isinstance(value, dict):
                html += f"<tr><td>{key.replace('_', ' ').title()}</td><td>{', '.join(f'{k}: {v}' for k, v in value.items())}</td></tr>"
            else:
                html += f"<tr><td>{key.replace('_', ' ').title()}</td><td>{value}</td></tr>"

        html += """
        </table>

        <div class="recommendations">
            <h2>🛡️ Security Recommendations</h2>
"""

        for rec in result.recommendations:
            html += f'<div class="rec-item">{rec}</div>'

        html += """
        </div>
    </div>
</body>
</html>
"""
        return html

async def main():
    """Enhanced LLM reconnaissance main function"""
    import argparse

    parser = argparse.ArgumentParser(description="Enhanced LLM Reconnaissance Tool")
    parser.add_argument("target", help="Target IP, IP range, or domain")
    parser.add_argument("-o", "--output", help="Output HTML file")
    parser.add_argument("-c", "--concurrent", type=int, default=50, help="Max concurrent requests")
    parser.add_argument("-t", "--timeout", type=int, default=10, help="Request timeout")
    parser.add_argument("--json", action="store_true", help="Output JSON instead of HTML")

    args = parser.parse_args()

    recon = EnhancedLLMRecon(max_concurrent=args.concurrent, timeout=args.timeout)

    try:
        print("🚀 Starting Enhanced LLM Reconnaissance...")
        result = await recon.scan_target_async(args.target)

        if args.json:
            output = json.dumps(asdict(result), indent=2, default=str)
        else:
            output = recon.generate_html_report(result)

        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(output)
            print(f"📄 Report saved to: {args.output}")
        else:
            print(output)

    finally:
        await recon.close_session()

if __name__ == "__main__":
    asyncio.run(main())
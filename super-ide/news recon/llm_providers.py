#!/usr/bin/env python3
"""
LLM Reconnaissance Tool - Provider Modules
Extended support for various LLM providers and services
"""

import requests
import json
import time
from typing import Dict, List, Optional
from dataclasses import dataclass

@dataclass
class ProviderConfig:
    name: str
    ports: List[int]
    endpoints: List[str]
    auth_patterns: List[str]
    identification_strings: List[str]

class LLMProviders:
    """Comprehensive LLM provider configurations"""

    PROVIDERS = {
        "openai_compatible": ProviderConfig(
            name="OpenAI Compatible",
            ports=[8000, 8080, 3000, 5000],
            endpoints=[
                "/v1/models",
                "/v1/chat/completions",
                "/v1/completions",
                "/v1/embeddings",
                "/v1/images/generations",
                "/health",
                "/api/v1/models"
            ],
            auth_patterns=[
                "sk-", "xoxp-", "xoxb-", "Bearer", "Authorization"
            ],
            identification_strings=[
                "openai", "gpt", "chatgpt", "dall-e", "whisper"
            ]
        ),

        "ollama": ProviderConfig(
            name="Ollama",
            ports=[11434],
            endpoints=[
                "/api/tags",
                "/api/generate",
                "/api/chat",
                "/api/embeddings",
                "/api/version",
                "/api/ps"
            ],
            auth_patterns=[],
            identification_strings=[
                "ollama", "llama", "mistral", "codellama", "vicuna"
            ]
        ),

        "lm_studio": ProviderConfig(
            name="LM Studio",
            ports=[1234, 8080],
            endpoints=[
                "/v1/models",
                "/v1/chat/completions",
                "/v1/completions",
                "/v1/embeddings",
                "/health"
            ],
            auth_patterns=[],
            identification_strings=[
                "lm-studio", "local model", "gguf"
            ]
        ),

        "anthropic": ProviderConfig(
            name="Anthropic",
            ports=[8000, 8080],
            endpoints=[
                "/v1/messages",
                "/v1/complete",
                "/health"
            ],
            auth_patterns=["sk-ant-"],
            identification_strings=[
                "claude", "anthropic", "haiku", "sonnet", "opus"
            ]
        ),

        "huggingface": ProviderConfig(
            name="Hugging Face",
            ports=[7860, 8000],
            endpoints=[
                "/api/models",
                "/api/generate",
                "/api/chat",
                "/health",
                "/api/inference"
            ],
            auth_patterns=["hf_"],
            identification_strings=[
                "huggingface", "transformers", "diffusers"
            ]
        ),

        "together_ai": ProviderConfig(
            name="Together AI",
            ports=[8000, 8080],
            endpoints=[
                "/v1/models",
                "/v1/chat/completions",
                "/v1/completions",
                "/health"
            ],
            auth_patterns=[],
            identification_strings=[
                "together", "ai", "llama", "falcon", "gpt"
            ]
        ),

        "replicate": ProviderConfig(
            name="Replicate",
            ports=[8000, 8080],
            endpoints=[
                "/v1/predictions",
                "/v1/models",
                "/health"
            ],
            auth_patterns=["r8_"],
            identification_strings=[
                "replicate", "stability", "runway", "midjourney"
            ]
        ),

        "text_generation_webui": ProviderConfig(
            name="Text Generation WebUI",
            ports=[7860, 5000, 5001],
            endpoints=[
                "/api/v1/model",
                "/api/v1/generate",
                "/api/v1/chat",
                "/api/v1/token-count",
                "/api/v1/stop-stream"
            ],
            auth_patterns=[],
            identification_strings=[
                "text-generation-webui", "oobabooga", "sillytavern"
            ]
        ),

        "koboldai": ProviderConfig(
            name="KoboldAI",
            ports=[5000, 5001, 7860],
            endpoints=[
                "/api/v1/model",
                "/api/v1/generate",
                "/api/v1/chat",
                "/api/v1/tokenize"
            ],
            auth_patterns=[],
            identification_strings=[
                "koboldai", "kobold", "novelai"
            ]
        ),

        "vllm": ProviderConfig(
            name="vLLM",
            ports=[8000, 8080],
            endpoints=[
                "/v1/models",
                "/v1/chat/completions",
                "/v1/completions",
                "/health"
            ],
            auth_patterns=[],
            identification_strings=[
                "vllm", "ray", "distributed"
            ]
        ),

        "fastchat": ProviderConfig(
            name="FastChat",
            ports=[8000, 8080, 21001],
            endpoints=[
                "/v1/models",
                "/v1/chat/completions",
                "/worker_get_status"
            ],
            auth_patterns=[],
            identification_strings=[
                "fastchat", "lmsys", "vicuna"
            ]
        ),

        "petals": ProviderConfig(
            name="Petals",
            ports=[5000, 8080],
            endpoints=[
                "/api/v1/generate",
                "/api/v1/models",
                "/health"
            ],
            auth_patterns=[],
            identification_strings=[
                "petals", "bloom", "distributed"
            ]
        )
    }

    @classmethod
    def get_provider_by_port(cls, port: int) -> List[str]:
        """Get possible providers for a given port"""
        providers = []
        for name, config in cls.PROVIDERS.items():
            if port in config.ports:
                providers.append(name)
        return providers

    @classmethod
    def identify_provider(cls, response_text: str, headers: Dict) -> List[str]:
        """Identify provider from response content"""
        identified = []

        for name, config in cls.PROVIDERS.items():
            # Check identification strings
            for identifier in config.identification_strings:
                if identifier.lower() in response_text.lower():
                    identified.append(name)
                    break

            # Check server header
            server = headers.get('server', '').lower()
            for identifier in config.identification_strings:
                if identifier.lower() in server:
                    if name not in identified:
                        identified.append(name)
                    break

        return identified

class FreeSearchEngines:
    """Free search engines for reconnaissance"""

    @staticmethod
    def generate_censys_queries(target: str) -> List[str]:
        """Generate Censys search queries"""
        return [
            f'port:11434 {target}',  # Ollama
            f'port:1234 {target}',   # LM Studio
            f'port:8000 "/v1/chat/completions" {target}',
            f'port:8080 "ollama" {target}',
            f'port:7860 "text-generation-webui" {target}',
            f'port:5000 "koboldai" {target}',
            f'services.http.response.body:"openai" {target}',
            f'services.http.response.body:"anthropic" {target}',
            f'services.http.response.body:"huggingface" {target}'
        ]

    @staticmethod
    def generate_zoomeye_queries(target: str) -> List[str]:
        """Generate ZoomEye search queries"""
        return [
            f'port:11434 {target}',
            f'port:1234 {target}',
            f'port:8000 {target}',
            f'port:8080 {target}',
            f'app:"ollama" {target}',
            f'app:"lm-studio" {target}'
        ]

    @staticmethod
    def generate_shodan_queries(target: str) -> List[str]:
        """Generate Shodan search queries (free tier)"""
        return [
            f'port:11434 {target}',
            f'port:1234 {target}',
            f'port:8000 {target} "/v1/chat/completions"',
            f'port:8080 {target} "ollama"',
            f'port:7860 {target} "text-generation-webui"'
        ]

class GoogleDorks:
    """Google dork queries for LLM discovery"""

    @staticmethod
    def generate_dorks(target: str = "") -> List[str]:
        """Generate comprehensive Google dork queries"""
        base_dorks = [
            # Direct endpoints
            'inurl:":11434" "api/tags" -github',
            'inurl:":1234" "v1/models" -github',
            'inurl:":8000" "/v1/chat/completions" -github',
            'inurl:":8080" "ollama" -github',
            'inurl:":7860" "text-generation-webui" -github',

            # Configuration files
            'inurl:".env" "OPENAI_API_KEY" -github',
            'inurl:".env" "OLLAMA_HOST" -github',
            'inurl:"config.json" "openai" -github',
            'inurl:"docker-compose.yml" "ollama" -github',

            # Exposed admin panels
            'inurl:"/admin" "ollama" -github',
            'inurl:"/settings" "lm-studio" -github',
            'inurl:"/api/docs" "chat" "completions" -github',

            # Development servers
            'inurl:"localhost:11434" -localhost',
            'inurl:"127.0.0.1:11434" -127.0.0.1',

            # Cloud deployments
            'site:*.vercel.app "/api/chat"',
            'site:*.netlify.app "/api/generate"',
            'site:*.railway.app "ollama"',

            # Error messages and logs
            '"ollama server started" "listening on"',
            '"LM Studio server running" "port 1234"',
            '"API server listening" "v1/chat/completions"'
        ]

        if target:
            return [dork.replace("{target}", target) for dork in base_dorks]
        return base_dorks

class VulnerabilityScanner:
    """Basic vulnerability checks for LLM endpoints"""

    @staticmethod
    def check_common_vulnerabilities(url: str) -> Dict:
        """Check for common LLM endpoint vulnerabilities"""
        vulnerabilities = {
            "open_access": False,
            "default_credentials": False,
            "information_disclosure": False,
            "rate_limiting_bypass": False,
            "prompt_injection": False
        }

        try:
            # Test for open access (no auth required)
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                vulnerabilities["open_access"] = True

                # Check for information disclosure
                if any(keyword in response.text.lower() for keyword in
                      ["api_key", "secret", "password", "token"]):
                    vulnerabilities["information_disclosure"] = True

        except:
            pass

        return vulnerabilities

class ReportGenerator:
    """Generate comprehensive reports"""

    @staticmethod
    def generate_html_report(results: Dict) -> str:
        """Generate HTML report"""
        html = f"""
<!DOCTYPE html>
<html>
<head>
    <title>LLM Reconnaissance Report</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 40px; }}
        .header {{ background: #f0f0f0; padding: 20px; border-radius: 5px; }}
        .endpoint {{ background: #e8f4f8; margin: 10px 0; padding: 15px; border-radius: 5px; }}
        .vulnerability {{ background: #ffe8e8; border-left: 5px solid #ff6b6b; padding: 10px; margin: 10px 0; }}
        .safe {{ background: #e8ffe8; border-left: 5px solid #4caf50; padding: 10px; margin: 10px 0; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 LLM Reconnaissance Report</h1>
        <p><strong>Target:</strong> {results.get('target', 'Unknown')}</p>
        <p><strong>Scan Time:</strong> {results.get('scan_time', 'Unknown')}</p>
    </div>

    <h2>📍 Found Endpoints</h2>
"""

        for endpoint in results.get('found_endpoints', []):
            html += f"""
    <div class="endpoint">
        <h3>{endpoint.get('provider', 'Unknown Provider')}</h3>
        <p><strong>URL:</strong> {endpoint.get('url', 'Unknown')}</p>
        <p><strong>Port:</strong> {endpoint.get('port', 'Unknown')}</p>
        <p><strong>Response Time:</strong> {endpoint.get('response_time', 'Unknown')}s</p>
    </div>
"""

        html += """
    <h2>🔒 Security Assessment</h2>
"""

        for endpoint in results.get('found_endpoints', []):
            vuln = endpoint.get('vulnerabilities', {})
            if any(vuln.values()):
                html += f"""
    <div class="vulnerability">
        <h4>⚠️ Potential Issues at {endpoint.get('url')}</h4>
        <ul>
"""
                for vuln_type, present in vuln.items():
                    if present:
                        html += f"<li>{vuln_type.replace('_', ' ').title()}</li>"
                html += "</ul></div>"
            else:
                html += f"""
    <div class="safe">
        <h4>✅ {endpoint.get('url')} appears secure</h4>
    </div>
"""

        html += """
    <h2>📋 Recommendations</h2>
    <ul>
        <li>Always obtain explicit permission before scanning systems</li>
        <li>Use responsible disclosure practices for any findings</li>
        <li>Implement proper authentication and rate limiting</li>
        <li>Regular security audits of exposed services</li>
        <li>Monitor for unauthorized access attempts</li>
    </ul>
</body>
</html>
"""
        return html

    @staticmethod
    def generate_json_report(results: Dict) -> str:
        """Generate JSON report"""
        return json.dumps(results, indent=2, default=str)
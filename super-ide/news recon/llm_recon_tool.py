#!/usr/bin/env python3
"""
LLM Reconnaissance Tool - Free Edition
A comprehensive tool for discovering exposed LLM endpoints using free/open sources
For educational and security research purposes only

Author: AI Assistant
Date: March 4, 2026
"""

import requests
import json
import socket
import time
import re
from urllib.parse import urljoin, urlparse
from typing import Dict, List, Optional, Tuple
import concurrent.futures
import threading
from dataclasses import dataclass
from enum import Enum

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
    OOBABOOGA = "oobabooga"

@dataclass
class LLMEndpoint:
    url: str
    provider: LLMProvider
    port: int
    is_accessible: bool
    models_available: List[str]
    auth_required: bool
    response_time: float
    last_seen: str

class LLMRecon:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'LLM-Recon-Educational/1.0 (Educational Research Only)'
        })

        # Common LLM ports and endpoints
        self.common_ports = [8000, 8080, 3000, 5000, 7860, 11434, 1234, 8501, 9090]
        self.endpoints_by_provider = {
            LLMProvider.OPENAI_COMPATIBLE: [
                "/v1/models",
                "/v1/chat/completions",
                "/v1/completions",
                "/v1/embeddings"
            ],
            LLMProvider.OLLAMA: [
                "/api/tags",
                "/api/generate",
                "/api/chat"
            ],
            LLMProvider.LM_STUDIO: [
                "/v1/models",
                "/v1/chat/completions"
            ],
            LLMProvider.TEXT_GENERATION_WEBUI: [
                "/api/v1/model",
                "/api/v1/generate"
            ],
            LLMProvider.KOBOLDAI: [
                "/api/v1/model",
                "/api/v1/generate"
            ]
        }

    def test_endpoint(self, base_url: str, endpoint: str, timeout: int = 5) -> Dict:
        """Test a specific API endpoint"""
        try:
            url = urljoin(base_url, endpoint)
            start_time = time.time()

            response = self.session.get(url, timeout=timeout)
            response_time = time.time() - start_time

            return {
                "url": url,
                "status_code": response.status_code,
                "response_time": round(response_time, 2),
                "accessible": response.status_code < 400,
                "content_length": len(response.text),
                "server": response.headers.get('server', 'unknown'),
                "content_type": response.headers.get('content-type', 'unknown')
            }
        except requests.exceptions.RequestException as e:
            return {
                "url": url,
                "error": str(e),
                "accessible": False,
                "response_time": timeout
            }

    def scan_ip_range(self, ip_range: str, ports: List[int] = None) -> List[LLMEndpoint]:
        """Scan IP range for LLM endpoints"""
        if ports is None:
            ports = self.common_ports

        found_endpoints = []

        def scan_port(ip: str, port: int):
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(1)
                result = sock.connect_ex((ip, port))
                sock.close()

                if result == 0:
                    # Port is open, test for LLM endpoints
                    base_url = f"http://{ip}:{port}"
                    for provider, endpoints in self.endpoints_by_provider.items():
                        for endpoint in endpoints[:1]:  # Test first endpoint per provider
                            result = self.test_endpoint(base_url, endpoint, timeout=3)
                            if result.get("accessible"):
                                found_endpoints.append(LLMEndpoint(
                                    url=base_url,
                                    provider=provider,
                                    port=port,
                                    is_accessible=True,
                                    models_available=[],
                                    auth_required=False,
                                    response_time=result["response_time"],
                                    last_seen=time.strftime("%Y-%m-%d %H:%M:%S")
                                ))
                                break
            except:
                pass

        # Simple IP range scanning (basic implementation)
        if "/" in ip_range:
            # CIDR notation - basic implementation
            base_ip = ip_range.split("/")[0]
            # For demo, just scan the base IP
            for port in ports:
                scan_port(base_ip, port)
        else:
            # Single IP
            for port in ports:
                scan_port(ip_range, port)

        return found_endpoints

    def search_censys_free(self, query: str) -> List[Dict]:
        """Search using Censys free search (no API key)"""
        # Censys has a free web interface, but for automation we'd need scraping
        # This is a placeholder for educational purposes
        print(f"🔍 Censys Search Query: {query}")
        print("Note: Censys free search requires manual browsing at https://search.censys.io/")

        # Return example results for demonstration
        return [
            {
                "ip": "192.168.1.100",
                "ports": [8000, 11434],
                "services": ["ollama", "http"],
                "location": "Example Location"
            }
        ]

    def search_zoomeye_free(self, query: str) -> List[Dict]:
        """Search using ZoomEye free search"""
        print(f"🔍 ZoomEye Search Query: {query}")
        print("Note: ZoomEye free search available at https://www.zoomeye.org/")

        return []

    def search_shodan_free(self, query: str) -> List[Dict]:
        """Limited Shodan search without API (web scraping approach)"""
        print(f"🔍 Shodan Search Query: {query}")
        print("Note: Free Shodan search available at https://www.shodan.io/")

        return []

    def google_dork_search(self, dork: str) -> List[str]:
        """Generate Google dork queries for LLM discovery"""
        print(f"🔍 Google Dork: {dork}")
        print("Use this query in Google search or tools like 'googler'")

        return [dork]

    def comprehensive_scan(self, target: str) -> Dict:
        """Run comprehensive LLM reconnaissance"""
        results = {
            "target": target,
            "scan_time": time.strftime("%Y-%m-%d %H:%M:%S"),
            "found_endpoints": [],
            "search_results": {},
            "recommendations": []
        }

        print(f"🚀 Starting LLM Reconnaissance on: {target}")
        print("=" * 60)

        # 1. Direct IP/Port Scanning
        if re.match(r"\d+\.\d+\.\d+\.\d+", target) or "/" in target:
            print("📡 Scanning for open LLM ports...")
            endpoints = self.scan_ip_range(target)
            results["found_endpoints"].extend([{
                "url": e.url,
                "provider": e.provider.value,
                "port": e.port,
                "response_time": e.response_time
            } for e in endpoints])

        # 2. Free Search Engine Queries
        search_queries = [
            f'port:11434 "{target}"',  # Ollama
            f'port:1234 "{target}"',   # LM Studio
            f'port:8000 "/v1/chat/completions" "{target}"',
            f'port:8080 "ollama" "{target}"',
            f'port:7860 "text-generation-webui" "{target}"'
        ]

        for query in search_queries:
            results["search_results"]["censys"] = self.search_censys_free(query)
            results["search_results"]["zoomeye"] = self.search_zoomeye_free(query)
            results["search_results"]["shodan"] = self.search_shodan_free(query)

        # 3. Google Dorks
        dorks = [
            f'inurl:":11434" "{target}" -github',
            f'inurl:":1234" "{target}" -github',
            f'inurl:"/api" "ollama" "{target}"',
            f'inurl:".env" "OPENAI_API_KEY" "{target}" -github'
        ]

        results["google_dorks"] = dorks
        for dork in dorks:
            self.google_dork_search(dork)

        # 4. Generate Recommendations
        results["recommendations"] = [
            "Always obtain explicit permission before scanning",
            "Use VPN/Tor for anonymity during reconnaissance",
            "Report findings through responsible disclosure",
            "Never attempt to exploit or misuse discovered endpoints",
            "Consider the legal implications in your jurisdiction"
        ]

        return results

    def generate_report(self, results: Dict) -> str:
        """Generate a comprehensive report"""
        report = f"""
# LLM Reconnaissance Report
**Target:** {results['target']}
**Scan Time:** {results['scan_time']}

## Found Endpoints
"""

        for endpoint in results.get('found_endpoints', []):
            report += f"- **{endpoint['provider']}** at {endpoint['url']} (Port {endpoint['port']}, {endpoint['response_time']}s response)\n"

        report += "\n## Search Engine Results\n"

        for engine, findings in results.get('search_results', {}).items():
            report += f"### {engine.title()}\n"
            if findings:
                for finding in findings:
                    report += f"- {finding}\n"
            else:
                report += "- No results found\n"

        report += "\n## Google Dorks\n"
        for dork in results.get('google_dorks', []):
            report += f"- `{dork}`\n"

        report += "\n## Ethical Recommendations\n"
        for rec in results.get('recommendations', []):
            report += f"- {rec}\n"

        return report

def main():
    import argparse

    parser = argparse.ArgumentParser(description="LLM Reconnaissance Tool - Free Edition")
    parser.add_argument("target", help="Target IP, IP range, or domain")
    parser.add_argument("--output", "-o", help="Output file for results")
    parser.add_argument("--threads", "-t", type=int, default=10, help="Number of threads")
    parser.add_argument("--timeout", type=int, default=5, help="Request timeout in seconds")

    args = parser.parse_args()

    recon = LLMRecon()
    results = recon.comprehensive_scan(args.target)

    report = recon.generate_report(results)

    if args.output:
        with open(args.output, 'w') as f:
            f.write(report)
        print(f"📄 Report saved to: {args.output}")
    else:
        print(report)

if __name__ == "__main__":
    main()
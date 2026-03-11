#!/usr/bin/env python3
"""
Ollama & LM Studio Endpoint Reconnaissance Tool
Scans for exposed Ollama and LM Studio API endpoints
"""

import argparse
import json
import socket
import sys
import time
import requests
import re
import ipaddress
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
import re

# secrets regex patterns
SECRET_PATTERNS = [
    r"api[_-]?key[\"'\s:=]+[^\"'\s]+",
    r"authorization[\"'\s:=]+[Bb]earer [^\"'\s]+",
    r"aws[_-]?secret[_-]?key[\"'\s:=]+[^\"'\s]+",
    r"private[_-]?key[\"'\s:=]+[^\"'\s]+",
]

def check_ollama_endpoint(host, port, timeout=5):
    """Check if an Ollama endpoint is available"""
    try:
        url = f"http://{host}:{port}/api/tags"
        response = requests.get(url, timeout=timeout)
        if response.status_code == 200:
            data = response.json()
            models = data.get('models', [])
            return {
                'type': 'Ollama',
                'host': f"{host}:{port}",
                'url': f"http://{host}:{port}",
                'models': [model.get('name', 'unknown') for model in models],
                'live': True
            }
    except:
        pass
    return None

def check_lm_studio_endpoint(host, port, timeout=5):
    """Check if an LM Studio endpoint is available"""
    try:
        # LM Studio has a different API structure
        url = f"http://{host}:{port}/v1/models"
        response = requests.get(url, timeout=timeout)
        if response.status_code == 200:
            return {
                'type': 'LM Studio',
                'host': f"{host}:{port}",
                'url': f"http://{host}:{port}",
                'models': ['available'],  # LM Studio doesn't list models this way
                'live': True
            }
    except:
        pass

    # Try alternative LM Studio endpoint
    try:
        url = f"http://{host}:{port}/health"
        response = requests.get(url, timeout=timeout)
        if response.status_code == 200:
            return {
                'type': 'LM Studio',
                'host': f"{host}:{port}",
                'url': f"http://{host}:{port}",
                'models': ['available'],
                'live': True
            }
    except:
        pass

    return None

def scan_ip_range(ip_range, ports, timeout=3, max_workers=10):
    """Scan an IP range for Ollama and LM Studio endpoints"""
    endpoints = []

    def scan_host(ip):
        results = []
        for port in ports:
            # Check Ollama first (port 11434)
            if port == 11434:
                result = check_ollama_endpoint(str(ip), port, timeout)
                if result:
                    results.append(result)

            # Check LM Studio (port 1234)
            elif port == 1234:
                result = check_lm_studio_endpoint(str(ip), port, timeout)
                if result:
                    results.append(result)

        return results

    try:
        network = ipaddress.ip_network(ip_range, strict=False)
        hosts = list(network.hosts())

        print(f"Scanning {len(hosts)} hosts in range {ip_range}...")

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = [executor.submit(scan_host, ip) for ip in hosts]
            for future in as_completed(futures):
                results = future.result()
                endpoints.extend(results)
                if results:
                    for result in results:
                        print(f"Found {result['type']} endpoint: {result['host']}")

    except Exception as e:
        print(f"Error scanning range {ip_range}: {e}")

    return endpoints

def scan_common_ranges(timeout=3):
    """Scan common local network ranges"""
    endpoints = []

    # Common local network ranges
    ranges = [
        '192.168.1.0/24',    # Common home network
        '192.168.0.0/24',    # Alternative home network
        '10.0.0.0/24',       # Common corporate network
        '172.16.0.0/24',     # Docker networks
        '127.0.0.0/8',       # Localhost range
    ]

    ports = [11434, 1234]  # Ollama and LM Studio default ports

    for ip_range in ranges:
        print(f"Scanning network range: {ip_range}")
        found = scan_ip_range(ip_range, ports, timeout)
        endpoints.extend(found)

    return endpoints

def check_web_endpoint(base_url, endpoint_type, timeout=5):
    """Check for Ollama or LM Studio endpoint on a web URL"""
    endpoints = []
    
    try:
        # Try different common API paths
        if endpoint_type == "Ollama":
            # Ollama API endpoints
            api_paths = [
                "/api/tags",           # List models
                "/api/version",        # Version info
                "/api/ps",            # Running models
                "/api/list",          # Alternative list
            ]
            
            for path in api_paths:
                try:
                    url = urljoin(base_url, path)
                    response = requests.get(url, timeout=timeout, headers={
                        'User-Agent': 'Mozilla/5.0 (compatible; LLM-Recon/1.0)'
                    })
                    
                    if response.status_code == 200:
                        try:
                            data = response.json()
                            models = []
                            
                            # Extract models from different response formats
                            if 'models' in data:
                                models = [m.get('name', 'unknown') for m in data['models']]
                            elif isinstance(data, list):
                                models = [m.get('name', 'unknown') for m in data if isinstance(m, dict)]
                            
                            endpoints.append({
                                'type': 'Ollama',
                                'host': urlparse(base_url).netloc,
                                'url': url,
                                'models': models,
                                'live': True,
                                'source': 'web_recon'
                            })
                            break  # Found working endpoint, no need to check others
                            
                        except json.JSONDecodeError:
                            # Not JSON, but 200 response - might still be valid
                            endpoints.append({
                                'type': 'Ollama',
                                'host': urlparse(base_url).netloc,
                                'url': url,
                                'models': ['unknown'],
                                'live': True,
                                'source': 'web_recon'
                            })
                            break
                            
                except requests.RequestException:
                    continue
                    
        elif endpoint_type == "LM Studio":
            # LM Studio API endpoints
            api_paths = [
                "/v1/models",          # OpenAI-compatible models
                "/health",             # Health check
                "/v1/engines",         # Alternative models
            ]
            
            for path in api_paths:
                try:
                    url = urljoin(base_url, path)
                    response = requests.get(url, timeout=timeout, headers={
                        'User-Agent': 'Mozilla/5.0 (compatible; LLM-Recon/1.0)'
                    })
                    
                    if response.status_code == 200:
                        endpoints.append({
                            'type': 'LM Studio',
                            'host': urlparse(base_url).netloc,
                            'url': url,
                            'models': ['available'],
                            'live': True,
                            'source': 'web_recon'
                        })
                        break
                        
                except requests.RequestException:
                    continue
    
    except Exception as e:
        pass
        
    return endpoints

def scan_common_web_targets(timeout=5, max_workers=10):
    """Scan common web targets where Ollama/LM Studio might be exposed"""
    endpoints = []
    
    # Common hosting patterns and potential targets
    targets = []
    
    # Generate common subdomains and ports
    base_domains = [
        "localhost",
        "127.0.0.1",
        "ollama.local",
        "lm-studio.local",
        "ai.local",
        "llm.local",
    ]
    
    # Add common cloud/local hosting patterns
    for domain in base_domains:
        targets.extend([
            f"http://{domain}:11434",    # Ollama default
            f"http://{domain}:1234",     # LM Studio default
            f"https://{domain}:11434",   # HTTPS variants
            f"https://{domain}:1234",
        ])
    
    # Add common public hosting patterns (simulated)
    public_targets = [
        "http://ollama.example.com:11434",
        "http://lm-studio.example.com:1234",
        "http://ai-server.example.com:11434",
        "http://llm-host.example.com:1234",
    ]
    
    all_targets = targets + public_targets
    
    print(f"Scanning {len(all_targets)} web targets...")
    
    def scan_target(target_url):
        results = []
        try:
            # Try Ollama first
            ollama_results = check_web_endpoint(target_url, "Ollama", timeout)
            results.extend(ollama_results)
            
            # Try LM Studio
            lm_results = check_web_endpoint(target_url, "LM Studio", timeout)
            results.extend(lm_results)
            
            if results:
                print(f"Found endpoints at {target_url}")
                
        except Exception as e:
            pass
            
        return results
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(scan_target, target) for target in all_targets]
        for future in as_completed(futures):
            results = future.result()
            endpoints.extend(results)
    
    return endpoints

def query_shodan(api_key, query, timeout=5):
    """Use Shodan API to search for hosts matching a query and return base URLs."""
    urls = []
    try:
        resp = requests.get(
            "https://api.shodan.io/shodan/host/search",
            params={"key": api_key, "query": query},
            timeout=timeout,
            headers={"User-Agent": "Mozilla/5.0 (compatible; LLM-Recon/1.0)"},
        )
        data = resp.json()
        for match in data.get("matches", []):
            ip = match.get("ip_str")
            port = match.get("port")
            if ip and port:
                urls.append(f"http://{ip}:{port}")
    except Exception:
        pass
    return urls


def query_github(query, token=None, timeout=5):
    """Search GitHub code for the given query and return item URLs."""
    urls = []
    headers = {"User-Agent": "Mozilla/5.0 (compatible; LLM-Recon/1.0)"}
    if token:
        headers["Authorization"] = "token " + token
    page = 1
    while True:
        try:
            resp = requests.get(
                "https://api.github.com/search/code",
                params={"q": query, "per_page": 100, "page": page},
                timeout=timeout,
                headers=headers,
            )
            if resp.status_code != 200:
                break
            data = resp.json()
            for item in data.get("items", []):
                urls.append(item.get("html_url"))
            if 'next' not in resp.links:
                break
            page += 1
            if page > 5:
                break
        except Exception:
            break
    return urls


def gather_wayback_urls(domain, timeout=5):
    """Fetch historical URLs from Wayback Machine and filter for API-like paths."""
    results = []
    try:
        api = f"http://web.archive.org/cdx/search/cdx?url={domain}/*&output=json&filter=statuscode:200"
        resp = requests.get(api, timeout=timeout)
        data = resp.json()
        for entry in data[1:]:
            url = entry[2]
            if any(pat in url for pat in ["/api/", ":11434", ":1234"]):
                results.append(url)
    except Exception:
        pass
    return results


def scrape_js_for_endpoints(base_url, timeout=5):
    """Download JS files linked from a page and extract API endpoints."""
    found = []
    try:
        r = requests.get(base_url, timeout=timeout, headers={"User-Agent": "Mozilla/5.0"})
        if r.status_code == 200:
            # find script srcs
            for match in re.findall(r'<script[^>]+src="([^"]+\.js)"', r.text):
                jsurl = match
                if jsurl.startswith("/"):
                    parsed = urlparse(base_url)
                    jsurl = f"{parsed.scheme}://{parsed.netloc}{jsurl}"
                try:
                    jr = requests.get(jsurl, timeout=timeout)
                    if jr.status_code == 200:
                        for api_match in re.findall(r"(https?://[^"]+/api/[^"]+)", jr.text):
                            found.append(api_match)
                        for rel in re.findall(r"(['\"])(/api/[\w/\-]+)\1", jr.text):
                            found.append(parsed.scheme+"://"+parsed.netloc+rel[1])
                except Exception:
                    pass
    except Exception:
        pass
    return list(set(found))


def check_shodan_like_targets(timeout=5):
    """Simulate checking targets that might be found via Shodan-like services"""
    endpoints = []
    
    # Simulated "exposed" endpoints that might be found in the wild
    # In a real implementation, this would query Shodan, Censys, etc.
    simulated_exposed = [
        ("http://203.0.113.1:11434", "Ollama"),      # RFC 5737 test address
        ("http://203.0.113.2:1234", "LM Studio"),     # RFC 5737 test address
        ("http://192.0.2.1:11434", "Ollama"),        # RFC 5737 test address
        ("http://192.0.2.2:1234", "LM Studio"),       # RFC 5737 test address
    ]
    
    print("Checking simulated exposed endpoints...")
    
    for base_url, service_type in simulated_exposed:
        results = check_web_endpoint(base_url, service_type, timeout)
        endpoints.extend(results)
        if results:
            print(f"Found {service_type} at {base_url}")
        else:
            print(f"No {service_type} found at {base_url}")
    
    return endpoints

def check_cloud_providers(timeout=5):
    """Check common cloud provider patterns"""
    endpoints = []
    
    # Common cloud hosting patterns (simulated)
    cloud_targets = [
        # AWS-like patterns
        "http://ec2-1-2-3-4.compute.amazonaws.com:11434",
        "http://llm-instance.us-east-1.compute.amazonaws.com:1234",
        
        # GCP-like patterns  
        "http://34-102-136-180.llm-server.appspot.com:11434",
        
        # Azure-like patterns
        "http://ollama-server.northcentralus.cloudapp.azure.com:1234",
        
        # DigitalOcean-like patterns
        "http://ollama-nyc1-01.digitalocean.com:11434",
    ]
    
    print("Checking cloud provider patterns...")
    
    for target in cloud_targets:
        # Try both services
        for service_type in ["Ollama", "LM Studio"]:
            results = check_web_endpoint(target, service_type, timeout)
            endpoints.extend(results)
            if results:
                print(f"Found {service_type} at {target}")
    
    return endpoints

def check_domain_patterns(timeout=5):
    """Check common domain patterns and perform simple search engine dorking."""
    endpoints = []

    # build candidate domains using keywords and top-level domains
    patterns = ["ollama", "lm-studio", "ai", "llm", "model", "inference", "gpu", "server"]
    tlds = ["com", "net", "org", "io", "app", "ai"]

    for pat in patterns:
        for tld in tlds:
            base = f"http://{pat}.{tld}"
            # try both default ports for Ollama/LM Studio
            for port, service in [(11434, "Ollama"), (1234, "LM Studio")]:
                url = f"{base}:{port}"
                endpoints.extend(check_web_endpoint(url, service, timeout))

    # simple search-engine dorking using Bing
    try:
        print("Performing search engine dorking for potential endpoints...")
        query = "site:ollama.* OR site:lm-studio.* OR inurl:11434 OR inurl:1234"
        resp = requests.get(
            "https://www.bing.com/search",
            params={"q": query},
            timeout=timeout,
            headers={"User-Agent": "Mozilla/5.0 (compatible; LLM-Recon/1.0)"},
        )
        if resp.status_code == 200:
            links = re.findall(r'<a href="(http[^\"]+)"', resp.text)
            for link in links:
                # ignore Bing redirects
                if "bing.com" in link:
                    continue
                endpoints.extend(check_web_endpoint(link, "Ollama", timeout))
                endpoints.extend(check_web_endpoint(link, "LM Studio", timeout))
    except Exception:
        pass

    return endpoints


def check_miner_api(base_url, timeout=5):
    """Check for exposed Docker/Kubernetes management APIs which often coincide with miner compromises."""
    endpoints = []
    try:
        resp = requests.get(base_url, timeout=timeout, headers={
            'User-Agent': 'Mozilla/5.0 (compatible; GPU-Recon/1.0)'
        })
        if resp.status_code == 200:
            text = resp.text.lower()
            if 'docker' in text or 'version' in text and 'api' in text:
                endpoints.append({
                    'type': 'Exposed Docker API',
                    'host': urlparse(base_url).netloc,
                    'url': base_url,
                    'category': 'mining-api',
                    'live': True,
                    'source': 'miner_api'
                })
            elif 'kubernetes' in text or 'kubelet' in text or 'unauthorized' in text:
                endpoints.append({
                    'type': 'Exposed Kubernetes API',
                    'host': urlparse(base_url).netloc,
                    'url': base_url,
                    'category': 'mining-api',
                    'live': True,
                    'source': 'miner_api'
                })
    except Exception:
        pass
    return endpoints


def check_gpu_endpoint(base_url, gpu_type, timeout=5):
    """Check for GPU-related endpoints (mining, data centers, gaming rigs)"""
    endpoints = []
    
    try:
        if gpu_type == "Mining":
            # Mining pool and rig monitoring endpoints
            mining_paths = [
                "/api/v1/status",           # NiceHash API
                "/api/v1/rigs",             # Mining rig status
                "/api/v1/workers",          # Worker status
                "/stats",                   # Mining stats
                "/rig/0",                   # Individual rig
                "/api/miner/stats",         # Miner statistics
            ]
            
            for path in mining_paths:
                try:
                    url = urljoin(base_url, path)
                    response = requests.get(url, timeout=timeout, headers={
                        'User-Agent': 'Mozilla/5.0 (compatible; GPU-Recon/1.0)'
                    })
                    
                    if response.status_code == 200:
                        try:
                            data = response.json()
                            # Look for GPU-related indicators
                            gpu_indicators = ['gpu', 'nvidia', 'amd', 'radeon', 'geforce', 'rtx', 'hashrate', 'miner']
                            has_gpu = any(indicator in str(data).lower() for indicator in gpu_indicators)
                            
                            if has_gpu or 'rigs' in data or 'workers' in data:
                                endpoints.append({
                                    'type': 'GPU Mining',
                                    'host': urlparse(base_url).netloc,
                                    'url': url,
                                    'category': 'mining',
                                    'gpu_type': 'detected',
                                    'live': True,
                                    'source': 'gpu_recon'
                                })
                                break
                                
                        except json.JSONDecodeError:
                            # Check for GPU keywords in HTML/text response
                            text_content = response.text.lower()
                            gpu_keywords = ['nvidia', 'amd', 'gpu', 'mining', 'hashrate', 'rig', 'worker']
                            if any(keyword in text_content for keyword in gpu_keywords):
                                endpoints.append({
                                    'type': 'GPU Mining',
                                    'host': urlparse(base_url).netloc,
                                    'url': url,
                                    'category': 'mining',
                                    'gpu_type': 'detected',
                                    'live': True,
                                    'source': 'gpu_recon'
                                })
                                break
                                
                except requests.RequestException:
                    continue
                    
        elif gpu_type == "Data Center":
            # Data center and cloud GPU endpoints
            dc_paths = [
                "/api/v1/gpu/status",       # GPU status
                "/api/v1/instances",        # Cloud instances
                "/gpu/metrics",             # GPU metrics
                "/api/v1/compute",          # Compute resources
                "/status",                  # General status
                "/api/health",              # Health check
            ]
            
            for path in dc_paths:
                try:
                    url = urljoin(base_url, path)
                    response = requests.get(url, timeout=timeout, headers={
                        'User-Agent': 'Mozilla/5.0 (compatible; GPU-Recon/1.0)'
                    })
                    
                    if response.status_code == 200:
                        try:
                            data = response.json()
                            # Look for data center GPU indicators
                            dc_indicators = ['gpu', 'cuda', 'nvidia', 'v100', 'a100', 'h100', 'instance', 'compute']
                            has_gpu = any(indicator in str(data).lower() for indicator in dc_indicators)
                            
                            if has_gpu or 'gpus' in data or 'instances' in data:
                                gpu_count = data.get('gpu_count', data.get('gpus', 'unknown'))
                                endpoints.append({
                                    'type': 'Data Center GPU',
                                    'host': urlparse(base_url).netloc,
                                    'url': url,
                                    'category': 'datacenter',
                                    'gpu_count': gpu_count,
                                    'live': True,
                                    'source': 'gpu_recon'
                                })
                                break
                                
                        except json.JSONDecodeError:
                            text_content = response.text.lower()
                            dc_keywords = ['gpu', 'nvidia', 'cuda', 'v100', 'a100', 'datacenter', 'compute']
                            if any(keyword in text_content for keyword in dc_keywords):
                                endpoints.append({
                                    'type': 'Data Center GPU',
                                    'host': urlparse(base_url).netloc,
                                    'url': url,
                                    'category': 'datacenter',
                                    'gpu_count': 'detected',
                                    'live': True,
                                    'source': 'gpu_recon'
                                })
                                break
                                
                except requests.RequestException:
                    continue
                    
        elif gpu_type == "Gaming":
            # Gaming PC and streaming endpoints
            gaming_paths = [
                "/api/v1/gpu",              # GPU info
                "/gpu/stats",               # GPU statistics
                "/system/info",             # System information
                "/api/hardware",            # Hardware info
                "/status",                  # Status endpoint
            ]
            
            for path in gaming_paths:
                try:
                    url = urljoin(base_url, path)
                    response = requests.get(url, timeout=timeout, headers={
                        'User-Agent': 'Mozilla/5.0 (compatible; GPU-Recon/1.0)'
                    })
                    
                    if response.status_code == 200:
                        try:
                            data = response.json()
                            # Look for gaming GPU indicators
                            gaming_indicators = ['rtx', 'geforce', 'radeon', 'gaming', 'stream', 'twitch', 'discord']
                            has_gpu = any(indicator in str(data).lower() for indicator in gaming_indicators)
                            
                            if has_gpu or 'gpu' in str(data).lower():
                                gpu_model = 'detected'
                                if 'gpu' in data and isinstance(data['gpu'], dict):
                                    gpu_model = data['gpu'].get('model', 'detected')
                                elif 'gpu_model' in data:
                                    gpu_model = data['gpu_model']
                                    
                                endpoints.append({
                                    'type': 'Gaming GPU',
                                    'host': urlparse(base_url).netloc,
                                    'url': url,
                                    'category': 'gaming',
                                    'gpu_model': gpu_model,
                                    'live': True,
                                    'source': 'gpu_recon'
                                })
                                break
                                
                        except json.JSONDecodeError:
                            text_content = response.text.lower()
                            gaming_keywords = ['rtx', 'geforce', 'radeon', 'gaming', 'nvidia', 'amd']
                            if any(keyword in text_content for keyword in gaming_keywords):
                                endpoints.append({
                                    'type': 'Gaming GPU',
                                    'host': urlparse(base_url).netloc,
                                    'url': url,
                                    'category': 'gaming',
                                    'gpu_model': 'detected',
                                    'live': True,
                                    'source': 'gpu_recon'
                                })
                                break
                                
                except requests.RequestException:
                    continue
    
    except Exception as e:
        pass
        
    return endpoints

def scan_mining_targets(timeout=5, max_workers=10):
    """Scan for exposed mining rigs and pools"""
    endpoints = []
    
    # Known mining pools and common rig monitoring ports
    mining_targets = []
    
    # Mining pool APIs (common ports)
    mining_pools = [
        ("nicehash.com", [80, 443, 3333, 4000]),
        ("miningpoolhub.com", [80, 443, 20535]),
        ("ethermine.org", [80, 443, 4444]),
        ("sparkpool.com", [80, 443, 3333]),
        ("f2pool.com", [80, 443, 3333]),
        ("antpool.com", [80, 443, 3333]),
    ]
    
    # Generate mining targets
    for pool, ports in mining_pools:
        for port in ports:
            if port == 443:
                mining_targets.append(f"https://{pool}")
            else:
                mining_targets.append(f"http://{pool}:{port}")
    
    # Add common local mining rig IPs (simulated)
    local_mining = [
        "http://192.168.1.100:4000",  # Common mining rig IP
        "http://192.168.1.101:4050",  # Another common setup
        "http://10.0.0.50:3333",      # Mining farm
    ]
    
    all_mining_targets = mining_targets + local_mining
    # also include common exposed manager ports (Docker/K8s) as possible miner API targets
    miner_api_ports = [2375, 2376, 10250]
    for ip_base in ["192.168.1.10", "10.0.0.5"]:
        for port in miner_api_ports:
            all_mining_targets.append(f"http://{ip_base}:{port}")

    print(f"Scanning {len(all_mining_targets)} mining targets (including miner APIs)...")
    
    print(f"Scanning {len(all_mining_targets)} mining targets...")
    
    def scan_mining_target(target_url):
        results = []
        try:
            mining_results = check_gpu_endpoint(target_url, "Mining", timeout)
            results.extend(mining_results)
            # additional check for exposed Docker/K8s APIs
            if ":2375" in target_url or ":2376" in target_url or ":10250" in target_url:
                results.extend(check_miner_api(target_url, timeout))
            if results:
                print(f"Found mining GPU or API at {target_url}")
        except Exception as e:
            pass
        return results
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(scan_mining_target, target) for target in all_mining_targets]
        for future in as_completed(futures):
            results = future.result()
            endpoints.extend(results)
    
    return endpoints

def scan_datacenter_targets(timeout=5, max_workers=10):
    """Scan for data center and cloud GPU instances"""
    endpoints = []
    
    # Data center and cloud GPU targets
    dc_targets = []
    
    # Cloud provider GPU endpoints (simulated)
    cloud_targets = [
        "http://gpu-instance-1.compute.amazonaws.com:8080",
        "http://gpu-cluster-1.us-central1.compute.googleapis.com:8080",
        "http://gpu-vm-1.northcentralus.cloudapp.azure.com:8080",
        "http://gpu-server-1.digitalocean.com:8080",
    ]
    
    # Known data center monitoring ports
    dc_ports = [8080, 9090, 3000, 4000, 5000]
    
    # Add local data center simulation
    local_dc = [
        "http://10.0.0.10:8080",      # Data center management
        "http://192.168.100.1:9090",  # GPU cluster management
    ]
    
    all_dc_targets = cloud_targets + local_dc
    
    print(f"Scanning {len(all_dc_targets)} data center targets...")
    
    def scan_dc_target(target_url):
        results = []
        try:
            dc_results = check_gpu_endpoint(target_url, "Data Center", timeout)
            results.extend(dc_results)
            if results:
                print(f"Found data center GPU at {target_url}")
        except Exception as e:
            pass
        return results
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(scan_dc_target, target) for target in all_dc_targets]
        for future in as_completed(futures):
            results = future.result()
            endpoints.extend(results)
    
    return endpoints

def scan_gaming_targets(timeout=5, max_workers=10):
    """Scan for gaming PCs and streaming rigs with GPUs"""
    endpoints = []
    
    # Gaming and streaming targets
    gaming_targets = []
    
    # Common gaming/streaming ports
    gaming_ports = [3000, 4000, 5000, 8080, 9090]
    
    # Local network gaming IPs (simulated)
    local_gaming = []
    for i in range(100, 120):  # Common gaming PC IPs
        for port in gaming_ports[:2]:  # Limit ports to avoid too many requests
            local_gaming.append(f"http://192.168.1.{i}:{port}")
    
    # Add some known gaming/streaming services (simulated)
    streaming_targets = [
        "http://gaming-pc-1.local:3000",
        "http://stream-rig-1.local:4000",
        "http://rtx-setup.local:5000",
    ]
    
    all_gaming_targets = local_gaming + streaming_targets
    
    print(f"Scanning {len(all_gaming_targets)} gaming targets...")
    
    def scan_gaming_target(target_url):
        results = []
        try:
            gaming_results = check_gpu_endpoint(target_url, "Gaming", timeout)
            results.extend(gaming_results)
            if results:
                print(f"Found gaming GPU at {target_url}")
        except Exception as e:
            pass
        return results
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(scan_gaming_target, target) for target in all_gaming_targets]
        for future in as_completed(futures):
            results = future.result()
            endpoints.extend(results)
    
    return endpoints

def scan_gpu_resources(timeout=5, max_workers=10):
    """Comprehensive GPU resource discovery"""
    endpoints = []
    
    print("\n=== GPU RESOURCE DISCOVERY ===")
    
    # Scan mining targets
    print("Scanning mining rigs and pools...")
    mining_endpoints = scan_mining_targets(timeout, max_workers)
    endpoints.extend(mining_endpoints)
    
    # Scan data center targets
    print("Scanning data centers and cloud GPUs...")
    dc_endpoints = scan_datacenter_targets(timeout, max_workers)
    endpoints.extend(dc_endpoints)
    
    # Scan gaming targets
    print("Scanning gaming PCs and streaming rigs...")
    gaming_endpoints = scan_gaming_targets(timeout, max_workers)
    endpoints.extend(gaming_endpoints)
    
    return endpoints

def main():
    parser = argparse.ArgumentParser(description='GPU & LLM Endpoint Recon Tool')
    parser.add_argument('--search-all', action='store_true', help='Search all platforms (local + web + GPU)')
    parser.add_argument('--web-only', action='store_true', help='Search web targets only')
    parser.add_argument('--local-only', action='store_true', help='Search local network only')
    parser.add_argument('--gpu-only', action='store_true', help='Search GPU resources only (miners, data centers, gamers)')
    parser.add_argument('--mining-only', action='store_true', help='Search mining rigs and pools only')
    parser.add_argument('--datacenter-only', action='store_true', help='Search data center GPUs only')
    parser.add_argument('--gaming-only', action='store_true', help='Search gaming PCs and streaming rigs only')
    parser.add_argument('--timeout', type=int, default=5, help='Request timeout')
    parser.add_argument('--threads', type=int, default=20, help='Number of threads')
    parser.add_argument('--range', help='Specific IP range to scan (e.g., 192.168.1.0/24)')
    parser.add_argument('--shodan-sim', action='store_true', help='Include Shodan-like exposed endpoint simulation')
    parser.add_argument('--cloud-check', action='store_true', help='Check common cloud provider patterns')
    parser.add_argument('--domain-patterns', action='store_true', help='Check common domain patterns')
    parser.add_argument('--targets-file', help='Path to file containing custom URLs to scan (one per line)')
    parser.add_argument('--shodan-api-key', help='Shodan API key for automatic exposed-host discovery')
    parser.add_argument('--osint', action='store_true', help='Perform OSINT techniques (Wayback Machine, JS scraping, dorks)')
    parser.add_argument('--github-query', help='GitHub code search query (dork)')
    parser.add_argument('--github-token', help='GitHub API token for code search')
    args = parser.parse_args()

    print("Starting GPU & LLM endpoint reconnaissance...")
    print(f"Timeout: {args.timeout}s, Threads: {args.threads}")

    endpoints = []

    # Determine what to scan
    do_local = args.search_all or args.local_only or not any([
        args.web_only, args.gpu_only, args.mining_only, args.datacenter_only, args.gaming_only,
        args.shodan_sim, args.cloud_check, args.domain_patterns
    ])
    
    do_web = args.search_all or args.web_only or any([
        args.shodan_sim, args.cloud_check, args.domain_patterns, args.shodan_api_key
    ])
    
    do_gpu = args.search_all or args.gpu_only or any([
        args.mining_only, args.datacenter_only, args.gaming_only
    ])

    if do_local:
        print("\n=== LOCAL NETWORK SCAN ===")
        if args.range:
            # Scan specific range
            ports = [11434, 1234]
            local_endpoints = scan_ip_range(args.range, ports, args.timeout, args.threads)
        else:
            # Scan common ranges
            local_endpoints = scan_common_ranges(args.timeout)
        
        # Also check localhost specifically
        print("Checking localhost...")
        localhost_endpoints = []
        localhost_endpoints.append(check_ollama_endpoint('localhost', 11434, args.timeout))
        localhost_endpoints.append(check_ollama_endpoint('127.0.0.1', 11434, args.timeout))
        localhost_endpoints.append(check_lm_studio_endpoint('localhost', 1234, args.timeout))
        localhost_endpoints.append(check_lm_studio_endpoint('127.0.0.1', 1234, args.timeout))

        for ep in localhost_endpoints:
            if ep:
                local_endpoints.append(ep)
                print(f"Found {ep['type']} endpoint: {ep['host']}")

        endpoints.extend([ep for ep in local_endpoints if ep is not None])

    if do_web:
        print("\n=== WEB RECONNAISSANCE ===")
        
        # Shodan API search
        if args.shodan_api_key:
            print("Querying Shodan API for exposed endpoints...")
            shodan_urls = []
            for q in ["port:11434", "port:1234"]:
                try:
                    shodan_urls.extend(query_shodan(args.shodan_api_key, q, args.timeout))
                except Exception:
                    pass
            print(f"Retrieved {len(shodan_urls)} candidates from Shodan")
            for url in shodan_urls:
                # determine service by port
                svc := "Ollama"
                if ":1234" in url:
                    svc = "LM Studio"
                endpoints.extend(check_web_endpoint(url, svc, args.timeout))
        
        # Custom targets from file
        if args.targets_file:
            try:
                with open(args.targets_file, 'r') as f:
                    custom_urls = [line.strip() for line in f if line.strip()]
                print(f"Scanning {len(custom_urls)} custom targets from {args.targets_file}...")
                for url in custom_urls:
                    endpoints.extend(check_web_endpoint(url, "Ollama", args.timeout))
                    endpoints.extend(check_web_endpoint(url, "LM Studio", args.timeout))
            except Exception as e:
                print(f"Error reading targets file: {e}")
        
        # Common web targets
        if args.search_all or args.web_only:
            print("Scanning common web targets...")
            web_endpoints = scan_common_web_targets(args.timeout, args.threads)
            endpoints.extend(web_endpoints)
        
        # Shodan-like simulation
        if args.shodan_sim:
            shodan_endpoints = check_shodan_like_targets(args.timeout)
            endpoints.extend(shodan_endpoints)
        
        # Cloud provider patterns
        if args.cloud_check:
            cloud_endpoints = check_cloud_providers(args.timeout)
            endpoints.extend(cloud_endpoints)
        
        # Domain patterns
        if args.domain_patterns:
            domain_endpoints = check_domain_patterns(args.timeout)
            endpoints.extend(domain_endpoints)
        # OSINT additional techniques
        if args.osint:
            print("Performing OSINT collection (Wayback, JS scraping) on pattern domains...")
            patterns = ["ollama", "lm-studio", "ai", "llm", "model", "inference", "gpu", "server"]
            tlds = ["com", "net", "org", "io", "app", "ai"]
            osint_urls = []
            for pat in patterns:
                for tld in tlds:
                    dom = f"{pat}.{tld}"
                    osint_urls.extend(gather_wayback_urls(dom, args.timeout))
                    osint_urls.extend(scrape_js_for_endpoints(f"http://{dom}", args.timeout))
            osint_urls = list(set(osint_urls))
            print(f"OSINT yielded {len(osint_urls)} candidate URLs")
            for u in osint_urls:
                endpoints.extend(check_web_endpoint(u, "Ollama", args.timeout))
                endpoints.extend(check_web_endpoint(u, "LM Studio", args.timeout))
        # GitHub dork search
        if args.github_query:
            print("Performing GitHub code search for query:", args.github_query)
            gh_urls = query_github(args.github_query, args.github_token, args.timeout)
            print(f"GitHub returned {len(gh_urls)} results")
            for u in gh_urls:
                endpoints.extend(check_web_endpoint(u, "Ollama", args.timeout))
                endpoints.extend(check_web_endpoint(u, "LM Studio", args.timeout))
                # attempt to fetch file contents and look for secrets
                try:
                    raw = u.replace("https://github.com/", "https://raw.githubusercontent.com/")
                    raw = raw.replace("/blob/", "/")
                    r = requests.get(raw, timeout=args.timeout)
                    if r.status_code == 200:
                        for pat in SECRET_PATTERNS:
                            for match in re.findall(pat, r.text, flags=re.IGNORECASE):
                                print(f"[GH-SECRET] {u}: {match}")
                except Exception:
                    pass

    if do_gpu:
        print("\n=== GPU RESOURCE DISCOVERY ===")
        
        if args.mining_only:
            print("Scanning mining rigs and pools...")
            mining_endpoints = scan_mining_targets(args.timeout, args.threads)
            endpoints.extend(mining_endpoints)
        elif args.datacenter_only:
            print("Scanning data centers and cloud GPUs...")
            dc_endpoints = scan_datacenter_targets(args.timeout, args.threads)
            endpoints.extend(dc_endpoints)
        elif args.gaming_only:
            print("Scanning gaming PCs and streaming rigs...")
            gaming_endpoints = scan_gaming_targets(args.timeout, args.threads)
            endpoints.extend(gaming_endpoints)
        else:
            # Full GPU scan
            gpu_endpoints = scan_gpu_resources(args.timeout, args.threads)
            endpoints.extend(gpu_endpoints)

    # Convert to expected format
    formatted_endpoints = []
    for ep in endpoints:
        formatted_ep = {
            "Platform": ep['type'],
            "Host": ep['host'],
            "URL": ep['url'],
            "Live": ep['live']
        }
        if 'models' in ep and ep['models']:
            formatted_ep["Models"] = ep['models']
        if 'gpu_type' in ep:
            formatted_ep["GPU_Type"] = ep['gpu_type']
        if 'gpu_count' in ep:
            formatted_ep["GPU_Count"] = ep['gpu_count']
        if 'gpu_model' in ep:
            formatted_ep["GPU_Model"] = ep['gpu_model']
        if 'category' in ep:
            formatted_ep["Category"] = ep['category']
        if 'source' in ep:
            formatted_ep["Source"] = ep['source']
        formatted_endpoints.append(formatted_ep)

    # Output results as JSON
    with open('gpu_recon_results.json', 'w') as f:
        json.dump(formatted_endpoints, f, indent=2)

    print(f"\nScan complete. Found {len(formatted_endpoints)} endpoints.")
    print("Results saved to gpu_recon_results.json")
    
    # Print summary
    if formatted_endpoints:
        print("\nFound endpoints:")
        for ep in formatted_endpoints:
            gpu_info = ""
            if 'GPU_Type' in ep:
                gpu_info += f" (GPU: {ep['GPU_Type']})"
            if 'GPU_Count' in ep:
                gpu_info += f" (Count: {ep['GPU_Count']})"
            if 'GPU_Model' in ep:
                gpu_info += f" (Model: {ep['GPU_Model']})"
            if 'Category' in ep:
                gpu_info += f" [{ep['Category']}]"
            source_info = f" [{ep.get('Source', 'local')}]" if 'Source' in ep else ""
            print(f"  - {ep['Platform']}: {ep['URL']}{gpu_info}{source_info}")

if __name__ == '__main__':
    main()
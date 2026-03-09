#!/usr/bin/env python3
"""
LLM Reconnaissance Tool - Demonstration Script
Shows how to use the tool for educational purposes
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from llm_recon_tool import LLMRecon
from llm_providers import LLMProviders, FreeSearchEngines, GoogleDorks, ReportGenerator
import json

def demo_basic_scan():
    """Demonstrate basic scanning functionality"""
    print("🚀 LLM Reconnaissance Tool - Educational Demo")
    print("=" * 60)

    recon = LLMRecon()

    # Test local endpoints (safe for demo)
    test_targets = [
        "127.0.0.1",  # Localhost
        "localhost"
    ]

    all_results = []

    for target in test_targets:
        print(f"\n🔍 Scanning target: {target}")
        results = recon.comprehensive_scan(target)
        all_results.append(results)

        # Show found endpoints
        if results.get('found_endpoints'):
            print("✅ Found endpoints:")
            for endpoint in results['found_endpoints']:
                print(f"  - {endpoint['provider']} at {endpoint['url']}")
        else:
            print("❌ No LLM endpoints found")

    return all_results

def demo_provider_identification():
    """Demonstrate provider identification"""
    print("\n🔍 LLM Provider Identification Demo")
    print("=" * 40)

    providers = LLMProviders()

    # Test port identification
    test_ports = [11434, 1234, 8000, 7860, 5000]
    for port in test_ports:
        possible_providers = providers.get_provider_by_port(port)
        print(f"Port {port}: {', '.join(possible_providers) if possible_providers else 'Unknown'}")

def demo_search_queries():
    """Show search engine queries"""
    print("\n🔍 Free Search Engine Queries Demo")
    print("=" * 40)

    target = "example.com"

    print("Censys Queries:")
    for query in FreeSearchEngines.generate_censys_queries(target):
        print(f"  {query}")

    print("\nZoomEye Queries:")
    for query in FreeSearchEngines.generate_zoomeye_queries(target):
        print(f"  {query}")

    print("\nGoogle Dorks:")
    for dork in GoogleDorks.generate_dorks(target):
        print(f"  {dork}")

def demo_vulnerability_checks():
    """Demonstrate vulnerability scanning"""
    print("\n🛡️ Vulnerability Assessment Demo")
    print("=" * 35)

    from llm_providers import VulnerabilityScanner

    # This would normally test real endpoints
    print("Vulnerability checks would include:")
    print("- Open access verification")
    print("- Default credential testing")
    print("- Information disclosure detection")
    print("- Rate limiting assessment")
    print("- Prompt injection testing")

def generate_sample_report():
    """Generate a sample report for the blog"""
    print("\n📄 Generating Sample Report")
    print("=" * 30)

    sample_results = {
        "target": "demo-target.com",
        "scan_time": "2026-03-04 12:00:00",
        "found_endpoints": [
            {
                "url": "http://192.168.1.100:11434",
                "provider": "ollama",
                "port": 11434,
                "response_time": 0.5,
                "vulnerabilities": {
                    "open_access": True,
                    "information_disclosure": False
                }
            },
            {
                "url": "http://192.168.1.100:1234",
                "provider": "lm_studio",
                "port": 1234,
                "response_time": 1.2,
                "vulnerabilities": {
                    "open_access": False,
                    "information_disclosure": True
                }
            }
        ],
        "search_results": {
            "censys": [{"ip": "192.168.1.100", "ports": [11434, 1234]}],
            "zoomeye": [],
            "shodan": []
        },
        "google_dorks": GoogleDorks.generate_dorks("demo-target.com")[:5],
        "recommendations": [
            "Implement proper authentication",
            "Use HTTPS for all endpoints",
            "Regular security audits",
            "Monitor access logs"
        ]
    }

    # Generate HTML report
    html_report = ReportGenerator.generate_html_report(sample_results)
    with open("/home/lojak/Desktop/super-ide/sample_report.html", "w") as f:
        f.write(html_report)

    # Generate JSON report
    json_report = ReportGenerator.generate_json_report(sample_results)
    with open("/home/lojak/Desktop/super-ide/sample_report.json", "w") as f:
        f.write(json_report)

    print("✅ Sample reports generated:")
    print("  - sample_report.html")
    print("  - sample_report.json")

def show_blog_content():
    """Show blog article content suggestions"""
    print("\n📰 Blog Article Content Suggestions")
    print("=" * 40)

    print("""
📝 Article Structure:

1. Introduction to LLM Security
   - Why LLM endpoints are attractive targets
   - Common deployment scenarios
   - Real-world risks

2. Reconnaissance Methodology
   - Passive vs Active reconnaissance
   - Free tools vs Commercial tools
   - Legal and ethical considerations

3. Tool Demonstration
   - Show the LLM Recon tool in action
   - Explain each component
   - Discuss findings interpretation

4. Case Studies
   - Hypothetical scenarios
   - Common misconfigurations
   - Prevention strategies

5. Defense Strategies
   - Secure deployment practices
   - Monitoring and alerting
   - Incident response

6. Future of LLM Security
   - Emerging threats
   - New protection methods
   - Community best practices

🛡️ Key Takeaways for Readers:
- Always get permission before scanning
- Use free/open tools for learning
- Report findings responsibly
- Implement defense in depth
- Stay updated on LLM security

📊 Statistics to Include:
- Number of exposed endpoints found
- Common vulnerability patterns
- Response times and accessibility
- Provider distribution
""")

def main():
    """Run all demonstrations"""
    print("🎯 LLM Reconnaissance Tool - Complete Educational Demo")
    print("=" * 65)

    try:
        demo_basic_scan()
        demo_provider_identification()
        demo_search_queries()
        demo_vulnerability_checks()
        generate_sample_report()
        show_blog_content()

        print("\n🎉 Demo completed successfully!")
        print("\nNext steps:")
        print("1. Review the generated sample reports")
        print("2. Customize the tool for your specific needs")
        print("3. Test with safe, authorized targets only")
        print("4. Use findings for educational purposes only")

    except Exception as e:
        print(f"❌ Demo failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
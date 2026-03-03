"""
Security analysis routes for Atlas SuperIDE
Handles Slither vulnerability scanning and other security checks
"""

import os
import json
import tempfile
import subprocess
from fastapi import APIRouter, Request

router = APIRouter()

@router.post("/slither")
async def run_slither_analysis(req: Request):
    """Run Slither security analysis on Solidity contracts."""
    body = await req.json()
    path = body.get("path", ".")
    code = body.get("code", "")
    
    try:
        # If code is provided, write to temp file
        if code.strip():
            with tempfile.NamedTemporaryFile(suffix=".sol", mode='w', delete=False) as f:
                f.write(code)
                temp_path = f.name
        else:
            temp_path = path
        
        try:
            result = subprocess.run(
                ["slither", temp_path, "--json", "-"],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            output = result.stdout or result.stderr
            issues = []
            
            try:
                data = json.loads(result.stdout) if result.stdout else {}
                for result_item in data.get("results", []):
                    for check in result_item.get("check_result", []):
                        severity = result_item.get("severity", "medium").lower()
                        issues.append({
                            "file": check.get("source_mapping", {}).get("filename", "unknown"),
                            "line": check.get("source_mapping", {}).get("lines", [0])[0],
                            "column": 0,
                            "severity": severity,
                            "message": f"{result_item.get('check', 'unknown')}: {result_item.get('title', '')}"
                        })
            except:
                # Fallback: parse text output
                for line in output.split('\n'):
                    if any(x in line.lower() for x in ['high', 'medium', 'low', 'info', 'vulnerability']):
                        issues.append({
                            "file": "contract",
                            "line": 0,
                            "column": 0,
                            "severity": "warning",
                            "message": line.strip()
                        })
            
            summary = "✅ No vulnerabilities found" if not issues else f"⚠️ Found {len(issues)} security issues"
            
            return {
                "status": "success" if not any(i["severity"] == "high" for i in issues) else "warning",
                "output": f"{summary}\n\n{output[:1500]}",
                "results": issues[:10],  # return top 10
                "total_issues": len(issues)
            }
            
        finally:
            if code.strip() and temp_path != path:
                os.unlink(temp_path)
                
    except subprocess.TimeoutExpired:
        return {
            "status": "error",
            "output": "⏱️ Slither analysis timeout (>60s)",
            "results": [],
            "total_issues": 0
        }
    except FileNotFoundError:
        return {
            "status": "error",
            "output": "⚠️ Slither not found. Install with: pip install slither-analyzer",
            "results": [],
            "total_issues": 0
        }
    except Exception as e:
        return {
            "status": "error",
            "output": f"❌ Slither error: {str(e)}",
            "results": [],
            "total_issues": 0
        }

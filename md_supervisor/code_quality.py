"""Code quality checking and improvement utilities."""

import ast
import re
from typing import Dict, List, Any, Optional

class CodeQualityChecker:
    """Check and improve code quality."""

    def __init__(self):
        self.issues = []

    def validate_code_structure(self, language: str, code: str) -> Dict[str, Any]:
        """Validate code structure and return issues."""
        if language.lower() in ["python", "py"]:
            return self._validate_python_code(code)
        elif language.lower() in ["javascript", "js", "typescript", "ts"]:
            return self._validate_js_code(code)
        elif language.lower() == "rust":
            return self._validate_rust_code(code)
        else:
            return {"valid": True, "issues": [], "language": language}

    def _validate_python_code(self, code: str) -> Dict[str, Any]:
        """Validate Python code structure."""
        issues = []

        try:
            # Parse the AST
            tree = ast.parse(code)

            # Check for basic issues
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    # Check function length
                    if len(node.body) > 50:
                        issues.append({
                            "type": "long_function",
                            "message": f"Function '{node.name}' is too long ({len(node.body)} lines)",
                            "line": node.lineno
                        })

                    # Check for docstring
                    if not ast.get_docstring(node):
                        issues.append({
                            "type": "missing_docstring",
                            "message": f"Function '{node.name}' missing docstring",
                            "line": node.lineno
                        })

                elif isinstance(node, ast.ClassDef):
                    # Check for docstring
                    if not ast.get_docstring(node):
                        issues.append({
                            "type": "missing_docstring",
                            "message": f"Class '{node.name}' missing docstring",
                            "line": node.lineno
                        })

        except SyntaxError as e:
            issues.append({
                "type": "syntax_error",
                "message": f"Syntax error: {e.msg}",
                "line": e.lineno
            })

        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "language": "python"
        }

    def _validate_js_code(self, code: str) -> Dict[str, Any]:
        """Validate JavaScript/TypeScript code structure."""
        issues = []

        # Basic checks for common issues
        if "var " in code:
            issues.append({
                "type": "deprecated_var",
                "message": "Use 'let' or 'const' instead of 'var'",
                "line": 0
            })

        if "console.log" in code and "production" in code.lower():
            issues.append({
                "type": "console_log",
                "message": "Remove console.log statements in production code",
                "line": 0
            })

        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "language": "javascript"
        }

    def _validate_rust_code(self, code: str) -> Dict[str, Any]:
        """Validate Rust code structure."""
        issues = []

        # Basic checks
        if "unwrap()" in code:
            issues.append({
                "type": "unwrap_usage",
                "message": "Avoid using unwrap() in production code",
                "line": 0
            })

        if "panic!" in code:
            issues.append({
                "type": "panic_usage",
                "message": "Avoid using panic! in production code",
                "line": 0
            })

        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "language": "rust"
        }

    def refactor_code(self, language: str, code: str) -> str:
        """Refactor code for better quality."""
        if language.lower() in ["python", "py"]:
            return self._refactor_python_code(code)
        else:
            return code

    def _refactor_python_code(self, code: str) -> str:
        """Refactor Python code."""
        # Basic refactoring - this could be much more sophisticated
        lines = code.split('\n')
        refactored_lines = []

        for line in lines:
            # Remove trailing whitespace
            line = line.rstrip()

            # Basic improvements
            if line.strip().startswith('print(') and 'debug' not in line.lower():
                # Could add logging instead, but for now just leave it
                pass

            refactored_lines.append(line)

        return '\n'.join(refactored_lines)

    def lint_code(self, language: str, file_path: str) -> Dict[str, Any]:
        """Lint code and return issues."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                code = f.read()

            return self.validate_code_structure(language, code)
        except Exception as e:
            return {
                "passed": False,
                "issues": [{"type": "error", "message": str(e)}],
                "language": language
            }
# Validate PRP

## PRP File: $ARGUMENTS

Pre-flight validation of a PRP to ensure all context and dependencies are available before execution.

## Validation Process

1. **Parse PRP**
   - Read the specified PRP file
   - Extract all file references, URLs, and dependencies
   - Parse validation checklist items

2. **Context Validation**
   - Check all referenced files exist
   - Validate all URLs are accessible
   - Verify environment dependencies are available
   - Check for required API keys/credentials

3. **Codebase Analysis**
   - Scan for similar patterns mentioned in PRP
   - Validate existing examples are current
   - Check for architectural consistency

4. **Dependency Check**
   - Verify all required libraries are installed
   - Check version compatibility
   - Validate external service connectivity

5. **Risk Assessment**
   - Analyze failure patterns mentioned in PRP
   - Assess complexity and confidence score
   - Identify potential bottlenecks

## Validation Gates

### File References

```bash
# Check all referenced files exist
echo "Validating file references..."
for file in $(grep -o 'file: [^[:space:]]*' "$PRP_FILE" | cut -d' ' -f2); do
    if [ ! -f "$file" ]; then
        echo "❌ Missing file: $file"
        exit 1
    else
        echo "✅ Found: $file"
    fi
done
```

### URL Accessibility

```bash
# Check all referenced URLs are accessible
echo "Validating URL references..."
for url in $(grep -o 'url: [^[:space:]]*' "$PRP_FILE" | cut -d' ' -f2); do
    if curl -s --head "$url" > /dev/null; then
        echo "✅ Accessible: $url"
    else
        echo "⚠️  Cannot access: $url"
    fi
done
```

### Environment Dependencies

```bash
# Check environment setup
echo "Validating environment dependencies..."

# Check Python dependencies
if command -v python3 &> /dev/null; then
    echo "✅ Python3 available"

    # Check specific archive/archive/imports mentioned in PRP
    python3 -c "
import re
import sys
# Read PRP file and extract import statements
with open('$PRP_FILE', 'r') as f:
    content = f.read()
# Find import statements in code blocks
archive/archive/imports = re.findall(r'^(?:import|from)\s+([a-zA-Z_][a-zA-Z0-9_]*)', content, re.MULTILINE)
unique_archive/archive/imports = set(archive/archive/imports)
failed_archive/archive/imports = []
for module in unique_archive/archive/imports:
    try:
        __import__(module)
        print(f'✅ Module available: {module}')
    except ImportError:
        failed_archive/archive/imports.append(module)
        print(f'⚠️  Module missing: {module}')
if failed_archive/archive/imports:
    print(f'❌ Missing modules: {failed_archive/archive/imports}')
    sys.exit(1)
"
else
    echo "❌ Python3 not available"
    exit 1
fi
```

### API Connectivity

```bash
# Check external API connectivity
echo "Validating API connectivity..."

# Check common APIs mentioned in PRP
if grep -q "api.openai.com" "$PRP_FILE"; then
    if [ -n "$OPENAI_API_KEY" ]; then
        echo "✅ OpenAI API key configured"
    else
        echo "⚠️  OpenAI API key not set"
    fi
fi

if grep -q "api.anthropic.com" "$PRP_FILE"; then
    if [ -n "$ANTHROPIC_API_KEY" ]; then
        echo "✅ Anthropic API key configured"
    else
        echo "⚠️  Anthropic API key not set"
    fi
fi

# Add more API checks as needed
```

## Validation Report

Generate a comprehensive validation report with:

1. **Context Completeness Score** (0-100)
2. **Dependency Readiness** (Ready/Issues/Blocked)
3. **Risk Assessment** (Low/Medium/High)
4. **Recommended Actions** (before execution)

## Output Format

```
🔍 PRP Validation Report
========================
📁 Context Validation: [PASS/FAIL]
- Files referenced: X/X found
- URLs accessible: X/X responding
- Examples current: [YES/NO]
🔧 Dependencies: [READY/ISSUES/BLOCKED]
- Python modules: X/X available
- External services: X/X accessible
- API keys: X/X configured
⚠️  Risk Assessment: [LOW/MEDIUM/HIGH]
- Complexity score: X/10
- Failure patterns: X identified
- Mitigation strategies: X documented
📊 Readiness Score: XX/100
🎯 Recommended Actions:
[ ] Install missing dependencies
[ ] Configure missing API keys
[ ] Update stale examples
[ ] Review risk mitigation strategies
Status: [READY_TO_EXECUTE/NEEDS_ATTENTION/BLOCKED]
```

## Auto-Fix Suggestions

When validation fails, provide actionable suggestions:

```bash
# Auto-generate fixes where possible
if [ "$STATUS" != "READY_TO_EXECUTE" ]; then
    echo "🔧 Auto-fix suggestions:"
    echo "pip install missing-module-1 missing-module-2"
    echo "export MISSING_API_KEY=your_key_here"
    echo "git checkout HEAD -- outdated-example.py"
fi
```

## Integration with Execute Command

The validate command should be automatically called by execute-prp before starting implementation:

```bash
# In execute-prp.md, add this as step 0:
echo "Running pre-execution validation..."
validate-prp "$PRP_FILE"
if [ $? -ne 0 ]; then
    echo "❌ Validation failed. Please fix issues before execution."
    exit 1
fi
```

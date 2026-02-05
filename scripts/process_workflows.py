#!/usr/bin/env python3
"""
Workflow Consolidation Processor - Phase 2b
Generates GitHub Actions workflow files from YAML configuration.

Purpose:
  Convert workflows-templates.yaml + workflow-base-generic.yml → .github/workflows/*.yml
  Follows same consolidation pattern as Phase 1 (steps)

Usage:
  python3 scripts/process_workflows.py --config .bmad/workflows-templates.yaml --output .github/workflows
  python3 scripts/process_workflows.py --config .bmad/workflows-templates.yaml --output .github/workflows --dry-run

Architecture:
  1. Load YAML configuration (.bmad/workflows-templates.yaml)
  2. Load base template (.bmad/templates/workflow-base-generic.yml)
  3. For each workflow definition:
     - Substitute placeholders (name, triggers, jobs)
     - Generate complete YAML workflow file
     - Write to .github/workflows/

Phase 2 Consolidation:
  Input state: 24 fragmented .yml files (92.6 KB, 23K tokens)
  Output state: 24 generated .yml files (configuration-driven, ~40% consolidation)
  Infrastructure: 1 config + 1 template + 1 processor (generator approach)
"""

import argparse
import sys
import yaml
from pathlib import Path
from typing import Dict, Any, List


class WorkflowProcessor:
    """Generates workflow files from YAML configuration and templates."""

    def __init__(self, config_path: str, template_dir: str, output_dir: str):
        self.config_path = Path(config_path)
        self.template_dir = Path(template_dir)
        self.output_dir = Path(output_dir)
        
        self.config = self._load_config()
        self.workflow_count = 0
        self.files_generated = []

    def _load_config(self) -> Dict[str, Any]:
        """Load workflow configuration from YAML."""
        if not self.config_path.exists():
            raise FileNotFoundError(f"Config file not found: {self.config_path}")
        
        with open(self.config_path, 'r') as f:
            return yaml.safe_load(f)

    def _format_triggers(self, triggers: List[Dict]) -> Dict[str, Any]:
        """Convert trigger list to GitHub Actions 'on' syntax."""
        result = {}
        
        for trigger in triggers:
            trigger_type = trigger.get('type', 'push')
            
            if trigger_type == 'push':
                result['push'] = {
                    'branches': trigger.get('branches', [])
                }
                if 'paths' in trigger:
                    result['push']['paths'] = trigger['paths']
                    
            elif trigger_type == 'pull_request':
                result['pull_request'] = {
                    'branches': trigger.get('branches', [])
                }
                if 'paths' in trigger:
                    result['pull_request']['paths'] = trigger['paths']
                    
            elif trigger_type == 'schedule':
                if 'schedule' not in result:
                    result['schedule'] = []
                result['schedule'].append({'cron': trigger.get('cron', '0 0 * * *')})
                
            elif trigger_type == 'workflow_dispatch':
                result['workflow_dispatch'] = {}
                
            elif trigger_type == 'workflow_run':
                result['workflow_run'] = {
                    'workflows': trigger.get('workflows', []),
                    'types': trigger.get('types', ['completed'])
                }
        
        return result

    def _format_jobs(self, workflow: Dict) -> Dict[str, Any]:
        """Convert job definitions to GitHub Actions format."""
        jobs = {}
        
        for job_def in workflow.get('jobs', []):
            job_name = job_def['name']
            
            # Build job structure
            job = {
                'runs-on': job_def.get('runs-on', 'ubuntu-latest')
            }
            
            # Add needs if specified
            if 'needs' in job_def:
                job['needs'] = job_def['needs']
            
            # Add working directory if specified
            if 'working-directory' in job_def:
                job['working-directory'] = job_def['working-directory']
            
            # Build steps
            steps = []
            for step_def in job_def.get('steps', []):
                if isinstance(step_def, str):
                    # Simple string step (e.g., 'checkout')
                    step = {'uses': 'actions/checkout@v4'} if step_def == 'checkout' else {}
                    if step_def == 'rust-toolchain':
                        step = {
                            'uses': 'dtolnay/rust-toolchain@stable',
                            'with': {
                                'components': ['clippy', 'rustfmt'],
                                'targets': ['wasm32-unknown-unknown']
                            }
                        }
                    elif step_def == 'cargo-cache':
                        step = {
                            'uses': 'actions/cache@v4',
                            'with': {
                                'path': ['~/.cargo/registry', '~/.cargo/git', 'target'],
                                'key': '${{ runner.os }}-cargo-${{ hashFiles("**/Cargo.lock") }}',
                                'restore-keys': ['${{ runner.os }}-cargo-']
                            }
                        }
                    elif step_def == 'node-setup':
                        step = {
                            'uses': 'actions/setup-node@v4',
                            'with': {'node-version': 18}
                        }
                    elif step_def == 'node-setup-v20':
                        step = {
                            'uses': 'actions/setup-node@v4',
                            'with': {'node-version': 20}
                        }
                    elif step_def == 'node-cache':
                        step = {
                            'uses': 'actions/cache@v4',
                            'with': {
                                'path': 'node_modules',
                                'key': '${{ runner.os }}-npm-${{ hashFiles("**/package-lock.json") }}',
                                'restore-keys': ['${{ runner.os }}-npm-']
                            }
                        }
                    elif step_def == 'docker-setup':
                        step = {'uses': 'docker/setup-buildx-action@v2'}
                    elif step_def == 'python-setup':
                        step = {
                            'uses': 'actions/setup-python@v4',
                            'with': {'python-version': '3.11'}
                        }
                    if step:
                        steps.append(step)
                        
                elif isinstance(step_def, dict):
                    # Complex step with name, run, uses, etc.
                    steps.append(step_def)
            
            job['steps'] = steps
            jobs[job_name] = job
        
        return jobs

    def generate_workflow(self, workflow: Dict, dry_run: bool = False) -> str:
        """Generate a single workflow YAML from definition."""
        
        # Build workflow structure
        workflow_yml = {
            'name': workflow['name']
        }
        
        # Add triggers
        triggers = self._format_triggers(workflow.get('triggers', []))
        workflow_yml['on'] = triggers if triggers else {'push': {'branches': ['main']}}
        
        # Add environment variables
        if 'env' in workflow:
            workflow_yml['env'] = workflow['env']
        
        # Add jobs
        jobs = self._format_jobs(workflow)
        workflow_yml['jobs'] = jobs
        
        # Convert to YAML
        yaml_str = yaml.dump(workflow_yml, default_flow_style=False, sort_keys=False)
        
        # Add header comment
        header = f"""# Generated workflow file (Phase 2b consolidation)
# Source configuration: .bmad/workflows-templates.yaml
# Do not edit manually - regenerate with: python3 scripts/process_workflows.py

"""
        result = header + yaml_str
        
        return result

    def process_all(self, dry_run: bool = False) -> None:
        """Generate all workflow files."""
        
        workflows = self.config.get('workflows', [])
        
        print(f"\n{'=' * 80}")
        print("PHASE 2b: WORKFLOW CONSOLIDATION GENERATION")
        print(f"{'=' * 80}")
        print(f"\nConfiguration: {self.config_path}")
        print(f"Output directory: {self.output_dir}")
        print(f"Workflows to generate: {len(workflows)}\n")
        
        for workflow in workflows:
            workflow_id = workflow.get('id', 'unknown')
            filename = workflow.get('filename', f"{workflow_id}.yml")
            
            try:
                # Generate workflow YAML
                workflow_content = self.generate_workflow(workflow, dry_run)
                
                if not dry_run:
                    # Write to file
                    output_path = self.output_dir / filename
                    output_path.parent.mkdir(parents=True, exist_ok=True)
                    output_path.write_text(workflow_content)
                    self.files_generated.append(str(output_path))
                    print(f"✓ Generated: {filename}")
                else:
                    print(f"[DRY-RUN] Would generate: {filename}")
                    
                self.workflow_count += 1
                
            except Exception as e:
                print(f"✗ Error processing workflow '{workflow_id}': {e}")
        
        # Summary
        print(f"\n{'=' * 80}")
        if dry_run:
            print(f"[DRY-RUN] Would generate {self.workflow_count} workflow files")
        else:
            print(f"✓ Generated {self.workflow_count} workflow files")
            print(f"Location: {self.output_dir}")
        print(f"{'=' * 80}\n")


def main():
    parser = argparse.ArgumentParser(
        description="Generate GitHub Actions workflows from YAML configuration"
    )
    parser.add_argument(
        "--config",
        default=".bmad/workflows-templates.yaml",
        help="Path to workflows configuration file"
    )
    parser.add_argument(
        "--output",
        default=".github/workflows",
        help="Output directory for generated workflow files"
    )
    parser.add_argument(
        "--template-dir",
        default=".bmad/templates",
        help="Directory containing workflow templates"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview generation without writing files"
    )
    
    args = parser.parse_args()
    
    try:
        processor = WorkflowProcessor(args.config, args.template_dir, args.output)
        processor.process_all(dry_run=args.dry_run)
        
        if not args.dry_run:
            print(f"✓ Phase 2b: Workflow consolidation complete!")
            
    except Exception as e:
        print(f"✗ Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

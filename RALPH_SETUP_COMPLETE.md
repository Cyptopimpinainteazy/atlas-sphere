# Ralph Extension - Setup Complete ✅

## Installation Summary

Ralph has been successfully installed and is ready to use! This document contains everything you need to know to start using Ralph for autonomous development.

## What is Ralph?

Ralph is a VS Code extension that implements autonomous task execution using GitHub Copilot. It reads your PRD (Product Requirements Document), picks tasks one at a time, and implements them autonomously using Copilot Agent Mode in a loop.

## What Was Done

1. ✅ **Cloned Repository**: Cloned Ralph from https://github.com/aymenfurter/ralph.git
2. ✅ **Installed Dependencies**: Ran `npm install` to install all required packages
3. ✅ **Compiled TypeScript**: Compiled the TypeScript source code to JavaScript
4. ✅ **Packaged Extension**: Created `ralph-0.5.1.vsix` package
5. ✅ **Installed Extension**: Installed the extension in VS Code
6. ✅ **Created Sample PRD**: Created PRD.md in the workspace root for testing

## Installation Verification

The following extensions are now installed:
- ✅ ralph-dev.ralph (Ralph extension)
- ✅ github.copilot-chat (GitHub Copilot - required dependency)

## How to Use Ralph

### Option 1: Using the Control Panel

1. **Open Ralph Control Panel**:
   - Click the Ralph icon in the Activity Bar (left sidebar)
   - Or use Command Palette: `Ctrl+Shift+P` → "Ralph: Open Control Panel"

2. **Generate a PRD from Description** (recommended for new projects):
   - In the Control Panel text area, describe what you want to build
   - Click **"Generate PRD & Tasks"**
   - Ralph will create a PRD.md file with structured tasks
   - Click **"Start"** to begin autonomous development

3. **Use Existing PRD**:
   - If you already have a PRD.md file (like the sample one created)
   - Just click **"Start"** in the Control Panel
   - Ralph will read the PRD and start working through tasks

### Option 2: Manual PRD Creation

Create a `PRD.md` file in your workspace root with this structure:

```markdown
# Project Name

## Overview
Brief description of what you're building.

## Tasks
- [ ] Task 1: Description
- [ ] Task 2: Description
- [ ] Task 3: Description
```

Then open the Control Panel and click **Start**.

## Sample PRD

A sample PRD has been created at: `PRD.md`

This sample includes:
- Creating a Python calculator module
- Adding unit tests
- Creating documentation
- Implementing error handling
- Building a CLI interface

## How Ralph Works

1. **Read**: Ralph reads the PRD.md file
2. **Select**: Finds the next unchecked task `- [ ]`
3. **Execute**: Sends task to Copilot Agent Mode
4. **Implement**: Copilot implements the task autonomously
5. **Complete**: Task is marked as done `- [x]`
6. **Repeat**: Process continues until all tasks are complete

## Control Features

The Control Panel provides:
- ▶️ **Start** - Begin autonomous task execution
- ⏸️ **Pause** - Pause execution
- ⏹️ **Stop** - Stop execution
- 📊 **Progress Timeline** - Visual progress tracking
- 📝 **Logs** - View detailed execution logs

## Configuration Options

You can configure Ralph through VS Code Settings:

1. Open Settings: `Ctrl+,`
2. Search for "Ralph"
3. Available settings:
   - `ralph.files.prdPath`: Path to PRD file (default: "PRD.md")
   - `ralph.files.progressPath`: Path to progress tracking file
   - `ralph.prompt.customTemplate`: Custom prompt template
   - `ralph.prompt.customPrdGenerationTemplate`: Custom PRD generation template

## GitHub Copilot Settings

If you encounter the "Continue" button repeatedly during task execution, increase the max requests:

1. Open VS Code Settings
2. Search for `chat.agent.maxRequests`
3. Set to a higher value (e.g., 100 or more)
4. Default is 25

## Important Notes

⚠️ **EXPERIMENTAL**: Ralph uses internal VS Code workbench commands that are not part of the official API. These may change in future VS Code updates.

✅ **Requirements**:
- VS Code 1.93 or later
- GitHub Copilot Chat extension (already installed ✅)

## File Locations

- **Extension Source**: `/home/lojak/Desktop/x3-chain-master/ralph-repo/`
- **Extension Package**: `/home/lojak/Desktop/x3-chain-master/ralph-repo/ralph-0.5.1.vsix`
- **Sample PRD**: `/home/lojak/Desktop/x3-chain-master/PRD.md`

## Quick Commands

Open Command Palette (`Ctrl+Shift+P`) and search for:
- `Ralph: Open Control Panel` - Open the main control panel
- `Ralph: View Logs` - View detailed execution logs
- `Run pentest` — run `./run-pentest-ralph.sh` to generate a sandboxed pentest report (writes `security/ralph-pentest-report.md`). Use `--allow-network` to enable optional scanners (Snyk, zap-cli) if installed and configured.

## Testing Ralph

To test Ralph with the sample PRD:

1. Click the Ralph icon in the Activity Bar
2. You should see the sample PRD loaded with 5 tasks
3. Click **"Start"** to begin
4. Watch as Ralph autonomously works through each task
5. Monitor progress in the timeline view

## Troubleshooting

### Ralph doesn't appear in Activity Bar
- Try reloading VS Code: `Ctrl+Shift+P` → "Developer: Reload Window"

### Tasks not executing
- Ensure GitHub Copilot Chat is active and signed in
- Check the logs: "Ralph: View Logs"
- Verify PRD.md exists and has proper task format

### Compilation errors
- If you modify the source: `cd ralph-repo && npm run compile`
- Reinstall: `code --install-extension ralph-0.5.1.vsix`

## Next Steps

1. **Try the Sample PRD**: Use the created PRD.md to test Ralph
2. **Create Your Own PRD**: Write a PRD for your actual project
3. **Watch It Work**: Let Ralph autonomously implement your tasks
4. **Review & Iterate**: Check the results and refine your PRD

## Support & Documentation

- **GitHub Repository**: https://github.com/aymenfurter/ralph
- **Original Technique**: https://ghuntley.com/ralph/
- **VS Code Copilot Settings**: https://code.visualstudio.com/docs/copilot/reference/copilot-settings

---

## Summary

🎉 **Ralph is fully installed and ready to use!**

Simply click the Ralph icon in the Activity Bar to get started with autonomous development.

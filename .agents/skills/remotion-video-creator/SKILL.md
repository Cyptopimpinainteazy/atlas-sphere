---
name: remotion-video-creator
description: Create programmatic videos with React and Remotion. Use when the user wants animations, explainers, shorts, or scripted video output built as code.
---

# Remotion Video Creator

Use this skill when the output should be a video composition, not a static asset.

## Workflow

1. Define the video goal, runtime, aspect ratio, and delivery format.
2. Break the video into scenes or compositions with explicit timing.
3. Implement visuals, motion, captions, and audio as React components.
4. Reuse shared assets and brand rules where available.
5. Keep rendering concerns separate from creative direction so the project can iterate quickly.

## Output Rules

- Treat each scene as a composable unit.
- Specify timing, transitions, and asset dependencies.
- Favor deterministic code over manual editing instructions.
- If the Remotion project is missing, scaffold the content plan first and point to the required project setup.

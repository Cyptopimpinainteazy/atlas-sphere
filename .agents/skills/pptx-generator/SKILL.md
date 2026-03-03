---
name: pptx-generator
description: Generate professional presentations and LinkedIn carousels with reusable layouts and brand styling. Use when the user asks for slides, decks, carousels, or structured visual storytelling.
---

# PPTX Generator

Use this skill to convert ideas into branded slide structure before worrying about pixel-level polish.

## Workflow

1. Confirm the target format: presentation, pitch deck, or carousel.
2. Identify the audience, goal, and call to action.
3. Build a slide outline with one job per slide.
4. Apply the active brand system for title style, palette, typography, and supporting visuals.
5. Keep layout instructions structured so they can be rendered by python-pptx or a downstream slide builder.

## Output Rules

- Start with the narrative arc, then slide content.
- Keep each slide scannable.
- Reuse shared templates and brand tokens rather than inventing styling per request.
- Flag missing brand inputs instead of guessing when fidelity matters.

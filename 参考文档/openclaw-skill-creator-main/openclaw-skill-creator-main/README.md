# OpenClaw Skill Creator

**Anthropic Skill-Creator Standard adapted for OpenClaw Framework**

[![OpenClaw](https://img.shields.io/badge/OpenClaw-Compatible-blue)](https://openclaw.ai)
[![License](https://img.shields.io/badge/License-Apache%202.0-green.svg)](LICENSE)

---

## Overview

This repository contains the **OpenClaw-adapted version** of Anthropic's skill-creator guide, tailored specifically for creating high-quality skills in the OpenClaw framework (e.g., for agents like Galatea).

### What is a Skill?

Skills are modular, self-contained packages that extend an Agent's capabilities by providing specialized knowledge, workflows, and tools. Think of them as "onboarding guides" for specific domains or tasks.

### Key Adaptations for OpenClaw

| Aspect | Anthropic (Claude) | OpenClaw (Agent) |
|--------|-------------------|------------------|
| **Context Management** | Skills + System Prompt | AGENTS.md + TOOLS.md |
| **Agent Reference** | "Claude" | "Agent" / "Galatea" |
| **Session Management** | Claude Code / Claude.ai | OpenClaw gateway |
| **Tool Access** | Built-in tools | Configurable tools |

---

## Repository Structure

```
openclaw-skill-creator/
├── guides/
│   ├── skill-creator-guide-openclaw.md    # Main creation guide
│   └── skill-creator-quickref.md          # Quick reference
├── templates/
│   └── skill-template-openclaw.md         # SKILL.md template
├── checks/
│   └── skill-creation-checklist.md        # Quality checklist
└── README.md                              # This file
```

---

## Quick Start

### 1. Reference the Guide

When creating a new skill, reference the OpenClaw-adapted guide:

```markdown
"Use the skill-creator skill to help me create a skill for X"
```

### 2. Follow the 6-Step Process

1. **Understand** - Collect 3+ concrete examples
2. **Plan** - Identify scripts/references/assets
3. **Initialize** - Create skill structure
4. **Edit** - Implement resources and SKILL.md
5. **Package** - Validate and package
6. **Iterate** - Test and improve

### 3. Use the Checklist

Validate your skill with:
- [Skill Creation Checklist](checks/skill-creation-checklist.md)

---

## Core Principles

### 1. Concise is Key

The context window is a public good. Only add context the Agent doesn't already have.

> "Does the Agent really need this explanation?"

### 2. Progressive Disclosure

```
Level 1: Metadata (~100 words) → Always in context
Level 2: SKILL.md body (<5k words) → When skill triggers
Level 3: Bundled resources → As needed by Agent
```

### 3. Set Appropriate Degrees of Freedom

- **High freedom**: Text instructions for varied approaches
- **Medium freedom**: Pseudocode/scripts with parameters
- **Low freedom**: Specific scripts for critical/fragile operations

---

## OpenClaw Integration

### Framework-Specific Considerations

When creating skills for OpenClaw:

1. **AGENTS.md Integration**
   - Complex skills may need workflow sections
   - Document in AGENTS.md if applicable

2. **TOOLS.md Integration**
   - Tool-specific skills need configuration docs
   - Add to TOOLS.md for environment setup

3. **Memory System**
   - Consider cross-session persistence
   - Skills can read/write to MEMORY.md

4. **MCP Servers**
   - Integrate external tools via MCP
   - Document MCP dependencies

5. **Subagent Support**
   - Use `sessions_spawn` for parallel tasks
   - Document subagent patterns

---

## Skill Structure Standard

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter
│   │   ├── name: (required)
│   │   └── description: (required, with triggers)
│   └── Markdown instructions
└── Bundled Resources (optional)
    ├── scripts/      - Executable code
    ├── references/   - Documentation
    └── assets/       - Templates/resources
```

---

## Documentation

### Main Guide
- [Skill Creator Guide (OpenClaw)](guides/skill-creator-guide-openclaw.md)

### Quick References
- [Quick Reference](guides/skill-creator-quickref.md)
- [Quality Checklist](checks/skill-creation-checklist.md)

### Templates
- [SKILL.md Template](templates/skill-template-openclaw.md)

---

## Original Source

This is an adaptation of Anthropic's skill-creator:
- **Original**: https://github.com/anthropics/skills
- **Agent Skills Spec**: https://agentskills.io/specification

---

## License

Apache 2.0 - See [LICENSE](LICENSE) for details.

---

## Contributing

This repository is maintained for OpenClaw framework users. Contributions should focus on:
- OpenClaw-specific adaptations
- Framework integration patterns
- Best practices for OpenClaw agents

---

*Adapted for OpenClaw by Galatea | Based on Anthropic Skill-Creator*

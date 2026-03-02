# Skill Creator 快速参考

**基于 Anthropic Skill-Creator 标准 - OpenClaw 适配版**

---

## 🎯 决策树

```
需要扩展 Agent 能力?
    │
    ├─→ 单次任务? ───────────┐
    │                         │
    │                         ▼
    │                   直接使用工具
    │                         │
    ├─→ 重复工作流? ─────────┤
    │   需要领域知识?         │
    │   需要特定工具?         │
    │                         │
    │                         ▼
    │                   ┌──────────┐
    │                   │ 创建     │
    │                   │ Skill    │
    │                   └──────────┘
    │
    └─→ 已有 skill 可用? ─────┐
                              │
                              ▼
                        使用现有 skill
```

---

## 📝 创建流程速查

### 6-Step Creation Process

| Step | 动作 | 输出 |
|------|------|------|
| **1. Understand** | 收集 3+ 具体使用示例 | 需求明确 |
| **2. Plan** | 识别 scripts/references/assets | 资源清单 |
| **3. Initialize** | `init_skill.py <name>` | 模板目录 |
| **4. Edit** | 实现 resources + SKILL.md | 完整 skill |
| **5. Package** | `package_skill.py` | .skill 文件 |
| **6. Iterate** | 测试 + 改进 | 优化版本 |

### 触发关键词

```markdown
"Use the skill-creator skill to create..."
"用 skill-creator 创建一个处理 X 的 skill"
"Help me design a skill for Y"
"我想创建一个处理 Z 的 skill"
```

---

## 🏗️ Skill 结构速查

```
skill-name/
├── SKILL.md (required)
│   ├── YAML Frontmatter
│   │   ├── name: "skill-name"              # required
│   │   └── description: "When to use..."   # required, 包含触发条件
│   └── Markdown Body
│       ├── 核心流程
│       ├── 资源引用
│       └── 使用示例
│
└── Bundled Resources (optional)
    ├── scripts/          # 可执行代码
    │   └── *.py, *.sh
    ├── references/       # 参考文档
    │   └── *.md
    └── assets/           # 输出资源
        └── 模板, 图片, 字体
```

---

## ✅ 检查清单速查

### SKILL.md 标准

- [ ] Frontmatter: `name` + `description` (包含触发条件)
- [ ] Body: 使用祈使句/不定式
- [ ] 长度: < 500 行, < 5k words
- [ ] 不包含: README, CHANGELOG, 等冗余文档

### 渐进式披露

- [ ] Metadata (~100 words) - 触发机制
- [ ] SKILL.md - 核心流程 + 资源引用
- [ ] References - 按需加载

### 自由度设置

| 场景 | 自由度 | 形式 |
|------|--------|------|
| 多种有效方法 | High | 文本说明 |
| 有优选模式 | Medium | 伪代码/参数脚本 |
| 易出错/关键 | Low | 具体脚本 |

---

## 📚 资源引用速查

### Scripts (何时使用)
- 重复编写的代码
- 需要确定性可靠性
- 复杂计算/转换

**示例:**
```python
# scripts/rotate_pdf.py
# 可重复使用的 PDF 旋转脚本
```

### References (何时使用)
- 领域知识文档
- API 规范
- 公司政策
- 详细工作流

**示例:**
```markdown
# references/finance-schema.md
# 财务数据库表结构
```

### Assets (何时使用)
- 输出模板
- 品牌资源
- 样板代码
- 字体/图片

**示例:**
```
assets/
├── logo.png
├── template.pptx
└── boilerplate-react/
```

---

## 🔄 渐进式披露模式

### Pattern 1: High-level Guide
```markdown
## Quick Start
[核心示例]

## Advanced
- **Feature A**: See [A.md](A.md)
- **Feature B**: See [B.md](B.md)
```

### Pattern 2: Domain Organization
```
skill/
├── SKILL.md
└── references/
    ├── finance.md
    ├── sales.md
    └── product.md
```

### Pattern 3: Conditional Details
```markdown
## Basic
[基础用法]

**For advanced X**: See [X.md](X.md)
```

---

## 🔧 与 TriadDev 集成

### Skill 开发项目流程

```bash
# 1. 初始化项目
triadev init "my-skill" --template lib

# 2. 使用 skill-creator 规划
cd my-skill
# → 使用 skill-creator skill
# → 完成 6-step 流程

# 3. 开发
# → 实现 scripts/
# → 编写 references/
# → 创建 SKILL.md

# 4. 验证
# → 使用检查清单
# → 测试实际使用

# 5. 完成
triadev run --complete
```

---

## 📖 参考文档

### OpenClaw 适配版 (推荐)
| 文档 | 路径 | 用途 |
|------|------|------|
| **创建指南** | `~/.openclaw/skills/anthropic/references/skill-creator/openclaw-adapted/skill-creator-guide-openclaw.md` | OpenClaw 适配版完整规范 (Agent 视角) |
| **标准模板** | `~/.openclaw/skills/anthropic/references/skill-creator/openclaw-adapted/skill-template-openclaw.md` | OpenClaw 适配版模板 |

### Anthropic 原版
| 文档 | 路径 | 用途 |
|------|------|------|
| **创建指南** | `~/.openclaw/skills/anthropic/references/skill-creator/anthropic-skill-creator-guide.md` | Anthropic 原版完整规范 (Claude 视角) |
| **标准模板** | `~/.openclaw/skills/anthropic/references/skill-creator/skill-template.md` | Anthropic 原版模板 |
| **工作流模式** | `~/.openclaw/skills/anthropic/references/skill-creator/workflows.md` | 流程设计 |
| **输出模式** | `~/.openclaw/skills/anthropic/references/skill-creator/output-patterns.md` | 输出规范 |

### 质量检查
| 文档 | 路径 | 用途 |
|------|------|------|
| **检查清单** | `docs/skill-creation-checklist.md` | 质量验证 |
| **快速参考** | `docs/skill-creator-quickref.md` | 速查手册 |

---

## 🔧 OpenClaw 适配说明

### 主体称谓对照
| Anthropic 原版 | OpenClaw 适配版 | 示例 |
|----------------|-----------------|------|
| Claude | Agent / Galatea | "helps the Agent understand" |
| Claude's capabilities | Agent's capabilities | "extends the Agent's capabilities" |
| Claude needs | Agent needs | "everything else the Agent needs" |
| Claude doesn't have | Agent doesn't have | "the Agent doesn't already have" |

### 框架特性
- **AGENTS.md**: 行为准则和工作流定义
- **TOOLS.md**: 工具配置和环境设置
- **Memory**: 跨会话持久化
- **MCP**: 外部工具集成
- **Subagent**: 并行任务执行

---

## 💡 最佳实践

### Do ✅
- 保持 SKILL.md 简洁 (< 500 行)
- 在 description 中包含触发条件
- 使用渐进式披露设计
- 测试所有 scripts
- 从 SKILL.md 直接引用 resources
- **适配 OpenClaw**: 考虑 AGENTS.md/TOOLS.md 集成

### Don't ❌
- 添加 Agent 已知的常识
- 创建 README/CHANGELOG 等冗余文档
- 在 SKILL.md 和 references 中重复信息
- 使用 deeply nested references
- 超过 500 行不分拆

---

## 🚀 快速开始

**1. 准备创建：**
```
收集 3+ 具体使用示例
考虑 OpenClaw 集成点
```

**2. 触发 skill-creator：**
```
"Use the skill-creator skill to help me create a skill for X"
```

**3. 参考文档：**
```
推荐: skill-creator-guide-openclaw.md (已适配 Agent 视角)
备选: anthropic-skill-creator-guide.md (Anthropic 原版)
```

**4. 验证质量：**
```
使用 docs/skill-creation-checklist.md
验证与 OpenClaw 框架的集成
```

---

*Based on Anthropic Skill-Creator Standard | OpenClaw Adapted | Agent/Galatea Ready*

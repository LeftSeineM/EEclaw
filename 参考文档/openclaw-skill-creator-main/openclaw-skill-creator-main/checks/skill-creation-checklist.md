# Skill Creation 检查清单

**基于 Anthropic Skill-Creator 标准 - OpenClaw 适配版**

---

## ✅ Pre-Creation 检查

### 1. 理解需求
- [ ] 明确 skill 的核心功能
- [ ] 收集具体使用示例 (至少 3 个)
- [ ] 确定触发关键词
- [ ] 验证需求合理性
- [ ] **OpenClaw**: 考虑是否需要 AGENTS.md/TOOLS.md 集成

### 2. 规划资源
- [ ] 识别需要 scripts/ (可执行代码) 的功能
- [ ] 识别需要 references/ (参考文档) 的领域知识
- [ ] 识别需要 assets/ (模板资源) 的输出资源
- [ ] **OpenClaw**: 考虑 Memory 集成需求
- [ ] **OpenClaw**: 考虑 MCP server 集成

---

## ✅ SKILL.md 标准检查

### Frontmatter (YAML)
- [ ] `name`: 简洁明确的技能名称
- [ ] `description`: 
  - [ ] 说明技能功能
  - [ ] 包含触发关键词
  - [ ] 说明何时使用
  - [ ] 不使用 "When to Use" section (放在 description 中)
  - [ ] **OpenClaw**: 使用 "Agent" 而非 "Claude"

### Body 结构
- [ ] 使用祈使句/不定式形式 (imperative/infinitive)
- [ ] 遵循 **Concise is Key** 原则
- [ ] 只添加 Agent 不知道的内容
- [ ] 每个段落都有明确的价值
- [ ] **OpenClaw**: 主体称谓统一为 "Agent" 或 "Galatea"

### 自由度设置
- [ ] **High freedom**: 文本说明，适用于多种有效方法
- [ ] **Medium freedom**: 伪代码/带参数的脚本，适用于有优选模式
- [ ] **Low freedom**: 具体脚本，适用于易出错/关键一致性场景

---

## ✅ OpenClaw 框架适配检查

### 主体称谓
- [ ] 使用 "Agent" 而非 "Claude"
- [ ] 使用 "Agent's capabilities" 而非 "Claude's capabilities"
- [ ] 使用 "the Agent needs" 而非 "Claude needs"
- [ ] 使用 "the Agent doesn't have" 而非 "Claude doesn't have"

### 框架集成
- [ ] **AGENTS.md**: 复杂 skills 是否需要新增工作流章节?
- [ ] **TOOLS.md**: 工具类 skills 是否需要新增配置章节?
- [ ] **Memory**: 是否需要跨会话持久化?
- [ ] **MCP**: 是否需要集成外部 MCP servers?
- [ ] **Subagent**: 是否需要使用 sessions_spawn?

### 参考文档选择
- [ ] 优先使用 OpenClaw 适配版: `skill-creator-guide-openclaw.md`
- [ ] 备选 Anthropic 原版: `anthropic-skill-creator-guide.md`
- [ ] 使用 OpenClaw 适配模板: `skill-template-openclaw.md`

---

## ✅ 渐进式披露检查

### 分层设计
```
Level 1: Metadata (~100 words) - 始终在上下文
  └── name + description (触发机制)
  
Level 2: SKILL.md body (<5k words, <500 lines)
  └── 核心流程 + 资源引用
  
Level 3: Bundled Resources (按需加载)
  ├── scripts/ - 可执行代码
  ├── references/ - 领域知识
  └── assets/ - 输出模板
```

### 检查点
- [ ] SKILL.md body < 500 行
- [ ] 大文件 (>100 行) 有目录
- [ ] References 文件从 SKILL.md 直接引用
- [ ] 避免 deeply nested references (保持一层)
- [ ] 不在 SKILL.md 和 references 中重复信息

---

## ✅ 资源组织检查

### Scripts 目录
- [ ] Python/Bash 可执行代码
- [ ] 经过实际测试
- [ ] 适用于重复编写/确定性需求

### References 目录
- [ ] 领域知识文档
- [ ] API 文档
- [ ] 公司政策/规范
- [ ] 详细工作流

### Assets 目录
- [ ] 模板文件
- [ ] 图片/图标
- [ ] 字体
- [ ] 样板代码

### 不包含的内容 ❌
- [ ] README.md
- [ ] INSTALLATION_GUIDE.md
- [ ] QUICK_REFERENCE.md
- [ ] CHANGELOG.md
- [ ] 任何与功能无关的辅助文档

---

## ✅ Pattern 应用检查

### Pattern 1: High-level guide with references
```markdown
## Quick start
[核心代码示例]

## Advanced features
- **Feature A**: See [A.md](A.md)
- **Feature B**: See [B.md](B.md)
```

### Pattern 2: Domain-specific organization
```
skill/
├── SKILL.md (overview)
└── references/
    ├── domain-a.md
    ├── domain-b.md
    └── domain-c.md
```

### Pattern 3: Conditional details
```markdown
## Basic usage
[基础示例]

**For advanced X**: See [X.md](X.md)
```

---

## ✅ 创建流程检查

### Step 1: Understand
- [ ] 有明确的使用示例
- [ ] 功能边界清晰

### Step 2: Plan
- [ ] 列出所有 scripts/
- [ ] 列出所有 references/
- [ ] 列出所有 assets/

### Step 3: Initialize
- [ ] 使用 init_skill.py 创建模板
- [ ] 目录结构正确

### Step 4: Edit
- [ ] 实现所有 resources
- [ ] 测试 scripts
- [ ] 编写 SKILL.md

### Step 5: Package
- [ ] 运行 package_skill.py
- [ ] 通过 validation
- [ ] 生成 .skill 文件

### Step 6: Iterate
- [ ] 实际使用测试
- [ ] 收集反馈
- [ ] 持续改进

---

## ✅ 质量检查

### Token 效率
- [ ] 没有冗余说明
- [ ] 没有 Claude 已知的常识
- [ ] 示例比说明更简洁

### 完整性
- [ ] 覆盖所有计划功能
- [ ] 错误处理说明
- [ ] 边界情况说明

### 可用性
- [ ] 触发条件明确
- [ ] 使用示例具体
- [ ] 输出可预测
- [ ] **OpenClaw**: 与框架集成顺畅

---

## 📚 参考文档

### OpenClaw 适配版 (推荐)
- **创建指南**: `~/.openclaw/skills/anthropic/references/skill-creator/openclaw-adapted/skill-creator-guide-openclaw.md`
- **标准模板**: `~/.openclaw/skills/anthropic/references/skill-creator/openclaw-adapted/skill-template-openclaw.md`

### Anthropic 原版
- **创建指南**: `~/.openclaw/skills/anthropic/references/skill-creator/anthropic-skill-creator-guide.md`
- **标准模板**: `~/.openclaw/skills/anthropic/references/skill-creator/skill-template.md`
- **Workflows**: `~/.openclaw/skills/anthropic/references/skill-creator/workflows.md`
- **Output Patterns**: `~/.openclaw/skills/anthropic/references/skill-creator/output-patterns.md`

### 质量检查
- **检查清单**: `docs/skill-creation-checklist.md`
- **快速参考**: `docs/skill-creator-quickref.md`

---

*Based on Anthropic Skill-Creator Standard | OpenClaw Adapted*

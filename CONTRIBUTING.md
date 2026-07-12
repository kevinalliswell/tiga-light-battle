# 贡献指南

感谢你愿意改进这个面向孩子的小游戏。提交贡献前，请先阅读 [NOTICE.md](NOTICE.md)，不要提交没有授权的官方图片、模型、音乐或音效。

## 开发流程

1. 从 `main` 创建短期分支，例如 `feat/air-combat-ui` 或 `fix/energy-meter`。
2. 安装 Node.js 20+，运行 `npm ci`。
3. 修改代码，并为规则或行为变化补充 Vitest 测试。
4. 提交前运行 `npm run check`。
5. 发起 Pull Request，说明动机、行为变化和验证方式。

## 代码约定

- 使用现有的 TypeScript、Three.js、Vite、Vitest 和 WebAudio 技术栈。
- 优先使用清晰的小函数和现有模块边界，不为单次需求引入新框架。
- 面向 10-12 岁儿童保持反馈清楚、暴力表现克制、操作可恢复。
- 所有用户可见的控制都要兼顾键盘和触屏，并保持可访问名称。
- 代码注释解释原因，不重复代码本身。

## 提交和 Pull Request

提交信息使用 Conventional Commits 风格，例如：

```text
feat: add air-combat tutorial
fix: prevent ground monster from hitting airborne Tiga
test: cover shining form unlock rule
```

Pull Request 至少应包含：

- 改动目的和用户可见行为。
- 测试、类型检查和构建结果。
- 如果涉及画面或操作，附桌面和移动端验证说明。
- 如果涉及第三方素材，附清晰的授权来源；没有授权的素材不要提交。

## 报告问题

请使用 GitHub Issue 模板提交可复现步骤、浏览器/系统、预期行为和实际行为。安全问题请按照 [SECURITY.md](SECURITY.md) 私下报告。

# 简历生成器

面向中国求职场景的网页简历生成器：用户填写结构化内容，系统用少量稳定的网页模板排版，可切换模板、调整少量样式，并导出稳定的 PDF。

**它不是** Word 编辑器，**不是** Office 模板解析器，**不是** Canva 式的自由画布工具。

---

## 当前进度

项目按 Milestone 推进，**一个阶段未通过验收，不进入下一个**。

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| M0 | 项目骨架 | **已完成** |
| M1 | 单模板只读预览（简约单栏） | 未开始 |
| M2 | 内容编辑 | 未开始 |
| M3 | 保存与恢复 | 未开始 |
| M4 | 模板切换（共 3 个模板） | 未开始 |
| M5 | 基础样式（主题色 / 字体 / 密度 / 头像） | 未开始 |
| M6 | PDF 导出 | 未开始 |

M0 ~ M6 全部通过后，才称为 MVP。M7（AI 内容辅助）与 M8（模板扩展）在 MVP 之后。

### M0 交付了什么

一个最小可运行的项目骨架：

- React + TypeScript + Vite 项目初始化
- 基础路由与页面框架
- 按数据规范定义的 Resume 类型（Section 使用 discriminated union）
- 一份固定的中文示例简历数据
- 编辑器路由用于验证「类型定义 → 示例数据 → 页面读取」链路成立

### M0 刻意没做什么

这一阶段**不是**真正的简历编辑器。以下均为后续阶段内容，当前不存在：

- 真正的 A4 简历模板与任何模板渲染
- 表单编辑、内容增删改
- 数据保存（LocalStorage / 数据库）
- 模板切换与模板选择页
- PDF 导出
- AI 功能、登录、首页视觉设计

编辑器页当前是一个**开发态验证页**，只展示示例简历的字段值与统计信息，用来证明数据链路成立，不是最终界面。

---

## 快速开始

需要 Node.js 18 及以上。

```bash
npm install
npm run dev
```

打开终端提示的地址，访问 `/editor/resume_001` 可看到示例简历数据被读取的结果。

其他命令：

```bash
npm run typecheck   # TypeScript 类型检查
npm run build       # 类型检查 + 生产构建
npm run preview     # 预览生产构建结果
```

### 验证数据链路确实成立

页面上的所有值都来自 `src/data/sampleResume.ts`。修改该文件里 `profile.name` 的值，刷新页面即可看到变化——这是区分「真实读取数据」与「页面写死字符串」的关键。

---

## 技术栈

| 类别 | 选型 |
| --- | --- |
| 框架 | React 19 |
| 语言 | TypeScript 7 |
| 构建 | Vite 8 |
| 路由 | React Router 7（Declarative / `BrowserRouter`） |
| 样式 | 普通 CSS 与 CSS Modules |

### 当前阶段明确不引入

Next.js、Redux、Zustand、Tailwind、shadcn/ui、Material UI / Ant Design、大型表单框架、数据库、ORM、后端服务、Office / Word 相关依赖、Canvas 编辑器、PDF 相关库。

这些都是**有意不引入**的。项目遵循一条原则：真正的需求出现之前，不提前引入依赖，也不提前做架构决策。后续阶段确实需要时，再按实际需求单独评估。

---

## 目录结构

```
.
├── docs/ai-context/          项目规格与长期上下文（正式文档，见下方索引）
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.tsx              入口，BrowserRouter 包裹 App
    ├── App.tsx               路由表
    ├── types/resume.ts       Resume 数据结构类型定义
    ├── data/sampleResume.ts  固定中文示例简历数据
    ├── pages/                页面组件
    │   ├── MyResumesPage.tsx
    │   ├── NewResumePage.tsx
    │   └── EditorPage.tsx
    └── styles/global.css
```

结构保持扁平，没有提前划分 `components/`、`hooks/`、`lib/` 等目录。目录分层随真实需求增长，而不是预先猜测。

路由：

| 路径 | 页面 | 状态 |
| --- | --- | --- |
| `/` | 我的简历 | 骨架 |
| `/new` | 新建简历 | 骨架 |
| `/editor/:resumeId` | 简历编辑器 | M0 开发态验证页 |

---

## 核心设计决策

这几条决定了项目的长期形态，也是审阅代码时的关键背景。

### 1. 内容与模板分离

同一份简历数据可以被任意模板渲染。模板是「如何展示数据」的渲染组件，不拥有独立的数据副本。

- 切换模板只改变 `templateId`，**不得**修改 `sections` 内容。
- 模板不新增专属业务字段，不为模板修改数据结构。

这是整个项目的架构基石。数据只有一份真相来源。

### 2. 数据层只存内容，不存排版

`src/types/resume.ts` 中的数据结构遵循以下禁止项：

- 不存绝对坐标
- 不存任意 CSS 或已排版的 HTML
- 不存 Office XML、Word 样式 ID、字体文件路径
- 不存模板 HTML 快照

长文本一律使用 `string[]`（bullet 列表），样式只保存选项名（如 `density: 'standard'`），由模板内部映射成具体字号与间距。用户在界面上改的是「内容」和「少量样式参数」，不是排版细节。

### 3. Section 使用 discriminated union

不同内容模块共用统一的 Section 外壳（`id` / `type` / `title` / `visible` / `order` / `items`），再按 `type` 收窄到具体类型：

```ts
export type ResumeSection =
  | EducationSection
  | WorkSection
  | ProjectSection
  | SkillsSection;
```

这样渲染时 TypeScript 能自动收窄类型，字段名写错会在编译阶段报错，而不是运行时静默出错。

当前只定义规范中已明确的四种类型。**不为了未来可能的需求提前扩展数据结构**——需要新模块时，先更新数据规范文档，再扩展类型。

### 4. 展示名称取自数据

列表渲染时模块标题直接取数据中的 `title` 字段，代码里没有「类型 → 中文名」的映射表，避免出现第二份真相来源。

---

## 文档索引

`docs/ai-context/` 存放项目的正式规格与长期上下文，与代码同仓库。建议按以下顺序阅读：

| 文档 | 内容 |
| --- | --- |
| [00_README](./docs/ai-context/00_README.md) | 文档总览与阅读顺序 |
| [01_PROJECT_CHARTER](./docs/ai-context/01_PROJECT_CHARTER.md) | 项目章程：目标、边界、成功标准 |
| [02_MVP_PRODUCT_SPEC](./docs/ai-context/02_MVP_PRODUCT_SPEC.md) | MVP 产品规格：页面、模块、样式设置 |
| [03_RESUME_DATA_SCHEMA](./docs/ai-context/03_RESUME_DATA_SCHEMA.md) | 简历数据结构规范 |
| [04_TEMPLATE_SYSTEM_SPEC](./docs/ai-context/04_TEMPLATE_SYSTEM_SPEC.md) | 模板系统规范 |
| [05_EDITOR_UX_SPEC](./docs/ai-context/05_EDITOR_UX_SPEC.md) | 编辑器交互规范 |
| [06_AI_DEVELOPMENT_PROTOCOL](./docs/ai-context/06_AI_DEVELOPMENT_PROTOCOL.md) | 开发协议与协作规则 |
| [07_MILESTONES_AND_ACCEPTANCE](./docs/ai-context/07_MILESTONES_AND_ACCEPTANCE.md) | 阶段划分与验收标准 |
| [08_TASK_BRIEF_TEMPLATE](./docs/ai-context/08_TASK_BRIEF_TEMPLATE.md) | 单次任务模板 |

文档之间存在优先级：`01` 的边界最高，`03` 与 `04` 为核心架构约束，阶段任务不得突破当前 Milestone 范围。

---

## 开发协作约定

- 每次只完成一个 Milestone 内的单一任务，不自行扩大范围。
- 不一次性重写项目、不擅自更换框架或引入新依赖。
- 不为「以后也许用得到」增加抽象层；已有 2 ~ 3 个真实复用场景时才考虑抽象。
- 任务未达到可运行、可验证、无回归的状态，不算完成。
- 不使用虚假占位：不用静态截图假装编辑器，不用写死数据假装功能完成。

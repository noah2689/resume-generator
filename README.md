# 简历生成器

面向中国求职场景的网页简历生成器：用户填写结构化内容，系统用少量稳定的网页模板排版，可切换模板、调整少量样式，并导出稳定的 PDF。

**它不是** Word 编辑器，**不是** Office 模板解析器，**不是** Canva 式的自由画布工具。

---

## 当前进度

项目按 Milestone 推进，**一个阶段未通过验收，不进入下一个**。

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| M0 | 项目骨架 | **已完成** |
| M1 | 单模板只读预览（简约单栏） | **已完成** |
| M2 | 内容编辑 | **进行中**（已完成 M2.1 基本信息 + M2.2 工作经历 + M2.3 教育经历 + M2.4 项目经历） |
| M3 | 保存与恢复 | 未开始 |
| M4 | 模板切换（共 3 个模板） | 未开始 |
| M5 | 基础样式（主题色 / 字体 / 密度 / 头像） | 未开始 |
| M6 | PDF 导出 | 未开始 |

M0 ~ M6 全部通过后，才称为 MVP。M7（AI 内容辅助）与 M8（模板扩展）在 MVP 之后。

> M2 尚未通过验收。M2 的完整验收标准是「新增一条工作经历后预览立即出现、删除后预览消失」，需要教育 / 工作 / 项目 / 技能四类 CRUD 与 Section 显示隐藏，目前完成了基本信息编辑、工作经历 / 教育经历 / 项目经历 CRUD，技能 CRUD 与显示隐藏尚未开始。

### M0 交付了什么

一个最小可运行的项目骨架：

- React + TypeScript + Vite 项目初始化
- 基础路由与页面框架
- 按数据规范定义的 Resume 类型（Section 使用 discriminated union）
- 一份固定的中文示例简历数据
- 编辑器路由用于验证「类型定义 → 示例数据 → 页面读取」链路成立

### M1 交付了什么

第一个真实模板，证明结构化数据可以被稳定渲染成中文简历：

- 模板 `simple-single-column`（简约单栏），代码位于 `src/templates/`
- A4 纸面（`210mm` 宽、`min-height: 297mm`），内容超长时自然向下增长
- Section 按 `order` 排序、`visible === false` 不渲染、标题取自数据的 `title`
- 空字段不留多余分隔符；空 Section 连标题一起隐藏
- 模板只接收 `resume` prop，不读路由、不读存储、不自己取数

### M2.1 交付了什么（M2 进行中）

把编辑器从「只读预览」推进到「最小可编辑」，证明 **UI → React state → 模板** 这条链路成立：

- 编辑器页改为两栏：左侧 340px 基本信息表单，右侧 A4 预览
- 表单可编辑 5 个字段：姓名 / 目标岗位 / 手机 / 邮箱 / 城市（`profile` 的 4 项 + `targetRole`）
- 输入即改：改动进入 `EditorPage` 的 `Resume` state，模板随同一份数据重新渲染
- 状态更新全部走不可变展开，不修改传入对象；模块级 `sampleResume` 全程零污染
- 模板 `simple-single-column` 本次**一行未改**——只读预览与可编辑预览共用同一个模板

数据流：

```
sampleResume
    ↓ 作为 state 初始值（不做深拷贝）
EditorPage 的 resume state
    ├── 左侧 BasicInfoForm 通过 onChange 修改
    └── 右侧 SimpleSingleColumn(resume) 渲染
```

**本阶段没有持久化**：刷新后回到示例数据是正确行为，不是 bug。保存与恢复属于 M3。

### M2.2 交付了什么（M2 进行中）

给「工作经历」这一个 Section 做出了完整的增删改，证明 **内容数组的不可变更新 → 预览即时反映** 这条链路成立：

- 左侧在基本信息表单下方新增「工作经历」表单，只操作 `type === 'work'` 的 Section
- 单条工作经历可编辑 5 个字段：公司 / 职位 / 开始时间 / 结束时间 / 城市
- 每条工作经历的描述是 bullet 列表，可增删改每一条描述
- 可新增工作经历（追加到列表末尾，不排序）、删除整条经历
- 删除整条经历需要二次确认（`window.confirm`），取消则不发生任何变化；删除单条描述不需要确认
- 删到 0 条是允许的（得到一个空的工作经历模块，不会被自动删掉）
- 每条工作经历在创建时生成一个稳定 `id`，所有编辑 / 删除都按 `id` 定位，不按数组下标——删除中间一条后，其余条目与预览仍然正确对应
- 状态更新全部不可变：从 `resume` 根一路到目标字段，路径上每一层都产生新对象，未受影响的分支连引用都不变；模块级 `sampleResume` 全程零污染
- 模板 `simple-single-column` 本次只做了一处最小修正（React `key` 从数组下标改为条目 `id`），未改任何排版

数据流（工作经历部分）：

```
sampleResume
    ↓ 作为 state 初始值
EditorPage 的 resume state
    ├── 左侧 WorkExperienceForm 通过回调触发 workEdits 里的纯函数
    └── 右侧 SimpleSingleColumn(resume) 渲染
```

`src/pages/workEdits.ts` 是本次新增的纯函数模块（无状态、无副作用、无 IO），职责单一：接收一份 `Resume` 与定位参数，返回一份新的 `Resume`。它**只处理工作经历**，不涉及教育 / 项目 / 技能，也不是通用 reducer。

**本阶段同样没有持久化**：刷新后回到示例数据是正确行为。

### M2.3 交付了什么（M2 进行中）

给「教育经历」这一个 Section 做出了完整的增删改，结构与 M2.2 的工作经历一致：

- 左侧在工作经历表单下方新增「教育经历」表单，只操作 `type === 'education'` 的 Section
- 单条教育经历可编辑 6 个字段：学校 / 专业 / 学历 / 开始时间 / 结束时间 / 城市
- 每条教育经历的描述是 bullet 列表，可增删改每一条描述
- 可新增教育经历（追加到列表末尾，不排序）、删除整条经历
- 删除整条经历需要二次确认（`window.confirm`），取消则不发生任何变化；删除单条描述不需要确认
- 删到 0 条是允许的：左侧显示「暂无教育经历」并保留新增入口，右侧自动隐藏整个「教育经历」Section（含标题），Section 本身不被删除，用户可随时重新添加
- 每条教育经历同样使用稳定 `id`（`edu_` 前缀），编辑 / 删除按 `id` 定位
- 状态更新全部不可变，`sampleResume` 全程零污染

`src/pages/educationEdits.ts` 与 `src/components/EducationExperienceForm.tsx` 是本次新增的两个文件。它们与 work 版本**刻意保持为两套独立实现**，没有合并成通用层——理由见下方「核心设计决策」第 7 条。

### M2.4 交付了什么（M2 进行中）

给「项目经历」这一个 Section 做出了完整的增删改，与 M2.2 / M2.3 的结构一致：

- 左侧顺序为 基本信息 → 工作经历 → 教育经历 → 项目经历，只操作 `type === 'project'` 的 Section
- 单条项目经历可编辑 4 个字段：项目名称 / 角色 / 开始时间 / 结束时间
- **没有城市字段**——Schema 里 `ProjectItem` 不存在 `city`，不因为另外两类有就顺手加
- 每条项目经历的描述是 bullet 列表，可增删改
- 可新增项目（追加末尾，不排序）、删除整条项目；删除需要二次确认，取消不变；删 bullet 不确认
- 删到 0 条时左侧显示「暂无项目经历」并保留新增入口，右侧隐藏整个「项目经历」Section（含标题），Section 本身不被删除
- 稳定 `id`（`project_` 前缀），编辑 / 删除按 `id` 定位
- 状态更新全部不可变，`sampleResume` 全程零污染

同样刻意不与 work / education 合并，三套实现各自独立。

### 当前刻意没做什么

以下均为后续阶段内容，当前不存在：

- 技能的增删改（M2 剩余部分）
- Section 显示 / 隐藏开关（M2 剩余部分）
- 数据保存（LocalStorage / 数据库），刷新后数据会丢（M3）
- 模板切换、模板选择页、第二个模板（M4）
- 右侧样式设置栏、主题色 / 字体 / 密度的切换能力（M5）
- PDF 导出、分页边界（M6）
- AI 功能、登录、首页视觉设计
- 通用 Section 编辑器 / 通用 ExperienceForm（见决策第 7 条，当前刻意不做）

编辑器页当前能做的事有五件：**读取示例数据渲染 A4 预览**、**编辑 5 个基本信息字段**、**增删改工作经历 / 教育经历 / 项目经历（各含每条描述）**，所有改动实时反映在右侧预览上。它仍然没有技能编辑、没有 Section 显示隐藏、没有样式设置、没有保存。

---

## 快速开始

需要 Node.js 20.19+ 或 22.12+。

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

页面上的初始值都来自 `src/data/sampleResume.ts`。改该文件里 `profile.name` 的值，刷新页面即可看到变化——这是区分「真实读取数据」与「页面写死字符串」的关键。

M2.1 之后还可以这样验证「编辑链路」成立：

1. 打开 `/editor/resume_001`
2. 在左侧改姓名 / 目标岗位 / 手机 / 邮箱 / 城市，右侧 A4 预览应立刻跟着变
3. 把邮箱和城市都清空，联系方式行不应出现多余或连续的分隔符
4. 刷新页面，数据回到示例数据（M3 之前不保存，这是预期行为）

M2.2 之后可以这样验证「工作经历 CRUD」成立：

1. 点「新增一条工作经历」，列表末尾出现一条空经历，右侧预览同步多出该条
2. 填写公司 / 职位 / 开始时间 / 结束时间 / 城市，预览实时更新
3. 用「添加一条描述」给该条加 bullet，逐条输入，预览实时更新
4. 删除中间一条工作经历（会弹确认框）：点「取消」→ 列表与预览都不变；点「确定」→ 该条从表单与预览同时消失，其余条目内容不串位
5. 删除某条经历里的第 2 条描述，剩下描述的先后顺序与内容应保持正确
6. 把工作经历删到 0 条：得到一个空的工作经历模块，不会报错也不会自动移除该模块
7. 刷新页面，数据回到示例数据（M3 之前不保存，这是预期行为）

M2.3 之后可以这样验证「教育经历 CRUD」成立：

1. 左侧最下方是「教育经历」表单，改学校 / 专业 / 学历 / 城市 / 起止时间，预览实时更新
2. 点「+ 添加教育经历」，列表末尾出现空经历；填学校后预览出现（空条目不会在预览里渲染）
3. 用「添加一条描述」加 bullet，逐条输入，预览实时更新
4. 删除中间一条教育经历（会弹确认框）：点「取消」→ 表单与预览都不变；点「确定」→ 该条同时消失，剩余条目内容不串位
5. 删除某条经历里的第 2 条描述，剩下描述的先后顺序与内容应保持正确
6. 把教育经历全部删除：左侧显示「暂无教育经历」并仍保留新增按钮，右侧整个「教育经历」模块消失，可再点「+ 添加教育经历」恢复
7. 刷新页面，数据回到示例数据（M3 之前不保存，这是预期行为）

M2.4 之后可以这样验证「项目经历 CRUD」成立：

1. 左侧最下方是「项目经历」表单，示例数据有 **2 条**；改项目名称 / 角色 / 起止时间，预览实时更新
2. 点「+ 添加项目经历」，列表末尾出现空项目；填项目名称后预览出现
3. 用「添加一条描述」加 bullet，逐条输入，预览实时更新
4. 删除中间一条项目（会弹确认框）：点「取消」→ 表单与预览都不变；点「确定」→ 该条同时消失，剩余条目内容不串位
5. 删除某条项目里的第 2 条描述，剩下描述的顺序与内容应保持正确
6. 把 2 条项目全部删除：左侧显示「暂无项目经历」并保留新增按钮，右侧整个「项目经历」模块消失，可再点「+ 添加项目经历」恢复
7. 刷新页面，数据回到示例数据（M3 之前不保存，这是预期行为）

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
    │   ├── EditorPage.tsx    编辑器：持有 Resume state + 两栏布局
    │   ├── workEdits.ts      工作经历不可变更新纯函数（只处理 work Section）
    │   ├── educationEdits.ts 教育经历不可变更新纯函数（只处理 education Section）
    │   └── projectEdits.ts   项目经历不可变更新纯函数（只处理 project Section）
    ├── components/           可复用 UI 组件
    │   ├── BasicInfoForm.tsx
    │   ├── BasicInfoForm.module.css
    │   ├── WorkExperienceForm.tsx
    │   ├── WorkExperienceForm.module.css
    │   ├── EducationExperienceForm.tsx
    │   ├── EducationExperienceForm.module.css
    │   ├── ProjectExperienceForm.tsx
    │   └── ProjectExperienceForm.module.css
    ├── templates/            简历模板（只接收数据，负责排版）
    │   ├── SimpleSingleColumn.tsx
    │   └── SimpleSingleColumn.module.css
    └── styles/global.css
```

结构保持扁平。`templates/` 是在 M1 出现第一个真实模板需求时才建立的；`components/` 是在 M2.1 出现第一个「不属于某个页面独占」的组件时才建立的。两者都只包含当前实际需要的文件，没有提前划分 `hooks/`、`lib/` 等目录。目录分层随真实需求增长，而不是预先猜测。

职责边界：

- `EditorPage` 持有 `Resume` 状态并负责布局（不拆 Context / store / reducer）。
- `BasicInfoForm` 只负责受控输入与回调，**不持有 Resume 状态、不自己取数、不做校验**，也不是通用表单系统（没有字段注册表、没有 schema 驱动渲染）。
- `WorkExperienceForm` 同样只负责受控输入与回调，本轮只覆盖工作经历；它不知道数据从哪来、也不做校验，更不是通用的「Section 编辑器」。
- `EducationExperienceForm` 与 `WorkExperienceForm` 是两套独立实现，没有抽公共组件：职责边界相同（受控输入 + 回调，不持有状态、不取数、不校验），但字段与语义不同。是否值得共用要等 M2 走完再判断。
- `ProjectExperienceForm` 与前两个同理，是第三套独立实现。字段更少（无城市），进一步说明三类并不完全同构。
- `workEdits.ts` / `educationEdits.ts` / `projectEdits.ts` 都是无状态纯函数：`(Resume, 定位参数) → 新的 Resume`。只在找不到目标时原样返回传入的 `Resume`，绝不读写外部状态、不做 IO，也不承担持久化。三者刻意不共享代码。
- `SimpleSingleColumn`（模板）只通过 props 接收数据并渲染，不知道编辑器的存在。

路由：

| 路径 | 页面 | 状态 |
| --- | --- | --- |
| `/` | 我的简历 | 骨架 |
| `/new` | 新建简历 | 骨架 |
| `/editor/:resumeId` | 简历编辑器 | M2：基本信息 + 工作经历 / 教育经历 / 项目经历可编辑 + 实时预览（无持久化、无样式设置） |

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

### 5. 状态更新一律不可变

编辑路径上不存在任何原地修改：不直接给 `resume` / `profile` 的字段赋值，不用 `.push()` / `.splice()`，不 `.sort()` 原数组（模板排序前先 `.slice()` 复制）。

每次修改都返回新的 root / `profile` 对象，未受影响的字段（如 `sections`）连引用都保持不变。

这样做的直接收益是：模块级的 `sampleResume` 示例数据只作为初始值存在，编辑过程不会污染它，页面之间也不会互相影响。如果将来确实需要深拷贝，再单独评估引入时机。

### 6. 列表项按稳定 id 定位，不按数组下标

工作经历这类可增删的列表，每一项在创建时生成一个稳定 `id`。所有编辑 / 删除都靠 `id` 找到目标项，而不是靠它在数组里的位置。

原因是下标会随增删而变：删掉中间一条后，原本「第 3 条」会变成「第 2 条」，按下标定位就会改到错误的条目。React 的 `key` 同理——模板中列表的 `key` 使用条目 `id` 而非下标，保证增删后 DOM 节点与数据一一对应，不会串位。

`id` 采用「能用 `crypto.randomUUID()` 就用，否则用一个带时间戳与随机数的字符串兜底」的最小实现，不引入 uuid 依赖。bullet 描述因为 Schema 定义为 `string[]`（没有 id），列表 `key` 仍使用下标——这是当前数据结构的既定约束。

### 7. 重复优先于过早抽象

工作经历（M2.2）、教育经历（M2.3）与项目经历（M2.4）的编辑能力高度相似，但代码是**三套独立实现**，没有合并：

- 数据层：`workEdits.ts` / `educationEdits.ts` / `projectEdits.ts` 各自持有查找 / 写回与定位 helper，互不复用
- UI 层：三个 Form 各自持有字段表与删除文案，CSS Module 也是各自一份
- 编辑页：三组 6 个处理器分列，签名不同（`WorkItemTextField` / `EducationItemTextField` / `ProjectItemTextField`）

这不是遗漏，是有意为之。三者有结构共性（「按 id 定位单条并写回四层嵌套」与「列表 + bullet 的受控编辑」），但差异也是实的：work 是 公司 / 职位，education 是 学校 / 专业 / 学历，project 是 项目名称 / 角色且**没有城市**。字段集合连长度都不一致，说明它们不是同一个形状。

按 06 第 5 节的复杂度预算，抽象需要至少 2～3 个真实复用场景。现在三个样本都在手上，但 M2 本身还没走完：此时抽取通用层，会让四处代码（含尚未开始的技能）被隐式绑定，而收益主要是省行数——**先把重复留着，等 M2 全部四类 CRUD + 显示隐藏都验收通过后，再单独评估该抽哪一层**。届时重复代码本身就是判断依据。

这条决策与第 1 条（内容与模板分离）方向一致：两者都在避免「为了未来的可能需求，提前制造耦合」。

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

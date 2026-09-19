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
| M2 | 内容编辑 | **已完成** |
| M3 | 保存与恢复 | **已完成** |
| M4 | 模板切换（共 3 个模板） | **已完成** |
| M5 | 基础样式（主题色 / 字体 / 密度 / 头像） | **已完成** |
| M6 | PDF 导出 | **已完成** |
| M7.1 | 单条工作描述 AI 优化 | **待真实 Provider 验收** |

M0 ~ M6 全部通过，**MVP 正式完成**。M7.1 代码实现已落地，真实 DeepSeek 成功调用待补验。M7.2 及其后的 AI 能力、M8（模板扩展）尚未开始。

> M2 已通过验收：基本信息可编辑，教育 / 工作 / 项目 / 技能四类内容可增删改，每个模块可单独显示或隐藏，所有改动实时反映在右侧预览上。M2 当时还没有保存——刷新会回到示例数据，保存与恢复在 M3 完成。
>
> M3 已通过验收：编辑后自动把整份 Resume 存进浏览器 LocalStorage，**刷新 / 重新打开后恢复**。没有数据、坏数据、`id` 不符或 `schemaVersion` 不符时，一律回退到示例数据，并且不会删除存储里的旧值。仍然没有后端、数据库与账号。
>
> M4 已通过验收：**同一份 Resume 可以在三个模板之间自由切换，内容完全不丢**。三个模板为简约单栏（`simple-single-column`）、商务单栏（`business-single-column`）、左右双栏（`two-column`），在编辑器里切换（M4 时入口在预览区上方，M5 起移入右侧样式栏），切换后刷新仍然是所选模板。切换模板只改变 Resume 上的 `templateId` 这一个字段，不重建 `profile` / `sections` / `style`，也不按模板调整顺序或清理隐藏模块。仍然是「模板少而稳定」：没有缩略图、没有模板选择页、没有模板抽屉。
>
> M5 已通过验收：**简历的展示方式可以调整，内容一个字都不变**。右侧样式栏提供 4 项设置——主题色（5 个固定色）、字体（2 套中文组合）、密度（宽松 / 标准 / 紧凑）、显示头像开关；改动实时反映在预览上、自动保存、刷新后恢复。切换模板与调整样式是两件互相独立的事：改样式只重建 `style` 一个对象，`profile` / `sections` / `templateId` 连引用都不变。存储里出现不受支持的取值时（历史数据 / 手改），界面会明确告知并让预览走安全兜底，但**不自动改写数据、不写回存储**（展示层兜底 ≠ 数据迁移）。本轮**没有**头像上传入口、**没有**字体资产下载与嵌入、**没有**打印分页——那些分别属于后续阶段。

> M6 已通过验收：**简历能按 A4 打印成 PDF，中文字体不再由用户机器决定**。本阶段分两段落地。M6a 把「保存」从乐观假设改成结果驱动：只有真的写进 LocalStorage 才显示「已保存」，写入失败显示「保存失败」，编辑停止 300ms 后落盘，离开页面立即 flush。M6b 接上导出：工具栏右侧新增「导出 PDF」按钮，点击时先 `await document.fonts.ready` 再调 `window.print()`，交给浏览器原生打印出纸——**没有 PDF 库、没有 Canvas 截图、没有第二次渲染、没有 DOM 克隆、没有服务端 Chromium**。纸张与分页完全交给 CSS：`@page { size: A4; margin: 16mm 18mm }` 负责每页重复的页边距（模板纸面自身的 `padding` 不会跨页重复，所以打印时把纸面宽度 / 最小高度 / 内边距 / 阴影全部归零），三个模板各自补上 `break-inside: avoid-page` 与 `break-after: avoid-page`，保证模块标题不被孤立在页底、条目不被腰斩；左右双栏模板打印时**仍然保持双栏**，不为了分页悄悄退回单栏。中文字体改为自托管（`@fontsource-variable/noto-sans-sc` / `@fontsource-variable/noto-serif-sc`，字体名带 `Variable` 后缀），PDF 里嵌入的是 Noto 本身，而不是各人机器上的苹方 / 宋体。导出按钮**不改数据、不触发保存、不弹二次确认**，它只是把当前预览交给打印；工具栏会提示「打印时请选择『另存为 PDF』，并关闭『页眉和页脚』」。

> M7.1 已完成代码实现，除真实 Provider 成功调用外其余验收已通过：**工作描述可以逐条请求 AI 改写建议，建议在用户点「采用」之前不会动到任何数据**。每个工作描述输入框旁多了一个「AI 优化」按钮，点击后由**服务端**调用 DeepSeek（模型 `deepseek-flash`，显式关闭思考模式）返回一条改写建议；建议以虚线面板形式展示在那一行下方，用户点「采用」才写回，点「取消」或什么都不做则 Resume 与 LocalStorage 全程 0 改动。为此引入了**一个最小的可信 Node server 边界**：浏览器请求同源的 `POST /api/ai/optimize-work-bullet`，只有 `{ text }` 一个字段；API key 只存在于服务端环境变量，浏览器侧代码与构建产物里都没有 provider 域名与密钥。并发上故意做得很窄——**全组件同时只允许 1 个 AI 请求在途**（请求期间只锁 AI 按钮，输入框与删除照常可用），因此结构上不存在乱序响应，也就不需要请求序号或结果丢弃逻辑。采用前会重新校验「这条 item 还在 / 下标仍合法 / 内容仍是发请求时的那段文字」，任一不成立就提示重新优化而**绝不猜位置**。M7.1 只做这一件事：**没有** AI 对话、整份简历生成、JD 分析、其他 Section 的 AI、流式输出、多 provider、prompt 编辑器或 AI 历史。

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

### M2.1 交付了什么

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

### M2.2 交付了什么

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

### M2.3 交付了什么

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

### M2.4 交付了什么

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

- 模板选择页、模板缩略图、模板抽屉、超过三个模板、模板元数据 / 注册表系统（M8）
- 主题变体（色 × 模板组合成卡片）（M8）；字体已自托管并嵌入 PDF，但没有「上传自己的字体」，也没有超出 2 套组合的字号 / 行距微调
- 头像上传入口：`ResumeProfile.avatar` 字段一直在数据结构里，但当前 UI 不提供上传，只提供「显示 / 不显示」开关
- 用户自定义颜色 / 字号：主题色是固定 5 色，密度是固定 3 档，不给用户逐个调数值
- Section 排序、Section 新增 / 删除
- AI 能力里除「工作描述单条改写」以外的一切：AI 对话、整份简历生成、JD 分析、教育 / 项目 / 技能 Section 的 AI、从空白生成 bullet、流式输出、多 provider 与 provider fallback、prompt 编辑器、AI 历史、用量面板（M7.1 只做了第一条，其余属于后续）
- 登录、首页视觉设计
- 通用 Section 编辑器 / 通用 ExperienceForm（见决策第 7 条，当前刻意不做）

编辑器页当前支持：**读取示例数据渲染 A4 预览**、**编辑 5 个基本信息字段**、**增删改工作经历 / 教育经历 / 项目经历（各含每条描述）**、**增删改技能**、**单独显示 / 隐藏任一内容模块**、**在三个模板之间切换**、**调整主题色 / 字体 / 密度 / 是否显示头像**、**把改动自动存进浏览器、刷新后恢复**、**导出 PDF**、**对单条工作描述请求 AI 改写建议并选择是否采用**，所有改动实时反映在中间预览上。它仍然没有头像上传入口，也没有打印设置面板——导出完全走浏览器原生打印对话框，页面不接管纸张 / 缩放 / 页边距。

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
npm run dev:api     # 启动服务端（M7.1 起，AI 功能需要；从 server/.env 读取 key，该文件必须存在）
npm start           # 生产模式：同一个进程托管 dist/ 与 /api，key 由运行环境注入（不读 server/.env）
```

M0～M6 的功能只用 `npm run dev` 就够。**AI 优化（M7.1）需要同时跑 `dev:api`**，并在 `server/.env` 里配置 `DEEPSEEK_API_KEY`（该文件已被 `.gitignore` 覆盖，见下方「验证工作描述 AI 优化」）。`dev:api` 要求 `server/.env` **存在**，缺文件会在启动时报错——本地要用 AI 本来就得先建这个文件；生产态不走这条路径（见下）。

### 验证数据链路确实成立

页面上的初始值有两个来源：浏览器里已保存的数据优先，没有可用数据时才回退到 `src/data/sampleResume.ts`。

想验证「数据是真的被读取、而不是页面写死字符串」：先在开发者工具里删掉该简历的 LocalStorage 项（key 为 `resume-generator:resume:resume_001`），再改 `src/data/sampleResume.ts` 里 `profile.name` 的值，刷新页面即可看到变化。

M2.1 之后还可以这样验证「编辑链路」成立：

1. 打开 `/editor/resume_001`
2. 在左侧改姓名 / 目标岗位 / 手机 / 邮箱 / 城市，右侧 A4 预览应立刻跟着变
3. 把邮箱和城市都清空，联系方式行不应出现多余或连续的分隔符
4. 刷新页面，改动仍然保留（M3 起会自动保存）。想回到示例数据，在开发者工具里删掉 `resume-generator:resume:resume_001` 再刷新

M2.2 之后可以这样验证「工作经历 CRUD」成立：

1. 点「新增一条工作经历」，列表末尾出现一条空经历，右侧预览同步多出该条
2. 填写公司 / 职位 / 开始时间 / 结束时间 / 城市，预览实时更新
3. 用「添加一条描述」给该条加 bullet，逐条输入，预览实时更新
4. 删除中间一条工作经历（会弹确认框）：点「取消」→ 列表与预览都不变；点「确定」→ 该条从表单与预览同时消失，其余条目内容不串位
5. 删除某条经历里的第 2 条描述，剩下描述的先后顺序与内容应保持正确
6. 把工作经历删到 0 条：得到一个空的工作经历模块，不会报错也不会自动移除该模块
7. 刷新页面，改动仍然保留（M3 起会自动保存）。想回到示例数据，在开发者工具里删掉 `resume-generator:resume:resume_001` 再刷新

M2.3 之后可以这样验证「教育经历 CRUD」成立：

1. 左侧「教育经历」表单中，修改学校 / 专业 / 学历 / 城市 / 起止时间，预览实时更新
2. 点「+ 添加教育经历」，列表末尾出现空经历；填学校后预览出现（空条目不会在预览里渲染）
3. 用「添加一条描述」加 bullet，逐条输入，预览实时更新
4. 删除中间一条教育经历（会弹确认框）：点「取消」→ 表单与预览都不变；点「确定」→ 该条同时消失，剩余条目内容不串位
5. 删除某条经历里的第 2 条描述，剩下描述的先后顺序与内容应保持正确
6. 把教育经历全部删除：左侧显示「暂无教育经历」并仍保留新增按钮，右侧整个「教育经历」模块消失，可再点「+ 添加教育经历」恢复
7. 刷新页面，改动仍然保留（M3 起会自动保存）。想回到示例数据，在开发者工具里删掉 `resume-generator:resume:resume_001` 再刷新

M2.4 之后可以这样验证「项目经历 CRUD」成立：

1. 左侧「项目经历」表单中，示例数据有 **2 条**；修改项目名称 / 角色 / 起止时间，预览实时更新
2. 点「+ 添加项目经历」，列表末尾出现空项目；填项目名称后预览出现
3. 用「添加一条描述」加 bullet，逐条输入，预览实时更新
4. 删除中间一条项目（会弹确认框）：点「取消」→ 表单与预览都不变；点「确定」→ 该条同时消失，剩余条目内容不串位
5. 删除某条项目里的第 2 条描述，剩下描述的顺序与内容应保持正确
6. 把 2 条项目全部删除：左侧显示「暂无项目经历」并保留新增按钮，右侧整个「项目经历」模块消失，可再点「+ 添加项目经历」恢复
7. 刷新页面，改动仍然保留（M3 起会自动保存）。想回到示例数据，在开发者工具里删掉 `resume-generator:resume:resume_001` 再刷新

### 验证 PDF 导出（M6b）

1. 打开 `/editor/resume_001`，点工具栏右上角「导出 PDF」
2. 在弹出的打印对话框里把目标改成「另存为 PDF」，并**关闭「页眉和页脚」**——否则每页会多出网址与页码，那是浏览器加的，不是页面的
3. 打开保存下来的 PDF，逐项确认：纸张是 A4、四边都有页边距、中文是正常字重而不是衬线回退、左侧表单与顶部工具栏**没有**印到纸上、内容超过一页时是分页而不是被裁掉
4. 想验证分页：把某条工作经历的描述复制成十几条，再导出一次，应得到 2 页以上，且没有哪一行压在页边距之外

导出走的是浏览器原生打印，**打印对话框长什么样由浏览器决定**，页面不接管、也不提供纸张 / 缩放 / 页边距设置。Chrome 与 Edge 直接有「另存为 PDF」；Safari 需要在打印预览左下角点「PDF → 存储为 PDF」。M6b 验收用的就是这条真实路径（真跑 Chromium → 原生打印出 PDF → 用 poppler 工具核验纸张 / 页数 / 中文可提取 / UI 文案未泄漏 / 每页页边距 / PDF 内嵌字体为 Noto）。

### 验证工作描述 AI 优化（M7.1）

AI 功能需要服务端持有 API key，因此比前几个阶段多一步准备。

**准备**：在 `server/.env`（已被 `.gitignore` 覆盖）里写入 `DEEPSEEK_API_KEY=你的真实 key`。该文件不会被提交，也不会进构建产物。

注意：Node 的 `--env-file` **不覆盖已存在的环境变量**——如果 shell / IDE 里已经导出了 `DEEPSEEK_API_KEY`，它会盖过 `server/.env` 里的值。改完 key 记得同时确认环境变量，否则会以为改了没生效。

**开发态**（两个进程，分别开一个终端）——key 来自 `server/.env`：

```bash
npm run dev       # Vite，5173；/api 会转发到 8787
npm run dev:api   # 最小 Node server，8787，用 --env-file 显式加载 server/.env
```

**生产态**（同一个进程同时托管 dist 与 /api）——key 由**运行环境注入**，服务端读的是 `process.env.DEEPSEEK_API_KEY`：

```bash
npm run build
DEEPSEEK_API_KEY=... npm start
```

`npm start` **不会**去读 `server/.env`。生产环境请用部署平台的环境变量 / secret 注入，例如 `systemd` 的 `Environment=` / `EnvironmentFile=`、容器 secret、或托管平台的环境变量设置。服务端在**缺少 key 时仍然启动**，只有 AI 端点在请求时返回失败（前端显示「优化失败，请重试。」），其余页面与静态资源不受影响。

然后打开 `/editor/resume_001`，展开「工作经历」：

1. 任一**非空**描述右侧点「AI 优化」→ 该按钮变成「优化中…」，其余 AI 按钮同时变灰（但输入框、删除按钮、其他模块照常可用）
2. 成功后该行下方出现虚线面板，显示「AI 建议」+ 建议文本 + 「采用」「取消」
3. 点「采用」→ 输入框与右侧预览立即换成建议文本，稍后自动保存；**刷新后仍是采用后的内容**
4. 换个描述再试一次，这次点「取消」→ 面板消失，输入框与预览都不变
5. 把一条描述**清空**→ 它的「AI 优化」按钮变灰（空内容没有可改写的东西）
6. 验证「不会写错内容」：点「AI 优化」后趁着「优化中…」，立刻改掉那一行的文字；等建议出现再点「采用」→ 应提示「原内容已发生变化，请重新优化。」，**而不是**把建议写到别的行
7. 验证失败路径：把 `server/.env` 里的 key 改成一个无效值并重启 `dev:api` → 点击后显示「优化失败，请重试。」，输入框与预览都不受影响，按钮恢复可点

**关于额度与限流**：服务端有一个进程级总闸（30 请求 / 分钟），超出的请求返回 429，**前端与其它失败一样显示同一句「优化失败，请重试。」**。这只是防止公开 endpoint 被瞬时刷爆的下限保护，不是配额系统——进程重启即清零，多实例部署时每个实例各有一份独立计数。真正多用户部署时需要重新设计这一层。

---

## 技术栈

| 类别 | 选型 |
| --- | --- |
| 框架 | React 19 |
| 语言 | TypeScript 7 |
| 构建 | Vite 8 |
| 路由 | React Router 7（Declarative / `BrowserRouter`） |
| 样式 | 普通 CSS 与 CSS Modules |
| 中文字体 | `@fontsource-variable/noto-sans-sc` / `@fontsource-variable/noto-serif-sc`（自托管，可变字重；按 `unicode-range` 分片，浏览器只取用到的字形） |
| 服务端（M7.1 起） | 一个最小的 Node 服务（`server/`）：只用 `node:http` / `node:fs` / `node:path` 与全局 `fetch`，**零框架、零数据库、零 AI SDK**。它存在的唯一理由是让 DeepSeek 的 API key 留在服务端，顺带托管 `dist/` |
| AI provider | DeepSeek（`POST https://api.deepseek.com/chat/completions`，模型 `deepseek-flash`，显式 `thinking: { type: 'disabled' }`）。provider 域名只出现在服务端代码里 |

### 当前阶段明确不引入

Next.js、Redux、Zustand、Tailwind、shadcn/ui、Material UI / Ant Design、大型表单框架、数据库、ORM、Office / Word 相关依赖、Canvas 编辑器、PDF 相关库。

这些都是**有意不引入**的。项目遵循一条原则：真正的需求出现之前，不提前引入依赖，也不提前做架构决策。后续阶段确实需要时，再按实际需求单独评估。

> **关于「后端服务」这条**：M0～M6 当时写的是「刻意不引入后端服务」，那时它准确——整个应用是纯静态的，没有任何服务端代码。**从 M7.1 起这条不再成立**：为了不让 AI provider 的密钥进入浏览器（一旦进入就等于公开），引入了一个最小的 Node server boundary，由它持有 key 并转发请求。但边界刻意收得很紧——没有框架、没有数据库、没有用户体系、没有 session，只有一个 API 端点加静态托管；`src/` 下不读任何 secret，客户端环境变量（`VITE_*`）与本项目无关。

---

## 目录结构

```
.
├── docs/ai-context/          项目规格与长期上下文（正式文档，见下方索引）
├── server/                   服务端（M7.1 起）：最小可信边界，持有 AI provider 密钥
│   ├── index.mjs             HTTP 入口：/api 路由 + dist/ 静态托管 + 限流 + 日志边界
│   └── optimizeWorkBullet.mjs DeepSeek 调用的唯一实现：校验 / 固定 prompt / 清洗 / 数字保护
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.tsx              入口：BrowserRouter 包裹 App + 自托管中文字体引入（必须早于 global.css）
    ├── App.tsx               路由表
    ├── types/resume.ts       Resume 数据结构类型定义
    ├── data/sampleResume.ts  固定中文示例简历数据
    ├── storage/resumeStorage.ts  浏览器持久化边界：整份 Resume 的 LocalStorage 存取
    ├── ai/                   浏览器侧的 AI 边界（M7.1）
    │   └── optimizeWorkBullet.ts 只做 POST 同源 /api + 取 suggestion 的 HTTP 客户端
    ├── pages/                页面组件
    │   ├── MyResumesPage.tsx
    │   ├── NewResumePage.tsx
    │   ├── EditorPage.tsx    编辑器：持有 Resume state + 三栏布局
    │   ├── workEdits.ts      工作经历不可变更新纯函数（只处理 work Section）
    │   ├── educationEdits.ts 教育经历不可变更新纯函数（只处理 education Section）
    │   ├── projectEdits.ts   项目经历不可变更新纯函数（只处理 project Section）
    │   ├── skillsEdits.ts    技能不可变更新纯函数（只处理 skills Section）
    │   └── sectionVisibility.ts  Section 显隐纯函数（只改 Section 外壳的 visible）
    ├── components/           可复用 UI 组件
    │   ├── BasicInfoForm.tsx
    │   ├── BasicInfoForm.module.css
    │   ├── SectionVisibilityControls.tsx
    │   ├── SectionVisibilityControls.module.css
    │   ├── WorkExperienceForm.tsx
    │   ├── WorkExperienceForm.module.css
    │   ├── EducationExperienceForm.tsx
    │   ├── EducationExperienceForm.module.css
    │   ├── ProjectExperienceForm.tsx
    │   ├── ProjectExperienceForm.module.css
    │   ├── SkillsForm.tsx
    │   ├── SkillsForm.module.css
    │   ├── TemplateSwitcher.tsx         模板选择控件（受控 select，只改 templateId）
    │   ├── TemplateSwitcher.module.css
    │   ├── StyleControls.tsx            样式设置控件（主题色 / 字体 / 密度 / 显示头像，只改 style）
    │   └── StyleControls.module.css
    ├── templates/            简历模板与模板分发器（只接收数据，负责排版）
    │   ├── ResumeTemplateRenderer.tsx        分发器：按 templateId 显式 switch 到对应模板
    │   ├── templateStyleTokens.ts            样式 token → CSS 自定义属性的共享解析（无 UI 依赖）
    │   ├── SimpleSingleColumn.tsx            简约单栏（simple-single-column）
    │   ├── SimpleSingleColumn.module.css
    │   ├── BusinessSingleColumn.tsx          商务单栏（business-single-column）
    │   ├── BusinessSingleColumn.module.css
    │   ├── TwoColumn.tsx                     左右双栏（two-column）
    │   └── TwoColumn.module.css
    └── styles/global.css      全局样式，含 @page（A4 / 16mm 18mm）与打印时的外壳重置
```

结构保持扁平。`templates/` 是在 M1 出现第一个真实模板需求时才建立的；`components/` 是在 M2.1 出现第一个「不属于某个页面独占」的组件时才建立的；`ai/` 与 `server/` 是在 M7.1 出现第一个「必须由服务端持有密钥」的需求时才建立的。它们都只包含当前实际需要的文件，没有提前划分 `hooks/`、`lib/` 等目录。目录分层随真实需求增长，而不是预先猜测。

职责边界：

- `EditorPage` 持有 `Resume` 状态并负责布局（不拆 Context / store / reducer）。
- `BasicInfoForm` 只负责受控输入与回调，**不持有 Resume 状态、不自己取数、不做校验**，也不是通用表单系统（没有字段注册表、没有 schema 驱动渲染）。
- `WorkExperienceForm` 同样只负责受控输入与回调，本轮只覆盖工作经历；它不知道数据从哪来、也不做校验，更不是通用的「Section 编辑器」。M7.1 的 AI 优化把它从「纯受控输入」推进到**持有 AI 瞬态状态**（idle / loading / success / error）：这类状态只描述这一屏正在发生什么，不属于简历数据，因此留在组件里；但**网络请求本身不在组件内**——它只调用 `onOptimizeBullet` 这个 prop，由页面决定怎么发。建议在用户点「采用」之前不进 Resume，采用时也只回调既有的 `onChangeBullet`，没有新增写入路径。
- `ai/optimizeWorkBullet.ts` 是浏览器侧唯一的 HTTP 边界：只发同源相对路径、只取 `suggestion`。它**不认识 provider 域名**，也没有 `AIService` 类、provider 接口、重试框架或通用 API client。
- `server/optimizeWorkBullet.mjs` 是整个仓库**唯一**出现 provider 域名与密钥的地方。它不认识 HTTP（不写 header、不决定状态码），也不认识 Resume（不 import 前端类型）。prompt、model、`thinking`、输出上限全部固定在服务端，客户端无法覆盖。
- `server/index.mjs` 是 HTTP 层：`/api/*` 优先路由、`dist/` 静态托管（带路径越界防护与 SPA 回退）、进程级限流、日志边界。它**不是 web framework**——没有路由表、没有中间件栈、没有 body parser 依赖，也不读数据库 / session / cookie。静态托管的越界防线只有一条：**解析后的绝对路径必须仍在 `dist/` 内**，因此 `server/`、`.env`、`.git/` 从结构上就不可能被读到。
- `EducationExperienceForm` 与 `WorkExperienceForm` 是两套独立实现，没有抽公共组件：职责边界相同（受控输入 + 回调，不持有状态、不取数、不校验），但字段与语义不同。M2 总验收后仍维持两套独立实现，不合并（理由见下方第 7 条决策）。
- `ProjectExperienceForm` 与前两个同理，是第三套独立实现。字段更少（无城市），进一步说明三类并不完全同构。
- `SkillsForm` 是第一个**异形**实现：`SkillItem` 只有 `name` / `level` 两个字符串，没有 description 数组，因此它没有描述要点区块，也**没有删除确认**（05 第 11 节的删除保护只针对工作经历、项目经历这类重要内容）。它是全部四个表单中最短的一个。
- `workEdits.ts` / `educationEdits.ts` / `projectEdits.ts` / `skillsEdits.ts` 都是无状态纯函数：`(Resume, 定位参数) → 新的 Resume`。只在找不到目标时原样返回传入的 `Resume`，绝不读写外部状态、不做 IO，也不承担持久化。四者刻意不共享代码。
- `sectionVisibility.ts` 是唯一一个**真正通用**的 Section 操作：`visible` 是 `SectionBase` 上真实定义的字段，四类 Section 都拥有它，所以一个 `setSectionVisible(resume, sectionId, visible)` 覆盖全部四类，不需要 `type` 参数、不需要按类型分家（不存在 `setWorkVisible` 这类函数）。通用性来自 Schema 已经先统一了，不是来自"四个 CRUD 看起来像"。
- `SectionVisibilityControls` 只依赖 `SectionBase` 共有的 `id` / `title` / `visible`，按传入的 `sections` 顺序渲染，标题直接取 `section.title`（没有 type → 中文名的映射表，也没有写死四个固定项）。
- `ResumeTemplateRenderer`（分发器）是预览侧唯一的模板入口：只接收 `resume`，读 `templateId` 后用一个**显式 `switch`** 渲染对应模板，不持状态、不取数、不读存储、不排序、不改数据。它**不是**模板注册中心——没有 id → 组件表、没有模板元数据、没有动态加载。未知 `templateId` 走 `default` 回退到简约单栏，只影响展示，不改数据、不写存储。
- `SimpleSingleColumn` / `BusinessSingleColumn` / `TwoColumn`（三个模板）都只通过 props 接收数据并渲染，不知道编辑器的存在，也不知道彼此的存在。`visible` 过滤、`order` 排序与空 Section 隐藏是三者一致的行为，差异**全部集中在展示方式**——不引入模板专属数据字段，也不改 Schema。三者共用的 `buildEntries` / `isNonEmpty` / `formatDate` 等 helper **各自留一份，不抽公共 util**（M2 总验收时已确立「有 2~3 个真实复用场景才抽象」，同理适用于模板层）。
- `TwoColumn` 的列分配（技能与联系方式进左栏，教育 / 工作 / 项目进右栏）是**模板内部的展示规则**，不写进数据、不新增 `layout` / `column` 字段、不重排 `resume.sections`；右栏内部仍然按 `order` 排序。左栏确实没有任何可渲染内容时，正文退回单栏，不保留一条空的窄栏。
- `TemplateSwitcher` 是受控组件：当前值来自 props，变化时上抛回调，**不持有状态、不读路由、不读存储、不修改 Resume、不自动修复未知 `templateId`**（展示层回退不等于数据迁移）。它只有三个硬编码 option；`TEMPLATE_OPTIONS` 这类模板元数据表属于 M8。M5 起它与样式设置同处右侧样式栏，因此它的样式从横向工具条改成了竖排块——组件本身一行未改，只是换了摆放位置；原来预览区上方那条 `previewToolbar` 已删除，模板切换**只有一个入口**。
- `StyleControls` 同样是受控组件：当前值来自 `props.style`，每次改动上抛一个 **`StyleChange` 判别联合**（`themeColor` / `fontFamily` / `density` / `showAvatar` 四个真实字段），**不是通用 path setter**——没有字段名字符串、没有 `keyof` 遍历、没有动态索引。它不持有状态、不读路由、不读写存储、不 import 示例数据、不修改 Resume，也不提供头像输入入口。它额外接收一个 `hasAvatar: boolean`（由 `EditorPage` 计算，只有页面拿得到完整 Resume），用于显示一句说明文字；**即使没有头像数据，开关也不 disabled**——那是一个真实的设置项，只是当前没有内容可供显示。中文标签（深蓝 / 传统衬线 / 宽松 …）留在组件里，不放进 token 模块。
- `templateStyleTokens.ts` 是三个模板**唯一共用的样式入口**，职责只有「支持集合 + token → 实际 CSS 值」：输入是 `Resume.style` 里的选项名（`navy` / `noto-sans-sc` / `standard`），输出是 6 个 CSS 自定义属性（`--accent` / `--resume-font-family` / `--resume-body-size` / `--resume-line-height` / `--resume-section-gap` / `--resume-item-gap`）。它不持有状态、无副作用、不读存储 / 路由、零 React 依赖、不 import 任何模板，因此既可以被三个模板共用，也可以被测试直接调用。它**不是**样式设置页面的 metadata 系统：中文标签与控件布局属于 `StyleControls`。三个模板各存一份映射等于 5 色 + 2 字体 + 3 密度共 30 个值要手动同步，漏一处就是三个模板显示不一致——这是它被共享、而 `buildEntries` 那类渲染 helper 仍各自留一份的原因。
- `templateStyleTokens` 对**未知取值一律自兜底**：`storage/resumeStorage.ts` 只确认 `style` 是对象、**不逐字段校验取值**，所以存储里完全可能出现 `density: "tiny"`。三个解析函数因此都**不调用传入值上的任何方法**（不 `.trim()`、不 `.toLowerCase()`），一律用相等比较判断，传入数字 / `null` / 对象时只会「不匹配」而不会抛错，最终落到深蓝 + 无衬线 + 标准档。兜底只影响展示：**不修改 Resume、不写回 storage、不做 migration**（与 M4 未知 `templateId` 同一条原则）。
- M5 之前的三个模板各自写着一份 `THEME_COLORS` / `FALLBACK_ACCENT`，那三份已删除，主题色 / 字体 / 密度统一由 `getTemplateStyleVariables(resume.style)` 解析成 CSS 自定义属性写在各自 `<article>` 上，再由 `.module.css` 消费。**为什么必须走 CSS 自定义属性**：只把字号设在 `.paper` 上不生效——子元素自己有 `font-size` 声明时父级字号不会覆盖它，密度改了也看不出来；自定义属性会继承，写在一处、全部后代都能 `var()` 消费，正文 / 模块标题 / 条目 / bullet / 技能才会真正跟着密度变。每个 `var()` 都带 fallback 且 fallback 就是标准档的值，因此变量缺失时纸面也不塌。姓名这类模板固有层级字号（26px / 25px / 24px）不随密度变化，比正文大或小的强调字号用 `calc(var(--resume-body-size) ± Npx)` 派生——标准档下与 M5 之前的像素值一致，同时能跟着密度缩放。
- 头像：三个模板都按 `resume.style.showAvatar === true && isNonEmpty(profile.avatar)` 渲染 `<img>`（复用各模板已有的安全 `isNonEmpty`，**不直接对 `avatar` 调 `.trim()`**——历史存储里可能是 `{"avatar": 123}`，`123.trim()` 会让模板崩溃）。头像的形状与位置属于模板：简约单栏居中在姓名上方，商务单栏与左右双栏在 header 右侧与姓名同一行，靠 `headerTop` 容器成组；姓名与头像都没有时不产生空容器。
- `SimpleSingleColumn` 的 `visible` 过滤与空 Section 隐藏是 M1 就有的行为——M2.6 没有改模板一行，只是接通了「勾选框 → state → 模板」这条链路。M4 也未改动它：新增两个模板是通过 `ResumeTemplateRenderer` 接入的，原有的简约单栏一行未改。

路由：

| 路径 | 页面 | 状态 |
| --- | --- | --- |
| `/` | 我的简历 | 骨架 |
| `/new` | 新建简历 | 骨架 |
| `/editor/:resumeId` | 简历编辑器 | M6：内容可编辑 + 三模板切换 + 主题色 / 字体 / 密度 / 头像开关 + 实时预览，改动自动保存、刷新后恢复，导出 PDF（无头像上传） |

---

## 核心设计决策

这几条决定了项目的长期形态，也是审阅代码时的关键背景。

### 1. 内容与模板分离

同一份简历数据可以被任意模板渲染。模板是「如何展示数据」的渲染组件，不拥有独立的数据副本。

- 切换模板只改变 `templateId`，**不得**修改 `sections` 内容。
- 模板不新增专属业务字段，不为模板修改数据结构。

这条承诺在 M4 被真实检验过：三个模板由同一份 Resume 驱动，切换时只新建一个 root 对象（`{ ...resume, templateId }`），`profile` / `sections` / `style` 连引用都不变；往返切换任意次后，内容与最初逐字节一致。

M5 检验的是它的对称面：**调整样式同样不碰内容**。改主题色 / 字体 / 密度 / 头像开关只新建 `{ ...resume, style }`，`profile` / `sections` / `templateId` 连引用都不变，而且渲染结果在去掉内联样式属性后逐字节一致——「改展示方式不改内容」这条承诺在切换模板与调整样式两个方向上都被验证过。

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

工作经历（M2.2）、教育经历（M2.3）与项目经历（M2.4）的编辑能力高度相似，但代码是**三套独立实现**，没有合并；技能（M2.5）也是独立一套，而它本身形状就更简单。

- 数据层：`workEdits.ts` / `educationEdits.ts` / `projectEdits.ts` / `skillsEdits.ts` 各自持有查找 / 写回与定位 helper，互不复用
- UI 层：四个 Form 各自持有字段表，CSS Module 也是各自一份；前三个还各自持有删除文案，`SkillsForm` 没有（删除技能不需要确认），也是四个里最短的一个
- 编辑页：前三组各 6 个处理器分列，技能只有 3 个，签名不同（`WorkItemTextField` / `EducationItemTextField` / `ProjectItemTextField` / `SkillItemTextField`）

这不是遗漏，是有意为之。三类经历有结构共性（「按 id 定位单条并写回四层嵌套」与「列表 + bullet 的受控编辑」），但差异也是实的：work 是 公司 / 职位，education 是 学校 / 专业 / 学历，project 是 项目名称 / 角色且**没有城市**。字段集合连长度都不一致，说明它们不是同一个形状。技能更进一步：`SkillItem` 只有两个字符串字段，连 description 层都没有。

按 06 第 5 节的复杂度预算，抽象需要至少 2～3 个真实复用场景。四类 Section 的真实编辑形状现在都已出现，M2 也已完成并通过总验收。**经过四类真实 CRUD 实现后，目前仍不为了减少行数而合并成通用 CRUD / ExperienceForm；现有重复保持可控。后续只有出现真实的跨类型共同修改需求时，再重新评估公共层。**重复代码本身就是判断依据。

这条决策与第 1 条（内容与模板分离）方向一致：两者都在避免「为了未来的可能需求，提前制造耦合」。

### 8. AI 密钥不进浏览器，只为这一件事引入服务端

M7.1 起项目不再是纯静态应用：为了调用 AI provider，引入了一个最小的 Node server boundary。

理由只有一条：**API key 一旦进入浏览器就等于公开**——它会出现在构建产物、DevTools 和任何一次抓包里。所以 key 只存在于服务端环境变量，浏览器侧永远只请求同源的 `/api/ai/optimize-work-bullet`，请求体只有 `{ text }` 一个字段。

边界刻意收得很紧，避免它长成一个「后端」：

- 没有框架、数据库、ORM、用户体系、session、cookie；零新增 npm 依赖
- 只有一个 API 端点 + `dist/` 静态托管；provider 域名只出现在 `server/optimizeWorkBullet.mjs`
- prompt、模型、`thinking`、输出上限全部固定在服务端，客户端无法覆盖
- 建议是**瞬态**的：用户点「采用」之前 Resume 与 LocalStorage 都是 0 改动，采用走的也是既有的 `updateWorkBullet`，没有第二条写入路径

并发与额度上故意选了最简单的做法：全组件同时只允许 1 个 AI 请求在途（结构上消灭乱序，因此不需要请求序号或结果丢弃逻辑），服务端另有一个进程级固定窗口总闸（30 请求 / 分钟）。两者都**不是**面向多用户的最终方案，只是当前阶段够用的下限保护；真正多用户部署时需重新设计这两层。

安全边界只有一条：静态托管解析出的绝对路径**必须仍在 `dist/` 内**。`server/`、`server/.env`、`.git/` 因此从结构上就不可能被读到。

正确性边界也只有一条：**绝不写错内容**。采用前重新校验「item 还在 / 下标仍合法 / 内容仍是发请求时那段文字」，任一不成立就提示重新优化，绝不猜位置。

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

import type { Resume } from '../types/resume';

/**
 * Section 显示 / 隐藏的不可变更新函数。
 *
 * ## 为什么这里可以是一个通用函数，而四个 item CRUD 不行
 *
 * 判断标准不是「几套代码看起来像不像」，而是**共同点由谁保证**。
 *
 * `visible` 是 `SectionBase` 上真实定义的字段，四类 Section 都通过
 * `extends SectionBase` **真的拥有它**。所以本函数只需要知道「一个 Section
 * 有 id / title / visible / order」，不需要知道自己在处理 education 还是 work：
 * 它没有 `type` 参数、没有配置对象、没有任何按类型分支。通用性来自
 * **Schema 已经先统一了**，代码只是服从它。
 *
 * 四个 item CRUD 恰好相反：它们改的是 `items`，而 WorkItem / EducationItem /
 * ProjectItem / SkillItem 是四个彼此独立的接口，**没有共同基类**。要通用就必须
 * 引入 sectionType 参数与字段名联合类型，那是「用配置去描述差异」——发明抽象，
 * 而不是服从 Schema。
 *
 * 另外一点：`visible` 只在 Section 外壳上，不在 items 上。所以这一个函数就覆盖
 * 全部四类，四个 edits 文件一个字都不用改；也不应出现
 * setWorkVisible / setEducationVisible / setProjectVisible / setSkillsVisible。
 *
 * ## 职责边界
 *
 * - 只改 Section 外壳的 `visible`，不碰 `items`。
 * - 不做排序、不新增 / 删除 Section、不改 id / title / order。
 * - 不含 UI 逻辑。切换显隐**不需要确认**（显隐不是删除，用户随时可以重新打开）。
 * - 没有 reducer / action / path setter / registry / service / hook。
 *
 * 依据：docs/ai-context/03_RESUME_DATA_SCHEMA.md 第 4 节、
 *      05_EDITOR_UX_SPEC.md 第 10 节、06_AI_DEVELOPMENT_PROTOCOL.md 第 5 节
 */

/**
 * 设置某个 Section 是否显示在简历输出中。
 *
 * 返回语义（两种「没有变化」的情况都返回**原 Resume 引用**，
 * 这样 React 不会产生无意义的 state 更新，也方便调用方用 `===` 判断是否需要重渲染）：
 *
 * - 找不到 `sectionId`：返回原 Resume，且不创建任何 Section。
 * - 当前 `visible` 已经等于目标值：返回原 Resume。
 * - 真正发生变化：返回新的 Resume 与新的 sections 数组，只替换目标 Section，
 *   其余 Section 保持原引用；目标 Section 的 `items` 也保持原引用——
 *   显隐只影响输出，绝不动内容。
 *
 * `sectionId` 用来定位而不是数组下标：下标语义脆弱，而 id 在 Schema 里就是
 * 稳定标识（与四个 edits 的定位手法保持一致）。
 */
export function setSectionVisible(
  resume: Resume,
  sectionId: string,
  visible: boolean,
): Resume {
  const target = resume.sections.find((section) => section.id === sectionId);

  if (!target || target.visible === visible) {
    return resume;
  }

  return {
    ...resume,
    sections: resume.sections.map((section) =>
      // 用对象身份而不是 id 比较：精确替换目标 Section，其余原引用透传。
      // { ...target, visible } 会把 target.items 的引用原样带过去 —— 内容不动。
      section === target ? { ...target, visible } : section,
    ),
  };
}

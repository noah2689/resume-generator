import type { Resume, SkillItem, SkillsSection } from '../types/resume';

/**
 * 技能的不可变更新函数。
 *
 * 为什么单独成文件：与 workEdits / educationEdits / projectEdits 同理——
 * 从 resume 根对象到目标 SkillItem 要穿过 sections → skills section → items → item
 * 四层嵌套，每一层都要新建；「没有 skills section 就原样返回」这个守卫如果散落在
 * EditorPage 里，漏掉任何一处都会变成「点了按钮但什么都没发生」。
 *
 * 边界（严格限定）：
 * - 只处理 skills section。教育 / 工作 / 项目不在此文件。
 * - 只有当前真实需要的这 5 个纯函数，没有 reducer、没有 action、没有 path setter。
 * - 没有泛型参数、没有 sectionType 参数——一旦出现就说明越界了。
 * - 不含任何 UI 逻辑。特别地：删除单条技能**不需要确认**（依据 05 第 11 节，
 *   删除保护只针对工作经历、项目经历这类重要内容），所以这里不接收确认回调。
 *
 * 与前三个 edits 的关键差别：SkillItem 只有 name / level 两个字符串字段，
 * 没有 description 数组，因此本文件**没有 bullet 三件套**，
 * 明显比 workEdits / educationEdits / projectEdits 短。
 *
 * 全部函数都是纯函数：接收 Resume，返回新的 Resume，不修改传入对象。
 *
 * 依据：docs/ai-context/03_RESUME_DATA_SCHEMA.md 第 8 节、05_EDITOR_UX_SPEC.md 第 11 节、
 *      06_AI_DEVELOPMENT_PROTOCOL.md 第 5 节
 */

/**
 * SkillItem 中可以直接编辑的字段。
 *
 * Schema 里 SkillItem 就只有这两个字段，没有 description、没有日期、没有城市。
 */
export type SkillItemTextField = 'name' | 'level';

/**
 * 生成一条技能的 id。
 *
 * 优先使用运行时原生的 `crypto.randomUUID()`。它在非安全上下文（例如用局域网 IP
 * 以 http 访问）下不存在，此时退回时间戳 + 随机串，避免「添加技能」直接抛错。
 *
 * 兜底只需满足当前会话内的唯一性：M2 没有持久化，不涉及跨会话去重，
 * 所以不引入 ID 服务、ID 注册表或 uuid 依赖。
 */
export function createSkillId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) {
    return `skill_${uuid}`;
  }
  return `skill_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** 新建一条空技能。两个字段都是空串。 */
export function createEmptySkillItem(): SkillItem {
  return {
    id: createSkillId(),
    name: '',
    level: '',
  };
}

/**
 * 取出 skills section，把它的 items 换成 updater 的产物。
 *
 * 这是「查找 + 写回」的唯一入口，所以下面每个操作都不用重复嵌套展开，
 * 也不用重复「没有 skills section 就放弃」的判断。
 *
 * - 找不到 skills section：返回原 Resume（不自动创建 Section）。
 * - updater 返回同一个数组引用：也返回原 Resume，表示这次操作没有产生变化。
 */
function updateSkillItems(
  resume: Resume,
  update: (items: SkillItem[]) => SkillItem[],
): Resume {
  const skills = resume.sections.find(
    (section): section is SkillsSection => section.type === 'skills',
  );

  if (!skills) {
    return resume;
  }

  const nextItems = update(skills.items);

  if (nextItems === skills.items) {
    return resume;
  }

  return {
    ...resume,
    sections: resume.sections.map((section) =>
      // 用对象身份而不是 id 比较：精确替换 skills 这一项，其余 Section 原引用透传。
      section === skills ? { ...skills, items: nextItems } : section,
    ),
  };
}

/**
 * 按 id 更新某一条 SkillItem，其余条目保持原引用。
 * 找不到该 id、或 updater 没有实际改动时，返回原数组。
 *
 * 用 id 而不是数组下标定位：删除中间一条之后下标会整体前移，
 * 用下标会把编辑作用到错误的技能上。
 */
function mapSkillItem(
  items: SkillItem[],
  itemId: string,
  update: (item: SkillItem) => SkillItem,
): SkillItem[] {
  let changed = false;

  const next = items.map((item) => {
    if (item.id !== itemId) {
      return item;
    }
    const updated = update(item);
    if (updated !== item) {
      changed = true;
    }
    return updated;
  });

  return changed ? next : items;
}

/** 新增一条空技能，追加到 items 末尾。不排序。 */
export function addSkillItem(resume: Resume): Resume {
  return updateSkillItems(resume, (items) => [...items, createEmptySkillItem()]);
}

/** 修改某条技能的一个字段。值未变化时不产生新对象。 */
export function updateSkillItem(
  resume: Resume,
  itemId: string,
  field: SkillItemTextField,
  value: string,
): Resume {
  return updateSkillItems(resume, (items) =>
    mapSkillItem(items, itemId, (item) => {
      if (item[field] === value) {
        return item;
      }
      return { ...item, [field]: value };
    }),
  );
}

/** 删除整条技能。id 不存在时返回原 Resume。不需要确认，因此没有回调参数。 */
export function removeSkillItem(resume: Resume, itemId: string): Resume {
  return updateSkillItems(resume, (items) =>
    items.some((item) => item.id === itemId)
      ? items.filter((item) => item.id !== itemId)
      : items,
  );
}

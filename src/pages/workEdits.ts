import type { Resume, WorkItem, WorkSection } from '../types/resume';

/**
 * 工作经历的不可变更新函数。
 *
 * 为什么单独成文件：
 * 「修改某条工作经历的某个字段」这类操作，从 resume 根对象到目标 WorkItem
 * 要穿过 sections → work section → items → item 四层嵌套，每一层都要新建。
 * 把这些展开链留在 EditorPage 里会和布局 JSX 混在一起，明显降低可读性；
 * 而且「没有 work section 就原样返回」这个守卫会在每个操作里重复一遍，
 * 漏掉任何一处都会变成「点了按钮但什么都没发生」。
 *
 * 边界（严格限定）：
 * - 只处理 work section。教育 / 项目 / 技能不在此文件。
 * - 只有当前真实需要的这几个纯函数，没有 reducer、没有 action、没有 path setter。
 * - 没有泛型参数、没有 sectionType 参数——一旦出现就说明越界了。
 * - 不含任何 UI 逻辑（例如删除确认框），那些属于组件。
 *
 * 全部函数都是纯函数：接收 Resume，返回新的 Resume，不修改传入对象。
 *
 * 依据：docs/ai-context/03_RESUME_DATA_SCHEMA.md 第 6 节、06_AI_DEVELOPMENT_PROTOCOL.md 第 5 节
 */

/**
 * WorkItem 中可以用单行文本输入编辑的字段。
 *
 * 这里只做字段名枚举，不是另一套数据结构；
 * `description` 不在其中，它由专门的 bullet 函数处理。
 */
export type WorkItemTextField =
  | 'company'
  | 'role'
  | 'startDate'
  | 'endDate'
  | 'city';

/**
 * 生成一条工作经历的 id。
 *
 * 优先使用运行时原生的 `crypto.randomUUID()`。
 * 它在非安全上下文（例如用局域网 IP 以 http 访问）下不存在，
 * 此时退回时间戳 + 随机串，避免「添加工作经历」直接抛错。
 *
 * 这个兜底只需要满足当前客户端会话内的唯一性：M2 没有持久化，
 * 不涉及跨会话去重，所以不引入 ID 服务、ID 注册表或 uuid 依赖。
 */
export function createWorkId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) {
    return `work_${uuid}`;
  }
  return `work_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** 新建一条空的工作经历。所有文本字段为空串，描述为空数组。 */
export function createEmptyWorkItem(): WorkItem {
  return {
    id: createWorkId(),
    company: '',
    role: '',
    startDate: '',
    endDate: '',
    city: '',
    description: [],
  };
}

/**
 * 取出 work section，把它的 items 换成 updater 的产物。
 *
 * 这是「查找 + 写回」的唯一入口，所以下面每个操作都不用重复嵌套展开，
 * 也不用重复「没有 work section 就放弃」的判断。
 *
 * - 找不到 work section：返回原 Resume（不自动创建 Section）。
 * - updater 返回同一个数组引用：也返回原 Resume，表示这次操作没有产生变化。
 */
function updateWorkItems(
  resume: Resume,
  update: (items: WorkItem[]) => WorkItem[],
): Resume {
  const work = resume.sections.find(
    (section): section is WorkSection => section.type === 'work',
  );

  if (!work) {
    return resume;
  }

  const nextItems = update(work.items);

  if (nextItems === work.items) {
    return resume;
  }

  return {
    ...resume,
    sections: resume.sections.map((section) =>
      // 用对象身份而不是 id 比较：精确替换 work 这一项，其余 Section 原引用透传。
      section === work ? { ...work, items: nextItems } : section,
    ),
  };
}

/**
 * 按 id 更新某一条 WorkItem，其余条目保持原引用。
 * 找不到该 id、或 updater 没有实际改动时，返回原数组。
 *
 * 用 id 而不是数组下标定位：删除中间一条之后，下标会整体前移，
 * 用下标会把编辑作用到错误的条目上。
 */
function mapWorkItem(
  items: WorkItem[],
  itemId: string,
  update: (item: WorkItem) => WorkItem,
): WorkItem[] {
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

/** 新增一条空工作经历，追加到 items 末尾。不排序。 */
export function addWorkItem(resume: Resume): Resume {
  return updateWorkItems(resume, (items) => [...items, createEmptyWorkItem()]);
}

/** 修改某条工作经历的一个文本字段。值未变化时不产生新对象。 */
export function updateWorkItem(
  resume: Resume,
  itemId: string,
  field: WorkItemTextField,
  value: string,
): Resume {
  return updateWorkItems(resume, (items) =>
    mapWorkItem(items, itemId, (item) => {
      if (item[field] === value) {
        return item;
      }
      return { ...item, [field]: value };
    }),
  );
}

/** 删除整条工作经历。id 不存在时返回原 Resume。 */
export function removeWorkItem(resume: Resume, itemId: string): Resume {
  return updateWorkItems(resume, (items) =>
    items.some((item) => item.id === itemId)
      ? items.filter((item) => item.id !== itemId)
      : items,
  );
}

/** 在某条工作经历的描述末尾追加一条空 bullet。 */
export function addWorkBullet(resume: Resume, itemId: string): Resume {
  return updateWorkItems(resume, (items) =>
    mapWorkItem(items, itemId, (item) => ({
      ...item,
      description: [...item.description, ''],
    })),
  );
}

/**
 * 修改某条 bullet 的文本。
 *
 * 用 bullet 下标定位：Schema 里 description 是裸 string[]，bullet 没有 id，
 * 因此这里只能按位置定位。每行输入都是受控的、按值渲染，不持有以 index 为键的
 * 内部状态，所以中间删除导致的下标位移不会串行。
 */
export function updateWorkBullet(
  resume: Resume,
  itemId: string,
  bulletIndex: number,
  value: string,
): Resume {
  return updateWorkItems(resume, (items) =>
    mapWorkItem(items, itemId, (item) => {
      if (bulletIndex < 0 || bulletIndex >= item.description.length) {
        return item;
      }
      if (item.description[bulletIndex] === value) {
        return item;
      }
      return {
        ...item,
        description: item.description.map((bullet, index) =>
          index === bulletIndex ? value : bullet,
        ),
      };
    }),
  );
}

/** 删除某条 bullet。不需要确认。 */
export function removeWorkBullet(
  resume: Resume,
  itemId: string,
  bulletIndex: number,
): Resume {
  return updateWorkItems(resume, (items) =>
    mapWorkItem(items, itemId, (item) => {
      if (bulletIndex < 0 || bulletIndex >= item.description.length) {
        return item;
      }
      return {
        ...item,
        description: item.description.filter((_, index) => index !== bulletIndex),
      };
    }),
  );
}

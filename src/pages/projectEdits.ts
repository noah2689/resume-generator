import type { ProjectItem, ProjectSection, Resume } from '../types/resume';

/**
 * 项目经历的不可变更新函数。
 *
 * 为什么单独成文件：
 * 与 workEdits.ts / educationEdits.ts 同一理由。「修改某条项目经历的某个字段」这类操作，
 * 从 resume 根对象到目标 ProjectItem 要穿过 sections → project section → items → item
 * 四层嵌套，每一层都要新建。把这些展开链留在 EditorPage 里会和布局 JSX 混在一起，
 * 而且「没有 project section 就原样返回」这个守卫会在每个操作里重复一遍，
 * 漏掉任何一处都会变成「点了按钮但什么都没发生」。
 *
 * 为什么这次仍然不与 workEdits / educationEdits 合并：
 * 现在手里有三个结构相近的实现。重复是显而易见的——但「重复」本身还不是
 * 「该抽象」的证据，需要先看清哪些是真正的共性、哪些只是字段名碰巧相似
 * （ProjectItem 就没有 city，这一点已经说明三类并不完全同构）。
 * 按 06 第 5 节：至少 2~3 个真实复用场景才考虑抽象，且抽象决策不应夹在
 * 某个具体 CRUD 任务里顺手做掉。当前任务是 Project CRUD，不是公共编辑框架。
 *
 * 边界（严格限定）：
 * - 只处理 type === 'project' 的 section。工作 / 教育 / 技能不在此文件。
 * - 对外导出的业务函数不做泛化：没有泛型参数、没有 sectionType 参数、
 *   没有可传入的 updater——一旦出现就说明越界了。
 * - 内部 project 专用 helper（updateProjectItems / mapProjectItem）
 *   可以接收 updater 回调，用于避免 8 个操作各写一遍嵌套展开；
 *   但它们写死处理 project，无泛型、无 sectionType 参数，
 *   不被 workEdits / educationEdits 复用，也不抽成通用 section/item updater。
 * - 没有 reducer、没有 action、没有 path setter、没有共用 bullet 模块。
 * - 不含任何 UI 逻辑（例如删除确认框），那些属于组件。
 *
 * 全部函数都是纯函数：接收 Resume，返回新的 Resume，不修改传入对象。
 *
 * 依据：docs/ai-context/03_RESUME_DATA_SCHEMA.md 第 7 节、06_AI_DEVELOPMENT_PROTOCOL.md 第 5 节
 */

/**
 * ProjectItem 中可以用单行文本输入编辑的字段。
 *
 * 这里只做字段名枚举，不是另一套数据结构。
 * 严格对齐 Schema：ProjectItem 没有 city 字段，因此这里也不包含 city
 * （不因为 work / education 都有城市就顺手加一个）。
 * `description` 不在其中，它由专门的 bullet 函数处理。
 */
export type ProjectItemTextField = 'name' | 'role' | 'startDate' | 'endDate';

/**
 * 生成一条项目经历的 id。
 *
 * 优先使用运行时原生的 `crypto.randomUUID()`。
 * 它在非安全上下文（例如用局域网 IP 以 http 访问）下不存在，
 * 此时退回时间戳 + 随机串，避免「添加项目经历」直接抛错。
 *
 * 前缀用 `project_`：与示例数据里既有的 `project_001` / `project_002`
 * 保持同一命名风格，避免同一个 items 数组里出现两种前缀。
 *
 * 这个兜底只需要满足当前客户端会话内的唯一性：M2 没有持久化，
 * 不涉及跨会话去重，所以不引入 ID 服务、ID 注册表或 uuid 依赖。
 */
export function createProjectId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) {
    return `project_${uuid}`;
  }
  return `project_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** 新建一条空的项目经历。所有文本字段为空串，描述为空数组。 */
export function createEmptyProjectItem(): ProjectItem {
  return {
    id: createProjectId(),
    name: '',
    role: '',
    startDate: '',
    endDate: '',
    description: [],
  };
}

/**
 * 取出 project section，把它的 items 换成 updater 的产物。
 *
 * 这是「查找 + 写回」的唯一入口，所以下面每个操作都不用重复嵌套展开，
 * 也不用重复「没有 project section 就放弃」的判断。
 *
 * project 专用：写死 `section.type === 'project'`，不参数化。
 *
 * - 找不到 project section：返回原 Resume（不自动创建 Section）。
 * - updater 返回同一个数组引用：也返回原 Resume，表示这次操作没有产生变化。
 */
function updateProjectItems(
  resume: Resume,
  update: (items: ProjectItem[]) => ProjectItem[],
): Resume {
  const project = resume.sections.find(
    (section): section is ProjectSection => section.type === 'project',
  );

  if (!project) {
    return resume;
  }

  const nextItems = update(project.items);

  if (nextItems === project.items) {
    return resume;
  }

  return {
    ...resume,
    sections: resume.sections.map((section) =>
      // 用对象身份而不是 id 比较：精确替换 project 这一项，其余 Section 原引用透传。
      section === project ? { ...project, items: nextItems } : section,
    ),
  };
}

/**
 * 按 id 更新某一条 ProjectItem，其余条目保持原引用。
 * 找不到该 id、或 updater 没有实际改动时，返回原数组。
 *
 * 用 id 而不是数组下标定位：删除中间一条之后，下标会整体前移，
 * 用下标会把编辑作用到错误的条目上。
 */
function mapProjectItem(
  items: ProjectItem[],
  itemId: string,
  update: (item: ProjectItem) => ProjectItem,
): ProjectItem[] {
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

/** 新增一条空项目经历，追加到 items 末尾。不排序。 */
export function addProjectItem(resume: Resume): Resume {
  return updateProjectItems(resume, (items) => [
    ...items,
    createEmptyProjectItem(),
  ]);
}

/** 修改某条项目经历的一个文本字段。值未变化时不产生新对象。 */
export function updateProjectItem(
  resume: Resume,
  itemId: string,
  field: ProjectItemTextField,
  value: string,
): Resume {
  return updateProjectItems(resume, (items) =>
    mapProjectItem(items, itemId, (item) => {
      if (item[field] === value) {
        return item;
      }
      return { ...item, [field]: value };
    }),
  );
}

/** 删除整条项目经历。id 不存在时返回原 Resume。 */
export function removeProjectItem(resume: Resume, itemId: string): Resume {
  return updateProjectItems(resume, (items) =>
    items.some((item) => item.id === itemId)
      ? items.filter((item) => item.id !== itemId)
      : items,
  );
}

/** 在某条项目经历的描述末尾追加一条空 bullet。 */
export function addProjectBullet(resume: Resume, itemId: string): Resume {
  return updateProjectItems(resume, (items) =>
    mapProjectItem(items, itemId, (item) => ({
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
export function updateProjectBullet(
  resume: Resume,
  itemId: string,
  bulletIndex: number,
  value: string,
): Resume {
  return updateProjectItems(resume, (items) =>
    mapProjectItem(items, itemId, (item) => {
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
export function removeProjectBullet(
  resume: Resume,
  itemId: string,
  bulletIndex: number,
): Resume {
  return updateProjectItems(resume, (items) =>
    mapProjectItem(items, itemId, (item) => {
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

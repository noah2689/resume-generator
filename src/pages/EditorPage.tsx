import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import BasicInfoForm, {
  type EditableBasicInfoField,
} from '../components/BasicInfoForm';
import EducationExperienceForm from '../components/EducationExperienceForm';
import ProjectExperienceForm from '../components/ProjectExperienceForm';
import SectionVisibilityControls from '../components/SectionVisibilityControls';
import SkillsForm from '../components/SkillsForm';
import StyleControls, { type StyleChange } from '../components/StyleControls';
import TemplateSwitcher from '../components/TemplateSwitcher';
import WorkExperienceForm from '../components/WorkExperienceForm';
import { sampleResume } from '../data/sampleResume';
import { loadResumeFromStorage, saveResumeToStorage } from '../storage/resumeStorage';
import ResumeTemplateRenderer from '../templates/ResumeTemplateRenderer';
import type { Resume, ResumeStyle } from '../types/resume';
import {
  addEducationBullet,
  addEducationItem,
  removeEducationBullet,
  removeEducationItem,
  updateEducationBullet,
  updateEducationItem,
  type EducationItemTextField,
} from './educationEdits';
import {
  addProjectBullet,
  addProjectItem,
  removeProjectBullet,
  removeProjectItem,
  updateProjectBullet,
  updateProjectItem,
  type ProjectItemTextField,
} from './projectEdits';
import { setSectionVisible } from './sectionVisibility';
import {
  addSkillItem,
  removeSkillItem,
  updateSkillItem,
  type SkillItemTextField,
} from './skillsEdits';
import {
  addWorkBullet,
  addWorkItem,
  removeWorkBullet,
  removeWorkItem,
  updateWorkBullet,
  updateWorkItem,
  type WorkItemTextField,
} from './workEdits';
import styles from './EditorPage.module.css';

/**
 * 页面 C：简历编辑器。
 *
 * M2.1 阶段：最小两栏可编辑页面。
 * M2.2 阶段：在此基础上支持工作经历 CRUD。
 * M2.3 阶段：加入教育经历 CRUD。
 * M2.4 阶段：加入项目经历 CRUD。
 * M2.5 阶段：加入技能 CRUD。
 * M2.6 阶段：加入 Section 显示 / 隐藏。
 * M3 阶段：加入 LocalStorage 持久化，刷新后恢复。
 * M4 阶段：加入模板切换（简约单栏 / 商务单栏 / 左右双栏）。
 * M5 阶段：加入基础样式（主题色 / 字体 / 密度 / 头像显示），并补齐三栏布局。
 * - 左侧：模块显示 + 基本信息 + 工作经历 + 教育经历 + 项目经历 + 技能
 * - 中间：A4 简历预览
 * - 右侧：模板选择 + 样式设置（StyleControls）
 * M6a 阶段：自动保存加防抖与状态显示（保存中… / 已保存 / 保存失败），
 * 并在三栏上方补一条只读的 editor toolbar（简历名称 + 保存状态）。
 * M6b 阶段：toolbar 右侧加「导出 PDF」按钮（等字体就绪后调原生打印），
 * 并在三栏上补打印样式（隐藏编辑器 UI、重置纸面尺寸、按模块分页）。
 * 打印本身不改数据、不写存储，因此 M6b 没有引入任何新的状态。
 *
 * 数据流：
 *
 *   localStorage（有可用数据则优先）
 *       ↓ 无数据 / 数据不可用 → 回退 sampleResume
 *       ↓ 初始化（lazy initializer，发生在首次渲染前）
 *   EditorPage resume state
 *       ├── 左侧 BasicInfoForm 修改 profile / targetRole
 *       ├── 左侧 SectionVisibilityControls 修改各 Section 的 visible
 *       ├── 左侧 WorkExperienceForm 修改 work section 的 items
 *       ├── 左侧 EducationExperienceForm 修改 education section 的 items
 *       ├── 左侧 ProjectExperienceForm 修改 project section 的 items
 *       ├── 左侧 SkillsForm 修改 skills section 的 items
 *       ├── 右侧 TemplateSwitcher 只修改 resume.templateId
 *       ├── 右侧 StyleControls 只修改 resume.style 的一个字段
 *       └── 中间 ResumeTemplateRenderer(resume) → 按 templateId 选模板组件
 *
 *   resume 真正变成新对象 → useEffect → pendingResumeRef + 300ms timer
 *       ↓ timer 到点 / 页面离开 / 组件卸载
 *   saveResumeToStorage(resume) → true / false → saveStatus
 *
 * 职责边界：
 * - 本页持有 Resume 状态（不拆 Context / store / reducer），并负责布局。
 * - 各 Section 的嵌套不可变更新分别实现在 ./workEdits / ./educationEdits / ./projectEdits / ./skillsEdits，
 *   本页只做「把 state 传进去、把结果存回来」。四者刻意不合并成通用 CRUD 层。
 * - Section 显隐实现在 ./sectionVisibility：它只改 Section 外壳的 visible，
 *   与四套 item CRUD 是不同层次的东西，因此不放进任何一个 edits 文件。
 * - 持久化实现在 ../storage/resumeStorage：本页只在 state 真正变化后调用它。
 *   上面那些 edits 仍是纯函数，绝不写 LocalStorage——storage IO 只发生在这里与 resumeStorage 内部。
 * - 预览具体用哪个模板由 ../templates/ResumeTemplateRenderer 决定：
 *   本页只知道「有一个模板渲染器」，不需要认识三个模板组件，切换时也只改 templateId。
 * - token → 具体 CSS 值的映射由 ../templates/templateStyleTokens 负责：
 *   本页与 StyleControls 都只搬运选项名，不解释它们代表什么颜色 / 字号。
 * - 简历纸面与排版属于模板组件（SimpleSingleColumn / BusinessSingleColumn / TwoColumn）。
 * - Section 排序属于后续阶段。
 *
 * 已知问题（记录，本阶段不处理）：
 * CRUD、显隐、持久化、模板切换、样式设置逐步接入后，本文件持续变长。
 * **行数本身不是重构触发条件**：M2 总验收后仍决定保持各类型 CRUD 独立，
 * 是否拆出 hook / controller 属于后续按职责单独评估的独立判断，
 * 不在任何单个任务里顺手做，也从不因为「超过某个行数」就自动动手。
 */

/**
 * 一次自动保存的可见状态（M6a）。
 *
 * 刻意定义在本文件里，不单独开 saveStatus.ts、也不放进 types/resume.ts：
 * 它是「一次 IO 的结果」，不是简历数据，只有本页在用它。
 */
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** 四种状态对应的 UI 文案。UI 文案属于本页，不进 storage 层。 */
const SAVE_STATUS_LABELS: Record<SaveStatus, string> = {
  idle: '未修改',
  saving: '保存中…',
  saved: '已保存',
  error: '保存失败',
};

/**
 * 自动保存的防抖时长。
 *
 * 300ms 是「连续打字时几乎不触发中间写盘、停手后立刻落盘」的经验值。
 * 不进 Resume、不进 LocalStorage：它是本页的交互参数。
 */
const SAVE_DEBOUNCE_MS = 300;

/**
 * 把一个样式改动应用到 style 上（M5）。
 *
 * 返回值就是新的 style：**值没有真正改变时返回传入的同一个 style 引用**，
 * 调用方据此短路（既不新建 root，也不触发写盘与重渲染）。
 *
 * 为什么不新开一个 ./styleEdits.ts（其余四套 CRUD 都各自有文件）：
 * 那四个文件处理的是「按 id 定位单条 + 四层嵌套写回 + 列表增删」，
 * 而样式是**扁平的单层更新**——只在 style 上改一个字段，没有定位逻辑。
 * 为了它单开一个文件不增加任何清晰度，所以留在本文件内。
 *
 * 这四个分支是四个**真实字段**，不是通用 path setter：
 * 没有字段名字符串、没有 keyof 遍历、没有动态索引。
 */
function applyStyleChange(style: ResumeStyle, change: StyleChange): ResumeStyle {
  switch (change.field) {
    case 'themeColor':
      return style.themeColor === change.value
        ? style
        : { ...style, themeColor: change.value };

    case 'fontFamily':
      return style.fontFamily === change.value
        ? style
        : { ...style, fontFamily: change.value };

    case 'density':
      return style.density === change.value
        ? style
        : { ...style, density: change.value };

    case 'showAvatar':
      return style.showAvatar === change.value
        ? style
        : { ...style, showAvatar: change.value };
  }
}

export default function EditorPage() {
  const { resumeId } = useParams<{ resumeId: string }>();

  // 仍然只有一份示例数据，因此这里直接比较 ID。
  // 只有已知 Resume 才继续；未知 ID 走下面的「未找到简历」，与 M2 行为一致。
  const found: Resume | null = sampleResume.id === resumeId ? sampleResume : null;

  /**
   * Resume state 只放在本页。
   *
   * 用 lazy initializer 决定初始值，使「恢复」发生在**首次渲染之前**：
   * 不会先渲染示例数据再补一次加载（那样会闪一下），也不需要 loading 页。
   * LocalStorage 是同步 API，所以这里可以同步读。
   *
   * 取值顺序：
   *   1. 路由不认识这个 resumeId → null（沿用「未找到简历」分支）
   *   2. LocalStorage 有可用数据 → persisted Resume
   *   3. 其余情况（无数据 / 坏数据 / 版本不符 / 读取抛错）→ sampleResume
   *
   * initializer 必须是纯函数（StrictMode 下会被调用两次），
   * 所以它只读不写：读取失败不会顺手清理掉存储里的旧值。
   *
   * 不做深拷贝。只要严格遵守下面的不可变更新规则（每次返回新的
   * root/profile/sections 对象，不直接给 resume 的字段赋值、不改动任何数组），
   * 无论 state 初始值是 sampleResume 还是从存储解析出来的新对象，都不会被就地修改。
   *
   * 已知限制：当前只有一份示例简历，因此接受「路由参数在运行期间
   * 不会切换到另一份 Resume」。将来支持多份简历切换时，需要补上
   * 状态重置（例如拆分内层组件并加 key，或监听 resumeId 变化）。
   */
  const [resume, setResume] = useState<Resume | null>(() => {
    if (!found) {
      return null;
    }
    return loadResumeFromStorage(found.id, found.schemaVersion) ?? found;
  });

  /**
   * 首次 mount 的门禁。
   *
   * 用「初始 Resume 的引用」而不是 `hasMounted` 布尔量：本组件跑在
   * StrictMode 下，effect 会被 setup → cleanup → setup 重复执行。
   * 布尔门禁是被 effect 自己翻转的，第二次 setup 无法区分「同一次 mount」
   * 与「用户真的改了数据」，会把初始值当成一次真实变更写下去——
   * 那正好会在 mount 期间用 sampleResume 覆盖掉存储里的坏数据 / 旧版本数据。
   *
   * 引用比较是个不变量：初始引用在整个生命周期内不变，而任何真实编辑
   * 都经过不可变更新、必然产生新对象，所以 effect 重复执行多少次结果都一样。
   */
  const initialResumeRef = useRef(resume);

  /**
   * 自动保存（M3 建立，M6a 加防抖与状态）。
   *
   * 只在 state 生命周期里保存一次，不给 handlers 或各个 edits 纯函数加存储调用。
   *
   * 三个关注点分开（M6a）：
   * - `initialResumeRef`：首帧门禁，只用来判断「这次变化是不是真实编辑」。
   * - `pendingResumeRef`：**还没落盘的最新一份 Resume**。timer 到点时保存的是它，
   *   而不是闭包里的 `resume`——闭包捕获的可能是被后面几次编辑取代掉的旧对象。
   * - `saveTimerRef`：当前待触发的 debounce timer，用来「连续输入时取消前一个」。
   *
   * 状态流转：真实编辑 → pending 赋值 + `saving` → 重置 300ms timer
   *          → timer 到点 → 写盘 → 成功 `saved`（清 pending）/ 失败 `error`（保留 pending）。
   * 失败后不做自动重试：下一次真实编辑会重新走一遍，即「正常重试」。
   */
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const pendingResumeRef = useRef<Resume | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  /**
   * 把还没落盘的那一份同步写进去。
   *
   * 存在两个真实的丢数据窗口，都靠它兜住：
   * - debounce 期间刷新 / 关标签页（React 不会跑 effect cleanup）；
   * - debounce 期间 SPA 跳转导致组件卸载（cleanup 里的 clearTimeout 会把待写内容丢掉）。
   *
   * 因为 `localStorage.setItem` 是**同步**的，这里可以在离开前一刻安全补写，
   * 最多只丢「最后一次编辑到离开之间没被 debounce 覆盖到」的那部分。
   *
   * 刻意不做两件事：
   * - **不在卸载路径里 set React state**（组件正在消失，改也没人看）。
   * - 不调 `beforeunload` / 不弹「有未保存修改」确认框：同步写盘已经够了，
   *   弹窗只会打断用户。
   *
   * 失败时保留 pending，让后续 edit 或下一次 flush 再试。
   */
  const flushPendingSave = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const pending = pendingResumeRef.current;
    if (!pending) {
      return;
    }

    pendingResumeRef.current = saveResumeToStorage(pending) ? null : pending;
  }, []);

  useEffect(() => {
    if (!resume) {
      return;
    }
    if (resume === initialResumeRef.current) {
      return;
    }

    pendingResumeRef.current = resume;
    setSaveStatus('saving');

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;

      const pending = pendingResumeRef.current;
      if (!pending) {
        return;
      }

      if (saveResumeToStorage(pending)) {
        pendingResumeRef.current = null;
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
    }, SAVE_DEBOUNCE_MS);
  }, [resume]);

  /**
   * 离开页面 / 卸载组件时补写（M6a）。
   *
   * 两处共用同一个 flush：
   * - `pagehide`：刷新、关标签页、前进后退。React 在这条路径上**不会**跑 cleanup，
   *   所以必须单独监听。（不用 `beforeunload`：移动端不可靠，且会干扰 bfcache。）
   * - effect cleanup：SPA 跳转导致本组件卸载。cleanup 里同时摘掉监听。
   *
   * StrictMode 安全：开发态的 setup → cleanup → setup 会在初始状态跑一次 cleanup，
   * 此时 `pendingResumeRef.current` 与 `saveTimerRef.current` 都是 null，
   * flush 什么都不做，因此**mount 依然是 0 次写盘**。
   */
  useEffect(() => {
    const handlePageHide = () => {
      flushPendingSave();
    };

    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      flushPendingSave();
    };
  }, [flushPendingSave]);

  /**
   * 已知限制（记录，本轮不处理）：若页面被 bfcache 恢复（back/forward 缓存），
   * 状态文案可能停在「保存中…」而数据其实已经写进去了（flush 刻意不 setState）。
   * 用户下一次编辑会立刻自愈，因此不为此加 pageshow 协调逻辑。
   */

  if (!resume) {
    return (
      <section className="panel">
        <h1 className="panel__title">未找到简历</h1>
        <p className="panel__text">
          当前只内置一份示例简历，ID 为 <code>{sampleResume.id}</code>。
        </p>
        <p className="panel__text">
          <Link to={`/editor/${sampleResume.id}`}>打开示例简历</Link>
        </p>
      </section>
    );
  }

  /**
   * 修改基本信息。
   *
   * 全部使用展开式更新，不 mutation 原对象：
   * - targetRole 在 Resume 顶层
   * - 其余字段在 profile 内，因此要新建 profile 对象
   * sections 不受影响，连引用都不会改变。
   */
  const handleBasicInfoChange = (
    field: EditableBasicInfoField,
    value: string,
  ) => {
    setResume((current) => {
      if (!current) {
        return current;
      }
      if (field === 'targetRole') {
        return { ...current, targetRole: value };
      }
      return {
        ...current,
        profile: { ...current.profile, [field]: value },
      };
    });
  };

  /**
   * 以下 6 个处理器是工作经历的唯一写入口。
   *
   * 每个都只是「把当前 Resume 交给 workEdits 里的纯函数，把返回值存回 state」。
   * 嵌套展开、按 id 定位、没有 work section 时的守卫都在 workEdits 内，
   * 所以这里读起来是平的。
   */
  const handleWorkAddItem = () => {
    setResume((current) => (current ? addWorkItem(current) : current));
  };

  const handleWorkChangeField = (
    itemId: string,
    field: WorkItemTextField,
    value: string,
  ) => {
    setResume((current) =>
      current ? updateWorkItem(current, itemId, field, value) : current,
    );
  };

  const handleWorkRemoveItem = (itemId: string) => {
    setResume((current) => (current ? removeWorkItem(current, itemId) : current));
  };

  const handleWorkAddBullet = (itemId: string) => {
    setResume((current) => (current ? addWorkBullet(current, itemId) : current));
  };

  const handleWorkChangeBullet = (
    itemId: string,
    bulletIndex: number,
    value: string,
  ) => {
    setResume((current) =>
      current ? updateWorkBullet(current, itemId, bulletIndex, value) : current,
    );
  };

  const handleWorkRemoveBullet = (itemId: string, bulletIndex: number) => {
    setResume((current) =>
      current ? removeWorkBullet(current, itemId, bulletIndex) : current,
    );
  };

  /**
   * 以下 6 个处理器是教育经历的唯一写入口。
   *
   * 与上面的工作经历处理器同构，但刻意不复用同一个函数：
   * 两者的字段类型（WorkItemTextField / EducationItemTextField）与
   * 更新函数不同。M2 总验收后仍决定保持各类型 CRUD 独立；
   * 字段语义的差异说明当前没有必要为了减少重复而建立通用 CRUD 层。
   */
  const handleEducationAddItem = () => {
    setResume((current) => (current ? addEducationItem(current) : current));
  };

  const handleEducationChangeField = (
    itemId: string,
    field: EducationItemTextField,
    value: string,
  ) => {
    setResume((current) =>
      current ? updateEducationItem(current, itemId, field, value) : current,
    );
  };

  const handleEducationRemoveItem = (itemId: string) => {
    setResume((current) =>
      current ? removeEducationItem(current, itemId) : current,
    );
  };

  const handleEducationAddBullet = (itemId: string) => {
    setResume((current) =>
      current ? addEducationBullet(current, itemId) : current,
    );
  };

  const handleEducationChangeBullet = (
    itemId: string,
    bulletIndex: number,
    value: string,
  ) => {
    setResume((current) =>
      current
        ? updateEducationBullet(current, itemId, bulletIndex, value)
        : current,
    );
  };

  const handleEducationRemoveBullet = (itemId: string, bulletIndex: number) => {
    setResume((current) =>
      current ? removeEducationBullet(current, itemId, bulletIndex) : current,
    );
  };

  /**
   * 以下 6 个处理器是项目经历的唯一写入口。
   *
   * 与上面的工作 / 教育处理器同构，但同样刻意不复用同一个函数：
   * 字段类型不同（ProjectItemTextField 只有 4 个字段，没有 city），
   * 更新函数也不同。第二、第三个真实样本落地后依然不抽公共层：
   * M2 总验收后决定保持各类型 CRUD 独立。
   */
  const handleProjectAddItem = () => {
    setResume((current) => (current ? addProjectItem(current) : current));
  };

  const handleProjectChangeField = (
    itemId: string,
    field: ProjectItemTextField,
    value: string,
  ) => {
    setResume((current) =>
      current ? updateProjectItem(current, itemId, field, value) : current,
    );
  };

  const handleProjectRemoveItem = (itemId: string) => {
    setResume((current) =>
      current ? removeProjectItem(current, itemId) : current,
    );
  };

  const handleProjectAddBullet = (itemId: string) => {
    setResume((current) =>
      current ? addProjectBullet(current, itemId) : current,
    );
  };

  const handleProjectChangeBullet = (
    itemId: string,
    bulletIndex: number,
    value: string,
  ) => {
    setResume((current) =>
      current ? updateProjectBullet(current, itemId, bulletIndex, value) : current,
    );
  };

  const handleProjectRemoveBullet = (itemId: string, bulletIndex: number) => {
    setResume((current) =>
      current ? removeProjectBullet(current, itemId, bulletIndex) : current,
    );
  };

  /**
   * 以下 3 个处理器是技能的唯一写入口。
   *
   * 只有 3 个而不是 6 个：SkillItem 只有 name / level 两个字段，
   * 没有 description 数组，因此不存在 bullet 相关的处理器。
   * 删除单条技能不需要确认（05 第 11 节），所以也没有确认逻辑要放进来。
   */
  const handleSkillAddItem = () => {
    setResume((current) => (current ? addSkillItem(current) : current));
  };

  const handleSkillChangeField = (
    itemId: string,
    field: SkillItemTextField,
    value: string,
  ) => {
    setResume((current) =>
      current ? updateSkillItem(current, itemId, field, value) : current,
    );
  };

  const handleSkillRemoveItem = (itemId: string) => {
    setResume((current) =>
      current ? removeSkillItem(current, itemId) : current,
    );
  };

  /**
   * 切换某个 Section 是否显示。
   *
   * 这是本页唯一的 Section 外壳级 Handler：它改的是 section.visible，
   * 不碰 items。所以不需要按类型分四个 —— visible 是四类 Section 共有的字段，
   * setSectionVisible 一个函数就够（理由见 sectionVisibility.ts 顶部）。
   *
   * 隐藏某个 Section 不会影响上面那些内容 Form：它们都基于
   * resume.sections.find(...) 取数，本来就不看 visible，
   * 所以「隐藏 ≠ 从编辑器删除」，用户仍可继续编辑、增删条目。
   */
  const handleSectionVisibilityChange = (
    sectionId: string,
    visible: boolean,
  ) => {
    setResume((current) =>
      current ? setSectionVisible(current, sectionId, visible) : current,
    );
  };

  /**
   * 切换模板。
   *
   * 这是 M4 的核心约束所在：**只改 templateId**。
   *
   * - 只新建 root 对象，profile / sections / style 连引用都保持不变，
   *   每个 Section / item 也不会被重建。验收判据就是这三条引用相等：
   *     next.profile === current.profile
   *     next.sections === current.sections
   *     next.style === current.style
   * - 不重建 profile、不 clone items、不 reset style、不按模板调整 order、
   *   不清理隐藏模块、不给模板注入默认内容。
   * - 同值时直接返回 current（不触发无意义的写盘与重渲染）。
   *
   * 持久化不需要额外处理：M3 存的是整份 Resume，这个新 root 会被现有的
   * useEffect 天然接住，templateId 自然跟随。因此本函数不碰 LocalStorage。
   */
  const handleTemplateChange = (templateId: string) => {
    setResume((current) => {
      if (!current || current.templateId === templateId) {
        return current;
      }

      return {
        ...current,
        templateId,
      };
    });
  };

  /**
   * 修改样式设置（M5）。
   *
   * 与 handleTemplateChange 同构，但落在 `style` 上：
   * - 只新建 root 与 style 两个对象；profile / sections / templateId 连引用都不变。
   *   验收判据同样是引用相等：
   *     next.profile === current.profile
   *     next.sections === current.sections
   *     next.templateId === current.templateId
   * - 值没真正变时 applyStyleChange 返回同一个 style 引用 → 直接 return current，
   *   不写盘、不重渲染（同值短路）。
   * - 不按模板调整 style、不给模板注入默认样式、不重建 items。
   *
   * 持久化同样不需要额外处理：M3 存的是整份 Resume，这个新 root 会被现有的
   * useEffect 天然接住，style 自然跟随。因此本函数不碰 LocalStorage。
   */
  const handleStyleChange = (change: StyleChange) => {
    setResume((current) => {
      if (!current) {
        return current;
      }

      const nextStyle = applyStyleChange(current.style, change);
      if (nextStyle === current.style) {
        return current;
      }

      return {
        ...current,
        style: nextStyle,
      };
    });
  };

  /**
   * 导出 PDF（M6b）。
   *
   * 就是浏览器原生打印，不做别的：
   * 用户在系统打印对话框里选「另存为 PDF」，于是「导出」这件事
   * 完全落在浏览器自己的排版引擎上——不需要 html2canvas / jsPDF 之类的
   * 二次渲染器，也就不会出现「截图像素化」「中文变方框」「分页要自己算」。
   *
   * 唯一的准备动作是等字体：
   * `document.fonts.ready` 在所有正在加载的字体就绪后才 resolve。
   * 不等它就直接 print，Chrome 有可能按 fallback 字形排版、把 Noto 的
   * 字形数据排除在 PDF 之外，结果就是「屏幕上是黑体、导出后是宋体」，
   * 甚至中文字形缺失。等一下就绪后 PDF 里嵌入的才是真正显示的那份字体。
   * （字体是本地 woff2，不依赖网络，所以这里不会因为断网卡住。）
   *
   * 刻意不做的事：
   * - **不为了导出强制保存 Resume**。打印读的是当前 DOM，与 LocalStorage 无关；
   *   顺手写一次盘只会在用户没编辑时凭空产生一次磁盘写入、并把状态文案
   *   从「未修改」改成「已保存」，误导用户以为发生过修改。
   * - 不引入「导出中…」状态机 / 进度条：window.print() 是同步阻塞调用，
   *   弹出系统对话框前没有可展示的中间态。
   * - 不改路由、不改 Resume、不打开新窗口。
   */
  const handleExportPdf = async () => {
    await document.fonts.ready;
    window.print();
  };

  // 只读地用一下各 section：有就渲染表单，没有就显示提示。
  // 这里不创建 Section——Section 的新增 / 删除属于之后的任务。
  // 注意：这些查找**不看 visible**。隐藏只影响右侧输出，
  // 左侧编辑入口必须保留，否则用户会以为内容被删除了。
  const workSection = resume.sections.find((section) => section.type === 'work');
  const educationSection = resume.sections.find(
    (section) => section.type === 'education',
  );
  const projectSection = resume.sections.find(
    (section) => section.type === 'project',
  );
  const skillsSection = resume.sections.find(
    (section) => section.type === 'skills',
  );

  /**
   * 当前简历是否真的有头像内容。
   *
   * 用 typeof 而不是直接 `resume.profile.avatar.trim()`：
   * storage/resumeStorage.ts 只确认 `profile` 是对象，不做逐字段运行时校验，
   * 因此历史存储里完全可能是 `{"avatar": 123}`。这里是**判断**，不能抛错。
   *
   * 计算放在本页而不是 StyleControls：只有本页拿得到完整 Resume。
   * StyleControls 只接收这个布尔值，不接收整个 profile——
   * 它需要知道的是「有没有头像」，而不是简历内容长什么样。
   */
  const hasAvatar =
    typeof resume.profile.avatar === 'string' &&
    resume.profile.avatar.trim() !== '';

  return (
    /*
     * editor toolbar（M6a）：三栏之外、之上的一条很薄的条，只放「简历名称 + 保存状态」。
     * M6b 在右侧补上真实的「导出 PDF」按钮与一句打印提示。
     * 刻意**不放**「预览」按钮：预览就是它下面那块三栏里的 A4 纸面本身，
     * 再给一个「预览」入口等于指回同一个地方。
     * 也不改全局 App 导航：这是页面级动作，留在页面级。
     */
    <div className={styles.editor}>
      <div className={styles.editorToolbar}>
        <span className={styles.editorTitle}>{resume.title}</span>
        <span className={styles.saveStatus} data-status={saveStatus}>
          {SAVE_STATUS_LABELS[saveStatus]}
        </span>

        {/* 导出失败/不可用的提示留在这里而不是弹窗：不需要用户确认，
            也不需要落盘，读完即走，因此不进 localStorage、不做 onboarding。 */}
        <div className={styles.editorActions}>
          <span className={styles.exportHint}>
            打印时请选择「另存为 PDF」，并关闭「页眉和页脚」。
          </span>
          <button
            type="button"
            className={styles.exportButton}
            onClick={handleExportPdf}
          >
            导出 PDF
          </button>
        </div>
      </div>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <BasicInfoForm
            profile={resume.profile}
            targetRole={resume.targetRole}
            onChange={handleBasicInfoChange}
          />

          {/* 模块显示放在基本信息之后、四类内容表单之前：
              先决定「这份简历要不要这一块」，再往下编辑具体内容。 */}
          <SectionVisibilityControls
            sections={resume.sections}
            onChange={handleSectionVisibilityChange}
          />

          {workSection ? (
            <WorkExperienceForm
              items={workSection.items}
              onAddItem={handleWorkAddItem}
              onChangeField={handleWorkChangeField}
              onRemoveItem={handleWorkRemoveItem}
              onAddBullet={handleWorkAddBullet}
              onChangeBullet={handleWorkChangeBullet}
              onRemoveBullet={handleWorkRemoveBullet}
            />
          ) : (
            <p className={styles.missingSection}>当前简历没有工作经历模块。</p>
          )}

          {educationSection ? (
            <EducationExperienceForm
              items={educationSection.items}
              onAddItem={handleEducationAddItem}
              onChangeField={handleEducationChangeField}
              onRemoveItem={handleEducationRemoveItem}
              onAddBullet={handleEducationAddBullet}
              onChangeBullet={handleEducationChangeBullet}
              onRemoveBullet={handleEducationRemoveBullet}
            />
          ) : (
            <p className={styles.missingSection}>当前简历没有教育经历模块。</p>
          )}

          {projectSection ? (
            <ProjectExperienceForm
              items={projectSection.items}
              onAddItem={handleProjectAddItem}
              onChangeField={handleProjectChangeField}
              onRemoveItem={handleProjectRemoveItem}
              onAddBullet={handleProjectAddBullet}
              onChangeBullet={handleProjectChangeBullet}
              onRemoveBullet={handleProjectRemoveBullet}
            />
          ) : (
            <p className={styles.missingSection}>当前简历没有项目经历模块。</p>
          )}

          {skillsSection ? (
            <SkillsForm
              items={skillsSection.items}
              onAddItem={handleSkillAddItem}
              onChangeField={handleSkillChangeField}
              onRemoveItem={handleSkillRemoveItem}
            />
          ) : (
            <p className={styles.missingSection}>当前简历没有技能模块。</p>
          )}
        </aside>

        <div className={styles.previewArea}>
          <div className={styles.stage}>
            <div className={styles.paperSlot}>
              <ResumeTemplateRenderer resume={resume} />
            </div>
          </div>
        </div>

        {/* 右侧样式栏（05 第 2 节）。
            模板选择从 M4 的预览工具栏**移动**到这里，与主题色 / 字体 / 密度 / 头像
            放在一起——它们都属于「改展示方式」，而预览区只负责展示结果。
            M4 那条 .previewToolbar 因此被删除，模板切换仍然只有一个入口。 */}
        <aside className={styles.styleSidebar}>
          <TemplateSwitcher
            templateId={resume.templateId}
            onChange={handleTemplateChange}
          />

          <StyleControls
            style={resume.style}
            hasAvatar={hasAvatar}
            onChange={handleStyleChange}
          />
        </aside>
      </div>
    </div>
  );
}


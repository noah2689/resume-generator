import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import BasicInfoForm, {
  type EditableBasicInfoField,
} from '../components/BasicInfoForm';
import EducationExperienceForm from '../components/EducationExperienceForm';
import ProjectExperienceForm from '../components/ProjectExperienceForm';
import SectionVisibilityControls from '../components/SectionVisibilityControls';
import SkillsForm from '../components/SkillsForm';
import TemplateSwitcher from '../components/TemplateSwitcher';
import WorkExperienceForm from '../components/WorkExperienceForm';
import { sampleResume } from '../data/sampleResume';
import { loadResumeFromStorage, saveResumeToStorage } from '../storage/resumeStorage';
import ResumeTemplateRenderer from '../templates/ResumeTemplateRenderer';
import type { Resume } from '../types/resume';
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
 * - 左侧：模块显示 + 基本信息 + 工作经历 + 教育经历 + 项目经历 + 技能
 * - 右侧：预览工具栏（模板选择）+ A4 简历预览
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
 *       └── 右侧 ResumeTemplateRenderer(resume) → 按 templateId 选模板组件
 *
 *   resume 真正变成新对象 → useEffect → saveResumeToStorage
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
 * - 简历纸面与排版属于模板组件（SimpleSingleColumn / BusinessSingleColumn / TwoColumn）。
 * - Section 排序属于后续阶段。
 *
 * 已知问题（记录，本阶段不处理）：
 * CRUD、显隐、持久化、模板切换逐步接入后，本文件持续变长。
 * **行数本身不是重构触发条件**：M2 总验收后仍决定保持各类型 CRUD 独立，
 * 是否拆出 hook / controller 属于后续按职责单独评估的独立判断，
 * 不在任何单个任务里顺手做，也从不因为「超过某个行数」就自动动手。
 */
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
   * 自动保存：resume 真正变成新对象后，把整份 Resume 写回 LocalStorage。
   *
   * 只在 state 生命周期里保存一次，不给 handlers 或各个 edits 纯函数加存储调用。
   * 没有防抖、没有手动保存按钮、没有保存状态 UI——Resume 很小，写一次 JSON 足够。
   */
  useEffect(() => {
    if (!resume) {
      return;
    }
    if (resume === initialResumeRef.current) {
      return;
    }
    saveResumeToStorage(resume);
  }, [resume]);

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

  return (
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
        {/* 预览工具栏：M4 只放模板切换，位于 A4 舞台上方。
            这里不提前建立 M5 的右侧样式栏。 */}
        <div className={styles.previewToolbar}>
          <TemplateSwitcher
            templateId={resume.templateId}
            onChange={handleTemplateChange}
          />
        </div>

        <div className={styles.stage}>
          <div className={styles.paperSlot}>
            <ResumeTemplateRenderer resume={resume} />
          </div>
        </div>
      </div>
    </div>
  );
}


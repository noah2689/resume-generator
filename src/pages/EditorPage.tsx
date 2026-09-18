import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import BasicInfoForm, {
  type EditableBasicInfoField,
} from '../components/BasicInfoForm';
import EducationExperienceForm from '../components/EducationExperienceForm';
import ProjectExperienceForm from '../components/ProjectExperienceForm';
import SectionVisibilityControls from '../components/SectionVisibilityControls';
import SkillsForm from '../components/SkillsForm';
import WorkExperienceForm from '../components/WorkExperienceForm';
import { sampleResume } from '../data/sampleResume';
import SimpleSingleColumn from '../templates/SimpleSingleColumn';
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
 * - 左侧：模块显示 + 基本信息 + 工作经历 + 教育经历 + 项目经历 + 技能
 * - 右侧：A4 简历预览
 *
 * 数据流：
 *
 *   sampleResume
 *       ↓ 初始化
 *   EditorPage resume state
 *       ├── 左侧 BasicInfoForm 修改 profile / targetRole
 *       ├── 左侧 SectionVisibilityControls 修改各 Section 的 visible
 *       ├── 左侧 WorkExperienceForm 修改 work section 的 items
 *       ├── 左侧 EducationExperienceForm 修改 education section 的 items
 *       ├── 左侧 ProjectExperienceForm 修改 project section 的 items
 *       ├── 左侧 SkillsForm 修改 skills section 的 items
 *       └── 右侧 SimpleSingleColumn(resume)
 *
 * 职责边界：
 * - 本页持有 Resume 状态（不拆 Context / store / reducer），并负责布局。
 * - 各 Section 的嵌套不可变更新分别实现在 ./workEdits / ./educationEdits / ./projectEdits / ./skillsEdits，
 *   本页只做「把 state 传进去、把结果存回来」。四者刻意不合并成通用 CRUD 层。
 * - Section 显隐实现在 ./sectionVisibility：它只改 Section 外壳的 visible，
 *   与四套 item CRUD 是不同层次的东西，因此不放进任何一个 edits 文件。
 * - 简历纸面与排版属于模板组件。
 * - Section 排序属于后续阶段。
 * - 本阶段没有持久化：刷新后回到示例数据是正确行为。
 *
 * 已知问题（记录，本阶段不处理）：
 * 四组 CRUD + 显隐接入后本文件持续变长：M2.4 为 354 行，M2.5 为 406 行，M2.6 后 441 行。
 * **行数本身不是重构触发条件**：M2 总验收后仍决定保持各类型 CRUD 独立，
 * 是否拆出 hook / controller 属于后续按职责单独评估的独立判断，
 * 不在任何单个任务里顺手做，也不因为「超过 400 行」就自动动手。
 */
export default function EditorPage() {
  const { resumeId } = useParams<{ resumeId: string }>();

  // M2.1 仍然只有一份示例数据，因此这里直接比较 ID。
  // 简历列表与持久化属于后续 Milestone，暂不引入任何存储层。
  const found: Resume | null = sampleResume.id === resumeId ? sampleResume : null;

  /**
   * Resume state 只放在本页。
   *
   * 初始化直接以找到的 Resume 作为初始值，不做深拷贝：
   * 只要严格遵守下面的不可变更新规则（每次返回新的 root/profile/sections 对象，
   * 不直接给 resume 的字段赋值、不改动任何数组），
   * 模块级的 sampleResume 就不会被修改。
   *
   * 已知限制：当前只有一份示例简历，因此接受「路由参数在运行期间
   * 不会切换到另一份 Resume」。将来支持多份简历切换时，需要补上
   * 状态重置（例如拆分内层组件并加 key，或监听 resumeId 变化）。
   */
  const [resume, setResume] = useState<Resume | null>(found);

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
        <div className={styles.stage}>
          <div className={styles.paperSlot}>
            <SimpleSingleColumn resume={resume} />
          </div>
        </div>
      </div>
    </div>
  );
}


import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import BasicInfoForm, {
  type EditableBasicInfoField,
} from '../components/BasicInfoForm';
import EducationExperienceForm from '../components/EducationExperienceForm';
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
 * - 左侧：基本信息表单 + 工作经历表单 + 教育经历表单
 * - 右侧：A4 简历预览
 *
 * 数据流：
 *
 *   sampleResume
 *       ↓ 初始化
 *   EditorPage resume state
 *       ├── 左侧 BasicInfoForm 修改 profile / targetRole
 *       ├── 左侧 WorkExperienceForm 修改 work section 的 items
 *       ├── 左侧 EducationExperienceForm 修改 education section 的 items
 *       └── 右侧 SimpleSingleColumn(resume)
 *
 * 职责边界：
 * - 本页持有 Resume 状态（不拆 Context / store / reducer），并负责布局。
 * - 各 Section 的嵌套不可变更新分别实现在 ./workEdits 与 ./educationEdits，
 *   本页只做「把 state 传进去、把结果存回来」。两者刻意不合并成通用 CRUD 层。
 * - 简历纸面与排版属于模板组件。
 * - 项目 / 技能编辑、Section 显示隐藏与排序属于后续阶段。
 * - 本阶段没有持久化：刷新后回到示例数据是正确行为。
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
   * 更新函数不同，现在只有一个稳定样本，还看不出真正的共性在哪。
   * 重复本身是后续判断抽象是否合理的证据。
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

  // 只读地用一下 work / education section：有就渲染表单，没有就显示提示。
  // 这里不创建 Section——Section 的新增 / 删除属于之后的任务。
  const workSection = resume.sections.find((section) => section.type === 'work');
  const educationSection = resume.sections.find(
    (section) => section.type === 'education',
  );

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <BasicInfoForm
          profile={resume.profile}
          targetRole={resume.targetRole}
          onChange={handleBasicInfoChange}
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


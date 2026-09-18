/**
 * Resume 数据结构类型定义
 *
 * 依据：docs/ai-context/03_RESUME_DATA_SCHEMA.md
 *
 * 约定：
 * - 模板只读取本文件定义的数据，不新增模板专属字段。
 * - 长文本一律使用 string[]，不在数据层保存已排版的 HTML。
 * - style 只保存选项名，不保存 CSS 字符串或具体数值。
 */

/** 页面密度。具体字号/行高/间距由模板内部映射，数据层只存选项名。 */
export type Density = 'loose' | 'standard' | 'compact';

export interface ResumeProfile {
  name: string;
  avatar: string;
  phone: string;
  email: string;
  city: string;
  gender: string;
  birthYear: string;
  website: string;
  wechat: string;
}

export interface EducationItem {
  id: string;
  school: string;
  major: string;
  degree: string;
  startDate: string;
  endDate: string;
  city: string;
  description: string[];
}

export interface WorkItem {
  id: string;
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  city: string;
  description: string[];
}

export interface ProjectItem {
  id: string;
  name: string;
  role: string;
  startDate: string;
  endDate: string;
  description: string[];
}

export interface SkillItem {
  id: string;
  name: string;
  level: string;
}

/** Section 通用外壳字段。所有类型的 Section 都复用它。 */
interface SectionBase {
  id: string;
  title: string;
  visible: boolean;
  order: number;
}

export interface EducationSection extends SectionBase {
  type: 'education';
  items: EducationItem[];
}

export interface WorkSection extends SectionBase {
  type: 'work';
  items: WorkItem[];
}

export interface ProjectSection extends SectionBase {
  type: 'project';
  items: ProjectItem[];
}

export interface SkillsSection extends SectionBase {
  type: 'skills';
  items: SkillItem[];
}

/**
 * 当前文档已明确的数据结构只有这四种。
 * 后续若需要「求职意向 / 个人优势 / 证书荣誉 / 自我评价」等模块，
 * 应先明确修改 03_RESUME_DATA_SCHEMA.md，再扩展此联合类型。
 */
export type ResumeSection =
  | EducationSection
  | WorkSection
  | ProjectSection
  | SkillsSection;

export type SectionType = ResumeSection['type'];

/** 用户样式设置。与简历内容分离存放，只保存选项名。 */
export interface ResumeStyle {
  themeColor: string;
  fontFamily: string;
  density: Density;
  showAvatar: boolean;
}

/** 顶层简历结构。同一份数据可被不同模板渲染。 */
export interface Resume {
  id: string;
  title: string;
  locale: string;
  targetRole: string;
  profile: ResumeProfile;
  sections: ResumeSection[];
  style: ResumeStyle;
  /** 仅引用模板 ID，切换它不得修改 sections 内容。 */
  templateId: string;
  /** 结构升级时用于迁移，不为了小功能破坏历史数据。 */
  schemaVersion: number;
}

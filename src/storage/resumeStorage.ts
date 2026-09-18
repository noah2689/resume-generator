/**
 * Resume 持久化边界（M3）。
 *
 * 依据：docs/ai-context/07_MILESTONES_AND_ACCEPTANCE.md 的 M3「保存与恢复」。
 *
 * 职责只有一件事：把**整份 Resume** 写进 LocalStorage，或从 LocalStorage 读回来。
 * 保存的是完整 Resume JSON，不保存 patch / action log / 分片字段——
 * 一份 Resume 就是一份完整真相来源。
 *
 * 边界：
 * - 无状态、不缓存、不订阅。每次调用都是独立的一次读写。
 * - 只读写 LocalStorage，不知道谁在调用它，也不碰 React state。
 * - 读取失败一律返回 null，由调用方决定回退（当前是 sampleResume）。
 *   **不迁移、不删除坏数据、不覆盖旧值**：当前没有迁移能力，
 *   静默删除用户旧数据比「暂时读不了」更不可逆。
 * - 写入失败静默吞掉：内存里的编辑应当继续正常工作。
 * - 校验只排除「明显会让现有 UI / 模板崩溃的结构性坏数据」，
 *   不是完整运行时 Schema 校验器——那会把 types/resume.ts 复制成第二套 Schema。
 */

import type { Resume, SectionType } from '../types/resume';

/** 存储 key 的命名空间，避免与同域其他应用冲突。 */
const STORAGE_KEY_PREFIX = 'resume-generator:resume:';

/**
 * 当前 Schema 已明确的四种 Section 类型。
 * 用 `satisfies` 让编译器保证这里不会写错类型名。
 */
const KNOWN_SECTION_TYPES = [
  'education',
  'work',
  'project',
  'skills',
] as const satisfies readonly SectionType[];

/**
 * 按 resumeId 隔离的存储 key。
 *
 * 形如 `resume-generator:resume:resume_001`。
 * 刻意不把 schemaVersion 放进 key：放进去会让旧数据永远读不到，也没法被将来的迁移函数读到。
 * 内部 helper，不导出——外部不需要知道 key 长什么样。
 */
function getResumeStorageKey(resumeId: string): string {
  return `${STORAGE_KEY_PREFIX}${resumeId}`;
}

/** 非 null、非数组的普通对象。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 校验单个 Section 的外壳。
 *
 * 只看模板与表单真正会读到的字段，不深入 item 的业务字段。
 * 目的：挡住 `sections: [null]` 这类能通过顶层检查、
 * 却会在模板读取 `section.visible` 时直接崩溃的数据。
 */
function hasValidSectionShell(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.id !== 'string' || typeof value.title !== 'string') {
    return false;
  }
  if (typeof value.visible !== 'boolean' || typeof value.order !== 'number') {
    return false;
  }

  const sectionType: unknown = value.type;
  if (typeof sectionType !== 'string') {
    return false;
  }
  if (!KNOWN_SECTION_TYPES.includes(sectionType as SectionType)) {
    return false;
  }

  if (!Array.isArray(value.items)) {
    return false;
  }

  // skills 是异形结构（只有 name / level），没有 description 层。
  const isSkills = sectionType === 'skills';
  for (const item of value.items) {
    if (!isRecord(item) || typeof item.id !== 'string') {
      return false;
    }
    if (!isSkills && !Array.isArray(item.description)) {
      return false;
    }
  }

  return true;
}

/**
 * 判断解析结果是不是「当前版本可用的 Resume」。
 *
 * 只做顶层字段的存在性 / 类型检查，加上 Section 外壳检查；
 * 不校验 profile / style 的各个字段，不校验枚举取值，不校验 description 里是否都是字符串。
 */
function isStoredResumeCandidate(
  value: unknown,
  resumeId: string,
  expectedSchemaVersion: number,
): value is Resume {
  if (!isRecord(value)) {
    return false;
  }
  if (value.id !== resumeId) {
    return false;
  }
  if (value.schemaVersion !== expectedSchemaVersion) {
    return false;
  }
  if (
    typeof value.title !== 'string' ||
    typeof value.locale !== 'string' ||
    typeof value.targetRole !== 'string' ||
    typeof value.templateId !== 'string'
  ) {
    return false;
  }
  if (!isRecord(value.profile) || !isRecord(value.style)) {
    return false;
  }
  if (!Array.isArray(value.sections)) {
    return false;
  }

  return value.sections.every(hasValidSectionShell);
}

/**
 * 读取简历：整份 Resume，或 null。
 *
 * 返回 null 的全部情况（调用方据此回退到 sampleResume）：
 * - 该 resumeId 没有存过数据
 * - 存储内容不是合法 JSON
 * - 结构与当前 Schema 不符（含 id 不匹配、schemaVersion 不匹配、Section 外壳损坏）
 * - LocalStorage 本身读取失败（被禁用、SecurityError 等）
 *
 * 以上任何情况都**不会**删除或改写存储里的原有内容。
 */
export function loadResumeFromStorage(
  resumeId: string,
  expectedSchemaVersion: number,
): Resume | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(getResumeStorageKey(resumeId));
  } catch {
    return null;
  }
  if (raw === null) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  return isStoredResumeCandidate(parsed, resumeId, expectedSchemaVersion)
    ? parsed
    : null;
}

/**
 * 保存简历（整份 JSON）。
 *
 * 写入失败（配额满 / 存储被禁用 / 隐私模式）时静默返回：
 * 页面不该因为持久化不可用而崩掉，内存里的编辑继续有效。
 */
export function saveResumeToStorage(resume: Resume): void {
  try {
    localStorage.setItem(
      getResumeStorageKey(resume.id),
      JSON.stringify(resume),
    );
  } catch {
    // 有意为空：持久化是增强能力，不是编辑的前置条件。
  }
}

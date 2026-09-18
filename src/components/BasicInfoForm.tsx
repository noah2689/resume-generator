import styles from './BasicInfoForm.module.css';

/**
 * 基本信息表单
 *
 * 职责（严格限定）：
 * - 显示基本信息字段的受控输入框
 * - 接收当前值
 * - 把字段变化回调给 EditorPage
 *
 * 本组件的边界：
 * - 不持有 Resume 状态，状态属于 EditorPage。
 * - 不自己取数（不读路由 / 不 import sampleResume / 不读存储）。
 * - 不做字段校验。
 * - 不是通用表单系统：没有字段注册表、没有 schema 驱动渲染。就是下面 5 个写死的字段。
 *
 * 本次只暴露 5 个字段。avatar / gender / birthYear / website / wechat
 * 仍保留在数据结构中，但暂不在 UI 中暴露。
 */

/**
 * 本表单可编辑的字段名。
 *
 * 注意：这不是另一套数据结构，只是一组字段名的枚举，
 * 且完全来自 03_RESUME_DATA_SCHEMA.md 已有的字段。
 * 表单读写的始终是真实的 ResumeProfile，不存在平行的 draft 结构。
 */
export type EditableBasicInfoField =
  | 'name'
  | 'targetRole'
  | 'phone'
  | 'email'
  | 'city';

interface BasicInfoFormProps {
  /** 当前基本信息。包含 name / phone / email / city。 */
  profile: {
    name: string;
    phone: string;
    email: string;
    city: string;
  };
  /** 目标岗位。它属于 Resume 顶层，不属于 profile。 */
  targetRole: string;
  onChange: (field: EditableBasicInfoField, value: string) => void;
}

export default function BasicInfoForm({
  profile,
  targetRole,
  onChange,
}: BasicInfoFormProps) {
  return (
    <section className={styles.wrapper}>
      <h2 className={styles.title}>基本信息</h2>

      <Field
        id="basic-info-name"
        label="姓名"
        value={profile.name}
        onChange={(value) => onChange('name', value)}
      />
      <Field
        id="basic-info-target-role"
        label="目标岗位"
        value={targetRole}
        onChange={(value) => onChange('targetRole', value)}
      />
      <Field
        id="basic-info-phone"
        label="手机"
        value={profile.phone}
        onChange={(value) => onChange('phone', value)}
      />
      <Field
        id="basic-info-email"
        label="邮箱"
        value={profile.email}
        onChange={(value) => onChange('email', value)}
      />
      <Field
        id="basic-info-city"
        label="城市"
        value={profile.city}
        onChange={(value) => onChange('city', value)}
      />
    </section>
  );
}

/**
 * 一个受控输入行。
 *
 * 用 <label htmlFor> 关联 <input id>，点击文字即可聚焦输入框。
 * 不引入额外的无障碍框架。
 */
function Field({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={styles.input}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

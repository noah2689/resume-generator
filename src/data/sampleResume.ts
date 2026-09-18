import type { Resume } from '../types/resume';

/**
 * M0 固定示例数据：中文产品经理简历。
 *
 * 依据：docs/ai-context/02_MVP_PRODUCT_SPEC.md 第 8 节（第一版演示数据）
 *
 * 说明：
 * - 本文件只使用 03_RESUME_DATA_SCHEMA.md 已明确的数据结构。
 * - 暂不覆盖「求职意向 / 个人优势 / 证书荣誉 / 自我评价」等尚未定稿的模块。
 * - M0 用它证明「类型定义 → 示例数据 → 页面读取」链路成立。
 *   修改这里的任意字段，编辑器页面应随之变化。
 */
export const sampleResume: Resume = {
  id: 'resume_001',
  title: '产品经理简历',
  locale: 'zh-CN',
  targetRole: '产品经理',
  schemaVersion: 1,
  templateId: 'simple-single-column',
  profile: {
    name: '张三',
    avatar: '',
    phone: '13800000000',
    email: 'zhangsan@example.com',
    city: '上海',
    gender: '',
    birthYear: '',
    website: '',
    wechat: '',
  },
  style: {
    themeColor: 'navy',
    fontFamily: 'noto-sans-sc',
    density: 'standard',
    showAvatar: true,
  },
  sections: [
    {
      id: 'section_education',
      type: 'education',
      title: '教育经历',
      visible: true,
      order: 10,
      items: [
        {
          id: 'edu_001',
          school: '某某大学',
          major: '信息管理',
          degree: '本科',
          startDate: '2018-09',
          endDate: '2022-06',
          city: '上海',
          description: ['GPA 3.7/4.0', '主修课程：产品设计、统计学、数据库'],
        },
      ],
    },
    {
      id: 'section_work',
      type: 'work',
      title: '工作经历',
      visible: true,
      order: 20,
      items: [
        {
          id: 'work_001',
          company: '某互联网公司',
          role: '产品经理',
          startDate: '2023-01',
          endDate: '至今',
          city: '上海',
          description: [
            '负责会员产品核心链路规划与迭代',
            '推动注册转化率提升 12%',
            '与研发、设计和运营协作完成 6 个版本',
          ],
        },
        {
          id: 'work_002',
          company: '某科技公司',
          role: '产品助理',
          startDate: '2022-07',
          endDate: '2022-12',
          city: '杭州',
          description: ['参与用户调研与需求文档撰写', '协助完成竞品分析报告'],
        },
      ],
    },
    {
      id: 'section_project',
      type: 'project',
      title: '项目经历',
      visible: true,
      order: 30,
      items: [
        {
          id: 'project_001',
          name: '会员增长项目',
          role: '产品负责人',
          startDate: '2024-01',
          endDate: '2024-06',
          description: ['重构新用户会员转化路径', '通过 A/B 测试提升付费转化'],
        },
        {
          id: 'project_002',
          name: '会员权益改版',
          role: '产品经理',
          startDate: '2023-05',
          endDate: '2023-11',
          description: ['梳理权益体系并完成分级设计', '上线后会员续费率提升 8%'],
        },
      ],
    },
    {
      id: 'section_skills',
      type: 'skills',
      title: '技能',
      visible: true,
      order: 40,
      items: [
        { id: 'skill_001', name: 'Axure', level: '熟练' },
        { id: 'skill_002', name: 'SQL', level: '熟练' },
        { id: 'skill_003', name: '数据分析', level: '熟练' },
        { id: 'skill_004', name: 'Figma', level: '了解' },
      ],
    },
  ],
};

# 03｜简历数据结构规范

## 1. 核心原则

简历内容必须独立于模板。

任何模板都读取同一份 Resume 数据。

模板不能改变 Resume 的核心 Schema。

---

## 2. 顶层结构

推荐概念结构：

```json
{
  "id": "resume_001",
  "title": "产品经理简历",
  "locale": "zh-CN",
  "targetRole": "产品经理",
  "profile": {},
  "sections": [],
  "style": {},
  "templateId": "simple-single-column"
}
```

---

## 3. 基本信息 profile

```json
{
  "name": "张三",
  "avatar": "",
  "phone": "13800000000",
  "email": "zhangsan@example.com",
  "city": "上海",
  "gender": "",
  "birthYear": "",
  "website": "",
  "wechat": ""
}
```

字段可以为空。

模板自行决定哪些空字段不显示。

---

## 4. Section 通用结构

不同内容模块应尽量使用统一 Section 外壳。

```json
{
  "id": "section_work",
  "type": "work",
  "title": "工作经历",
  "visible": true,
  "order": 30,
  "items": []
}
```

---

## 5. 教育经历 education

```json
{
  "id": "edu_001",
  "school": "某某大学",
  "major": "信息管理",
  "degree": "本科",
  "startDate": "2018-09",
  "endDate": "2022-06",
  "city": "上海",
  "description": [
    "GPA 3.7/4.0",
    "主修课程：产品设计、统计学、数据库"
  ]
}
```

---

## 6. 工作经历 work

```json
{
  "id": "work_001",
  "company": "某互联网公司",
  "role": "产品经理",
  "startDate": "2023-01",
  "endDate": "至今",
  "city": "上海",
  "description": [
    "负责会员产品核心链路规划与迭代",
    "推动注册转化率提升 12%",
    "与研发、设计和运营协作完成 6 个版本"
  ]
}
```

description 使用数组。

不要在数据层保存已经排版好的 HTML。

---

## 7. 项目经历 project

```json
{
  "id": "project_001",
  "name": "会员增长项目",
  "role": "产品负责人",
  "startDate": "2024-01",
  "endDate": "2024-06",
  "description": [
    "重构新用户会员转化路径",
    "通过 A/B 测试提升付费转化"
  ]
}
```

---

## 8. 技能 skills

MVP 使用简单结构：

```json
{
  "id": "skill_001",
  "name": "Axure",
  "level": "熟练"
}
```

不要第一版做复杂技能雷达图。

---

## 9. 自定义文本模块

为了避免未来不断新增 Schema，可以提供通用模块：

```json
{
  "id": "custom_001",
  "type": "custom",
  "title": "校园经历",
  "visible": true,
  "items": [
    {
      "title": "学生会",
      "subtitle": "宣传部负责人",
      "startDate": "2020-09",
      "endDate": "2021-06",
      "description": [
        "负责活动策划和宣传"
      ]
    }
  ]
}
```

---

## 10. 样式数据 style

用户样式设置与 Resume Content 分开。

```json
{
  "themeColor": "navy",
  "fontFamily": "noto-sans-sc",
  "density": "standard",
  "showAvatar": true
}
```

不要把 CSS 字符串直接写进数据库。

---

## 11. 模板字段 templateId

```json
{
  "templateId": "simple-single-column"
}
```

模板 ID 只是引用。

切换 templateId 不得修改 sections 内容。

---

## 12. Schema 版本

推荐预留：

```json
{
  "schemaVersion": 1
}
```

未来数据结构升级时使用迁移函数。

禁止为了小功能直接破坏历史数据。

---

## 13. 数据层禁止项

数据中不要保存：

- 绝对坐标
- Office XML
- Word 样式 ID
- 字体文件路径
- 模板 HTML 快照
- PDF 二进制作为主数据
- 每个模板一份重复简历
- 任意 CSS

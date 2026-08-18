# 真人样本库 - 前端

基于微信公众号的问卷发放平台前端。

## 功能

- **项目管理**：创建、管理调研项目，含表单验证
- **画像管理**：7维度用户画像统计与筛选（性别/年龄/学历/地区/行业/职业/收入）
- **用户库**：OpenID查询用户画像
- **红包发放**：红包发放确认与记录
- **数据导出**：支持Excel导出用户数据

## 技术栈

- React 18 + TypeScript
- Vite
- Tailwind CSS
- React Router v6
- Recharts（图表）
- XLSX（Excel导出）

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 页面结构

```
src/
├── pages/
│   ├── Overview/          # 数据概览
│   ├── Projects/          # 项目管理
│   │   ├── ProjectList.tsx    # 项目列表
│   │   ├── NewProject.tsx     # 新建项目（含表单验证）
│   │   └── ProjectDetail.tsx   # 项目详情
│   ├── Users/             # 用户管理
│   │   ├── UserLibrary.tsx    # 用户库（OpenID查询）
│   │   └── UserProfileManage.tsx  # 画像管理
│   ├── Statistics/        # 统计
│   ├── Hongbao/           # 红包管理
│   └── Settings/          # 设置
├── components/            # 公共组件
├── data/                  # 静态数据
│   ├── dimensions.ts      # 7维度定义
│   ├── cityTierMap.ts    # 城市级别映射
│   └── regionData.ts     # 地区数据
├── services/             # 服务层
│   ├── mockData.ts       # 模拟数据（2000用户）
│   ├── dataUtils.ts      # 数据处理工具
│   └── webhookService.ts # Webhook处理
├── hooks/                # 自定义Hook
└── types/                # TypeScript类型
```

## 字段定义

### 注册问卷字段（7维度）

| 字段 | 中文名 | 枚举值 |
|------|--------|--------|
| gender | 性别 | 男、女 |
| birth_year | 出生年份 | 1960年前 - 2012年 |
| education | 最高学历 | 初中及以下、高中/中专/技校、大学专科、大学本科、硕士及以上 |
| province | 省份 | 全国各省 |
| city | 城市 | 全国各地 |
| occupation | 职业 | 13个选项 |
| industry | 从事行业 | 14个选项 |
| income | 个人月收入 | 10个区间 |
| openid | 微信OpenID | 用户唯一标识 |

### 派生字段

| 字段 | 计算方式 |
|------|----------|
| age_group | 由 birth_year 计算年龄段 |
| city_tier | 由 city 查表得到城市级别 |

## 业务流程

```
用户关注公众号
      ↓
填写注册问卷（7维度 + openid）
      ↓
我们筛选目标用户
      ↓
发送微信模板消息（带问卷链接 + openid）
      ↓
用户点击 → 跳转腾讯问卷答题
      ↓
腾讯问卷 Webhook 回传数据
      ↓
我们匹配用户画像 + 答题数据
      ↓
审核排除无效答卷
      ↓
发放红包
```

## 注意事项

1. 构建后需重启 preview 服务：`npx vite preview --port 4173 --host`
2. 前端不直接连接数据库，通过后端API交互
3. 导出功能使用 XLSX 库，支持 .xlsx 格式

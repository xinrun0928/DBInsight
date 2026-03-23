# 快速开始

## 环境要求

- Node.js 18+
- npm 9+

## 本地运行

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览构建产物
npm run preview
```

## 项目结构

```
docs/
├── index.md              # 首页
├── guide/                # 指南文档
│   ├── index.md
│   └── getting-started.md
├── mysql/                # MySQL 数据库文档
│   ├── index.md
│   ├── basic/            # 基础入门
│   ├── sql/              # SQL 语法
│   ├── object/           # 数据库对象
│   ├── advanced/         # 高级特性
│   ├── optimize/         # 性能优化
│   ├── transaction/      # 事务与锁
│   └── replication/       # 主从复制
├── mongodb/              # MongoDB 文档（待完善）
├── redis/                # Redis 文档（待完善）
└── .vitepress/            # VitePress 配置
    ├── config.js         # 主配置文件
    ├── nav.js            # 导航栏配置
    └── sidebar/          # 侧边栏配置
```

## 文档目录说明

| 目录 | 说明 |
|-----|-----|
| `basic/` | 数据库基础概念、安装配置 |
| `sql/` | SQL 语法详解（查询、函数、子查询等） |
| `object/` | 数据库对象管理（表、视图、存储过程等） |
| `advanced/` | 高级特性（存储引擎、用户权限、架构原理） |
| `optimize/` | 性能优化（索引、SQL 优化、工具使用） |
| `transaction/` | 事务、锁、MVCC、日志体系 |
| `replication/` | 主从复制、备份恢复 |

## 下一步

- [MySQL 基础入门](/mysql/index)

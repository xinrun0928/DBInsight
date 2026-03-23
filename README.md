# DBInsight

**数据库，不只是增删改查。**

DBInsight 是一个数据库技术文档网站，从一条 SQL 的执行过程出发，深入探讨索引、事务、锁的底层逻辑——不止于会用，而在于理解它为什么这样工作。

当前主要涵盖 MySQL，未来将扩展至 MongoDB、Redis、PostgreSQL 等主流数据库。

---

## 在线访问

生产环境部署地址：https://xinrun0928.github.io/DBInsight/

## 本地运行

```bash
npm install
npm run dev
```

访问 http://localhost:3000

## 构建部署

```bash
npm run deploy
```

## 技术栈

- [VitePress](https://vitepress.dev/) — 静态文档站点生成器
- Vue 3 — 站点框架

## 项目结构

```
DBInsight/
├── docs/                      # 文档源文件（Markdown）
│   ├── index.md               # 首页
│   ├── guide/                  # 入门指南
│   ├── mysql/                 # MySQL 文档
│   ├── mongodb/               # MongoDB 文档（规划中）
│   ├── redis/                 # Redis 文档（规划中）
│   ├── postgresql/            # PostgreSQL 文档（规划中）
│   └── .vitepress/            # VitePress 配置
│       ├── config.js          # 主配置
│       ├── nav.js             # 导航栏
│       └── sidebar/           # 各模块侧边栏
├── deploy.sh                  # 部署脚本
└── package.json
```

## License

MIT

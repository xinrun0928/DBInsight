# 索引与性能优化

凌晨 3 点，你的监控系统报警：数据库 CPU 100%，所有接口超时。

你翻遍代码没发现问题，重启服务后好了 5 分钟，然后再次崩溃。

这不是代码的错——是你的查询没有索引，全表扫描把数据库跑死了。

MySQL 性能优化，80% 的问题都出在索引上。学会索引，就学会了 MySQL 性能优化的精髓。

---

## 内容地图

本模块覆盖 MySQL 性能优化的核心知识，从索引原理到 SQL 调优，是面试和实战中最常考的领域。

### 索引基础

- [索引基础：什么是索引、为什么快、什么时候值得建](/database/mysql/optimize/index/basic)
- [索引类型：聚簇索引 vs 二级索引、联合索引、B+ 树、Hash 索引](/database/mysql/optimize/index/type)
- [索引操作：分类体系、创建与删除、降序索引、隐藏索引](/database/mysql/optimize/index/ops)
- [索引设计：适合/不适合创建索引的场景](/database/mysql/optimize/index/scenario)

### InnoDB 存储结构

- [页结构：数据页的 7 个组成部分、记录头信息、页目录](/database/mysql/optimize/innodb/page)
- [行格式：Compact vs Dynamic、行溢出详解](/database/mysql/optimize/innodb/row-format)
- [表空间：区、段、碎片区、表空间结构](/database/mysql/optimize/innodb/space)

### 性能分析工具

- [慢查询日志：配置、阈值、SHOW PROFILE](/database/mysql/optimize/tool/slow-log)
- [EXPLAIN：type/key/rows/Extra 核心字段解读](/database/mysql/optimize/tool/explain)
- [trace：SQL 执行的完整跟踪、Sys schema](/database/mysql/optimize/tool/trace)

### SQL 优化实战

- [索引失效的 11 种情况：最常踩的坑](/database/mysql/optimize/sql/index-invalid)
- [JOIN 与子查询优化：驱动表选择、排序分组优化](/database/mysql/optimize/sql/join-subquery)
- [分页优化：深度分页问题、覆盖索引、ICP](/database/mysql/optimize/sql/pagination-covering)
- [主键与表设计：自增主键、UUID、范式与反范式](/database/mysql/optimize/sql/design)
- [数据库调优：硬件配置、参数调优、大表优化](/database/mysql/optimize/overall-tuning)

---

## 学习路径

```
第一天：理解索引原理（索引类型 + InnoDB 结构）
第二天：掌握分析工具（慢查询日志 + EXPLAIN）
第三天：SQL 优化实战（索引失效 + 常见优化）
```

建议先从 [索引基础](/database/mysql/optimize/index/basic) 入手，理解 B+ 树为什么比全表扫描快，再学习 EXPLAIN 工具，最后才是具体的优化技巧。没有原理支撑的优化是盲目的。

---

## 下一步

索引是什么？为什么它能让查询快几十倍？

从 [索引基础](/database/mysql/optimize/index/basic) 开始。

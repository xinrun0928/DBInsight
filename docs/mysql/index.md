# MySQL 数据库

MySQL 是全球最流行的开源关系型数据库，从中小型网站到亿级流量的大厂，都能见到它的身影。

本模块系统地覆盖 MySQL 从入门到进阶的完整知识体系——从基础的 SQL 语法，到表结构设计，到性能优化，到事务锁机制，到主从复制与备份恢复。无论你是 MySQL 初学者，还是想系统性地提升 MySQL 技能，这里都有你需要的内容。

---

## 内容地图

### 第一部分：MySQL 基础入门

从零开始，搭建开发环境，理解数据库的核心概念。

- [MySQL 教程简介：学什么、怎么学](/database/mysql/basic/overview)
- [数据库核心概念：DBMS / 关系型 / SQL](/database/mysql/basic/db-concept)
- [RDBMS vs 非关系型：ER 模型与表关系](/database/mysql/basic/rdbms-er)
- [MySQL 安装与配置](/database/mysql/basic/install/8.0)（Windows / macOS / Linux）
- [MySQL 目录结构](/database/mysql/basic/dir-structure)
- [Linux 环境安装 MySQL](/database/mysql/basic/install/linux)
- [Linux 下远程连接 MySQL](/database/mysql/basic/install/linux-remote)
- [Navicat / SQLyog / DBeaver 使用](/database/mysql/basic/install/tools)

### 第二部分：SQL 核心语法（基础查询）

用 SQL 操作数据，是每个开发者必备的技能。

- [SELECT / FROM / WHERE：查询基础](/database/mysql/sql/basic/select-from)
- [WHERE 条件过滤：运算符详解](/database/mysql/sql/basic/where)
- [列的别名与去重：DISTINCT](/database/mysql/sql/basic/column-ops)
- [算术/比较/逻辑运算符](/database/mysql/sql/basic/operator)
- [排序与分页：ORDER BY / LIMIT](/database/mysql/sql/basic/sort-pagination)
- [多表连接：等值/非等值/NATURAL JOIN](/database/mysql/sql/join/equi-non-equi)
- [外连接：LEFT / RIGHT / FULL OUTER JOIN](/database/mysql/sql/join/inner-outer)
- [七种 JOIN 及其 SQL 写法](/database/mysql/sql/join/7join)
- [单行函数：字符/数值/日期/条件函数](/database/mysql/sql/function/single-row)
- [聚合函数与 GROUP BY：数据分析](/database/mysql/sql/function/aggregate)
- [子查询：单行/多行/相关子查询](/database/mysql/sql/subquery)
- [窗口函数与 CTE：MySQL 8.0 新特性](/database/mysql/sql/advanced/window-cte)

### 第三部分：数据库对象管理

用 DDL 管理数据库对象，用 DML 操作数据，用约束保证数据完整性。

- [数据库与表：CREATE / DROP / SHOW](/database/mysql/object/db)
- [MySQL 数据类型：选对类型是第一步](/database/mysql/object/data-type)
- [表管理：ALTER TABLE 的正确姿势](/database/mysql/object/table)
- [命名规范：表名/列名/索引名](/database/mysql/object/naming-rule)
- [INSERT：批量插入与 ON DUPLICATE KEY](/database/mysql/object/dml/insert)
- [UPDATE / DELETE：谨慎操作数据](/database/mysql/object/dml/update-delete)
- [事务控制：COMMIT / ROLLBACK / SAVEPOINT](/database/mysql/object/dml/transaction)
- [约束详解：NOT NULL / UNIQUE / PRIMARY KEY](/database/mysql/object/constraint/basic)
- [外键约束与 CHECK 约束](/database/mysql/object/constraint/foreign-check)
- [视图：虚表的高级用法](/database/mysql/object/view)
- [存储过程：数据库端的业务逻辑](/database/mysql/object/procedure)
- [存储函数：计算逻辑下沉到数据库](/database/mysql/object/function)
- [变量与流程控制：IF / CASE / WHILE](/database/mysql/object/control)
- [游标与错误处理：精细化数据处理](/database/mysql/object/control/cursor-error)
- [触发器：数据的自动守卫](/database/mysql/object/trigger)

### 第四部分：MySQL 高级特性（基础）

深入理解 MySQL 的底层原理。

- [字符集与排序规则：utf8mb4 全攻略](/database/mysql/advanced/charset)
- [sql_mode：MySQL 的严格模式](/database/mysql/advanced/sql-mode)
- [MySQL 逻辑架构：从连接到执行的全流程](/database/mysql/advanced/architecture)
- [存储引擎：InnoDB / MyISAM / Memory](/database/mysql/advanced/engine)
- [用户与权限：最小权限原则](/database/mysql/advanced/user)
- [权限管理：GRANT / REVOKE / 角色](/database/mysql/advanced/permission)

### 第五部分：索引与性能优化

MySQL 性能优化的核心——索引。

- [索引基础：为什么索引能加速查询](/database/mysql/optimize/index/basic)
- [索引类型：聚簇/二级/联合/B+树/Hash 索引](/database/mysql/optimize/index/type)
- [索引操作：创建/删除/降序/隐藏索引](/database/mysql/optimize/index/ops)
- [适合/不适合建索引的场景](/database/mysql/optimize/index/scenario)
- [InnoDB 页结构：数据存储的基本单位](/database/mysql/optimize/innodb/page)
- [行格式：Compact / Dynamic / Compressed](/database/mysql/optimize/innodb/row-format)
- [表空间结构：区/段/碎片区](/database/mysql/optimize/innodb/space)
- [慢查询日志：找到那条拖后腿的 SQL](/database/mysql/optimize/tool/slow-log)
- [EXPLAIN：执行计划的正确解读](/database/mysql/optimize/tool/explain)
- [optimizer trace 与 Sys schema：深入分析](/database/mysql/optimize/tool/trace)
- [索引失效的 11 种情况：最常见的坑](/database/mysql/optimize/sql/index-invalid)
- [JOIN 与子查询优化：驱动表选择](/database/mysql/optimize/sql/join-subquery)
- [分页优化与覆盖索引：告别深度分页](/database/mysql/optimize/sql/pagination-covering)
- [主键设计、范式与反范式](/database/mysql/optimize/sql/design)
- [数据库调优：硬件/参数/大表优化](/database/mysql/optimize/overall-tuning)

### 第六部分：事务、锁与 MVCC

MySQL 保证数据一致性的核心机制。

- [事务 ACID：原子性/一致性/隔离性/持久性](/database/mysql/transaction/basic)
- [隔离级别：脏读/不可重复读/幻读](/database/mysql/transaction/isolation)
- [锁机制：共享锁/排他锁/记录锁/间隙锁/临键锁](/database/mysql/transaction/lock/basic)
- [表锁与元数据锁：ALTER TABLE 锁表的原因](/database/mysql/transaction/lock/table)
- [行锁详解：InnoDB 行锁的完整场景](/database/mysql/transaction/lock/row)
- [乐观锁、悲观锁与死锁：锁策略选择](/database/mysql/transaction/lock/optimistic-pessimistic)
- [锁监控与内存结构：问题排查](/database/mysql/transaction/lock/monitor)
- [MVCC 核心：隐藏字段/UndoLog/ReadView](/database/mysql/transaction/mvcc/basic)
- [MVCC 与隔离级别：ReadView 的创建时机](/database/mysql/transaction/mvcc/isolation)
- [Redo Log 与 Undo Log：持久性与原子性](/database/mysql/transaction/log/redo-undo)
- [Binlog：主从复制与数据恢复](/database/mysql/transaction/log/binlog)

### 第七部分：日志、备份与主从复制

数据安全是企业级应用的底线。

- [主从复制原理：中继日志与复制流程](/database/mysql/replication/basic)
- [一主一从搭建：配置、验证与一致性](/database/mysql/replication/master-slave)
- [mysqldump：逻辑备份与恢复](/database/mysql/replication/backup/logical)
- [xtrabackup：物理备份与增量备份](/database/mysql/replication/backup/physical)

---

## 学习路径

```
第一周：MySQL 基础入门 + SQL 核心语法
第二周：数据库对象管理（DDL/DML/约束）
第三周：MySQL 高级特性（字符集/存储引擎/架构）
第四周：索引与性能优化（核心技能）
第五周：事务、锁与 MVCC（进阶必备）
第六周：主从复制与备份恢复（运维必备）
```

建议按顺序学习，尤其**索引与性能优化**是 MySQL 最核心的技能，需要建立在对 SQL 和存储引擎的充分理解之上。

---

## 下一步

MySQL 是什么？为什么要学它？适合谁来学？

从 [MySQL 教程简介](/database/mysql/basic/overview) 开始。

# 主从复制

> 数据库崩溃了，所有用户数据都没了？不可能——因为有从库。

主从复制是 MySQL 最核心的高可用技术，也是大多数公司数据库架构的起点。

---

## 内容地图

### 主从复制原理

- [主从复制原理：中继日志与复制流程](/database/mysql/replication/basic)
- [一主一从搭建：配置、验证、数据一致性](/database/mysql/replication/master-slave)

### 备份与恢复

- [备份与恢复概述：选型决策树](/database/mysql/replication/backup/index)
- [逻辑备份：mysqldump 与恢复](/database/mysql/replication/backup/logical)
- [物理备份：xtrabackup 与数据迁移](/database/mysql/replication/backup/physical)

---

## 下一步

主从复制的底层原理是什么？中继日志是怎么工作的？

从 [主从复制原理](/database/mysql/replication/basic) 开始。

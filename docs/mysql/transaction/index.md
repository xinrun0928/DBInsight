# 事务、锁与 MVCC

凌晨 2 点，你的电商系统突然出现大量超时——用户无法下单，无法支付。

监控显示 MySQL 连接数飙升，大量线程处于 LOCK WAIT 状态。

这不是查询慢的问题，而是**锁冲突**。

理解 MySQL 的事务、锁和 MVCC 机制，是在生产环境排查并发问题的必备技能。

---

## 内容地图

本模块是 MySQL 最核心的进阶知识——事务保证数据一致性，锁保证并发安全，MVCC 让一切在高性能下运转。

### 事务基础

- [事务 ACID 与使用方式](/database/mysql/transaction/basic)
- [隔离级别与并发问题：脏读/不可重复读/幻读](/database/mysql/transaction/isolation)

### InnoDB 锁机制

- [锁概述：共享锁/排他锁/记录锁/间隙锁/临键锁](/database/mysql/transaction/lock/basic)
- [表锁与元数据锁：ALTER TABLE 锁表的原因](/database/mysql/transaction/lock/table)
- [行锁详解：记录锁/间隙锁/临键锁的完整场景](/database/mysql/transaction/lock/row)
- [乐观锁、悲观锁、死锁：选哪种锁策略](/database/mysql/transaction/lock/optimistic-pessimistic)
- [锁监控与内存结构：如何排查锁问题](/database/mysql/transaction/lock/monitor)

### MVCC 多版本并发控制

- [MVCC 核心：隐藏字段/UndoLog/ReadView](/database/mysql/transaction/mvcc/basic)
- [MVCC 与隔离级别：RC 和 RR 的本质区别](/database/mysql/transaction/mvcc/isolation)

### 日志体系

- [日志概述：Binlog/RedoLog/UndoLog 的角色分工](/database/mysql/transaction/log/index)
- [通用查询日志与错误日志：日常诊断工具](/database/mysql/transaction/log/basic)
- [Redo Log 与 Undo Log：持久性与原子性的保障](/database/mysql/transaction/log/redo-undo)
- [Binlog：主从复制与数据恢复的基石](/database/mysql/transaction/log/binlog)

---

## 学习路径

```
第一天：理解事务 ACID + 隔离级别（与并发问题有什么关系）
第二天：掌握锁机制（表锁/行锁/间隙锁，临键锁如何防幻读）
第三天：深入 MVCC（ReadView 的创建时机，RC vs RR 的区别）
第四天：理解日志体系（Redo/Binlog/Undo 各自的作用，两阶段提交）
```

建议从 [事务基础](/database/mysql/transaction/basic) 入手，理解 ACID 特性，然后学习 [隔离级别](/database/mysql/transaction/isolation)，搞清楚脏读、不可重复读、幻读是怎么发生的。

---

## 下一步

事务是什么？ACID 特性怎么保证？显式事务和隐式事务有什么区别？

从 [事务基础](/database/mysql/transaction/basic) 开始。

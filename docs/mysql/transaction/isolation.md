# 事务隔离级别与并发问题

理解了事务的 ACID 特性之后，接下来要理解的是：隔离级别到底在隔离什么？脏读、不可重复读、幻读是怎么发生的？MySQL 是怎么解决的？

---

## 并发场景下的三个问题

并发事务在同时操作数据时，会产生三类经典问题：

### 问题一：脏读（Dirty Read）

**定义**：一个事务读取了另一个事务**未提交**的数据。

```sql
-- 时间线：
T1: 事务A：UPDATE accounts SET balance = 900 WHERE id = 'A';
T2: 事务B：SELECT balance FROM accounts WHERE id = 'A';  -- 读到 900（脏数据）
T3: 事务A：ROLLBACK;  -- 事务A 回滚，balance 回到 1000
T4: 事务B：用读到的 900 去做后续计算  -- 灾难：基于不存在的数据做决策
```

**发生条件**：隔离级别 < READ COMMITTED

### 问题二：不可重复读（Non-Repeatable Read）

**定义**：同一个事务中，两次读取同一行数据，结果不一样。

```sql
-- 时间线：
T1: 事务B：SELECT balance FROM accounts WHERE id = 'A';  -- 读到 1000
T2: 事务A：UPDATE accounts SET balance = 900 WHERE id = 'A'; 
T3: 事务A：COMMIT;
T4: 事务B：SELECT balance FROM accounts WHERE id = 'A';  -- 读到 900
-- 两次读取结果不一致！
```

**发生条件**：隔离级别 < REPEATABLE READ

### 问题三：幻读（Phantom Read）

**定义**：同一个事务中，两次查询返回的**行数**不一样，像出现了"幻影"。

```sql
-- 时间线：
T1: 事务B：SELECT * FROM orders WHERE status = 'pending';  -- 查到 10 条
T2: 事务A：INSERT INTO orders (...) VALUES (...);  -- 新插入一条 pending 订单
T3: 事务A：COMMIT;
T4: 事务B：SELECT * FROM orders WHERE status = 'pending';  -- 查到 11 条
-- 同一事务中，两次查询结果集不同：幻读！
```

**发生条件**：隔离级别 < SERIALIZABLE

### 三个问题的对比

| 问题 | 读取的是什么 | 区别 |
|-----|------------|-----|
| 脏读 | 别人的**未提交**数据 | 读到不存在的数据 |
| 不可重复读 | 同一行数据的**值**变化 | 数据值变了 |
| 幻读 | 查询结果**行数**变化 | 多了或少了行 |

---

## 四种隔离级别详解

### READ UNCOMMITTED（读未提交）

最低的隔离级别，允许脏读。

```sql
SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
BEGIN;
-- 事务A 正在执行（未提交）
UPDATE orders SET status = 'cancelled' WHERE id = 100;
-- 不提交

-- 事务B：读到了事务A未提交的修改
SELECT status FROM orders WHERE id = 100;
-- 结果：cancelled（脏数据）
```

**适用场景**：几乎不用。唯一可能用到的是：数据精确性要求极低，只关心"大概"的数据趋势。

### READ COMMITTED（读已提交）

解决脏读，但无法解决不可重复读。

```sql
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
-- Oracle / PostgreSQL 的默认隔离级别

-- 事务A：
BEGIN;
UPDATE accounts SET balance = 900 WHERE id = 'A';
-- 不提交

-- 事务B：
SELECT balance FROM accounts WHERE id = 'A';
-- 结果：1000（读不到未提交的数据）✓

COMMIT;  -- 事务A 提交

-- 事务B：
SELECT balance FROM accounts WHERE id = 'A';
-- 结果：900（提交后才能看到）
-- 同一事务中两次读取结果不同：不可重复读 ⚠️
```

**实现原理**：每个语句开始时创建新的 ReadView（快照）。

### REPEATABLE READ（可重复读，MySQL 默认）

解决脏读和不可重复读，但在 MySQL InnoDB 下也能解决幻读。

```sql
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;
-- MySQL InnoDB 的默认隔离级别

-- 事务A：
BEGIN;
UPDATE accounts SET balance = 900 WHERE id = 'A';
COMMIT;

-- 事务B：
BEGIN;
SELECT balance FROM accounts WHERE id = 'A';  -- 1000
UPDATE accounts SET balance = 1100 WHERE id = 'A';  -- 基于 1000 计算
COMMIT;
-- 最终 balance = 1100（基于事务开始时的快照计算）
```

**实现原理**：事务开始时创建 ReadView，整个事务期间复用同一个快照。

### SERIALIZABLE（串行化）

最高的隔离级别，完全串行执行。

```sql
SET SESSION TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- 事务A：
BEGIN;
SELECT * FROM orders WHERE status = 'pending';  -- 加共享锁
-- 其他事务无法修改这些行

-- 事务B：
BEGIN;
UPDATE orders SET status = 'cancelled' WHERE status = 'pending';  
-- 被阻塞！需要等待事务A 释放锁
```

**实现原理**：所有读操作加共享锁（S 锁），写操作加排他锁（X 锁）。读写都串行化。

---

## MySQL InnoDB 如何解决幻读

MySQL InnoDB 在 REPEATABLE READ 隔离级别下，通过 **Next-Key Lock**（临键锁）解决了幻读问题。

### 什么是临键锁

临键锁 = 记录锁 + 间隙锁：

```
表 orders（id 主键，status 索引）：
id: 1(status=paid), 2(status=paid), 3(status=pending), 4(status=pending), 5(status=cancelled)

SELECT * FROM orders WHERE status = 'pending' LOCK IN SHARE MODE;
-- 加锁范围：
--   记录锁：id=3, id=4 (pending 的行)
--   间隙锁：(2, 3), (4, 5) (pending 行之间的间隙)
--   临键锁：[3, (4,5)) 即锁住 id=3 和 (4,5) 之间的间隙
```

### 临键锁如何防止幻读

```sql
-- 事务A：
BEGIN;
SELECT * FROM orders WHERE status = 'pending';
-- 锁住 status='pending' 的行和前后间隙

-- 事务B：
INSERT INTO orders (status) VALUES ('pending');
-- 被阻塞！插入位置被间隙锁锁住

UPDATE orders SET status = 'pending' WHERE id = 6;
-- 也被阻塞！目标位置被锁住
```

### 幻读 vs 不可重复读：MySQL 的特殊处理

| 问题 | MySQL InnoDB 如何解决 |
|-----|---------------------|
| 脏读 | 不可能发生（REPEATABLE READ+） |
| 不可重复读 | 不可能发生（ReadView 快照） |
| 幻读 | 不可能发生（Next-Key Lock） |

> **MySQL InnoDB 在 REPEATABLE READ 下的幻读**：由于 Next-Key Lock 锁住了索引范围，插入和更新都在这个范围内被阻塞，因此幻读不会发生。
>
> **但有例外**：如果查询条件没有走索引，临键锁会锁住整张表，性能会很差。

---

## 隔离级别选择指南

| 隔离级别 | 适用场景 | 性能 |
|---------|--------|-----|
| READ UNCOMMITTED | 数据精确性要求极低（实时监控指标） | 最快 |
| READ COMMITTED | 需要看到最新提交的数据 | 较快 |
| REPEATABLE READ（默认） | 绝大多数 OLTP 场景 | 一般 |
| SERIALIZABLE | 金融/库存等强一致性场景 | 最慢 |

### 生产环境建议

```sql
-- 大多数 OLTP 系统：保持默认 REPEATABLE READ

-- 金融/库存/扣库存：SERIALIZABLE 或应用层乐观锁
-- REPORT/BI 报表：READ COMMITTED（不需要快照一致性）
-- 实时监控/统计：READ UNCOMMITTED（极端性能优先）

-- 查询当前隔离级别
SELECT @@transaction_isolation;
```

---

## 查看当前锁和事务状态

```sql
-- 查看当前锁等待
SELECT * FROM information_schema.INNODB_LOCK_WAITS;

-- 查看当前锁
SELECT * FROM information_schema.INNODB_LOCKS;

-- 查看当前事务
SELECT * FROM information_schema.INNODB_TRX;

-- 查看锁对内存占用
SHOW ENGINE INNODB STATUS;
-- 看 "LOCK TRANSACTION" 和 "WAITING FOR THIS LOCK" 部分
```

---

## 小结

并发问题的发生与隔离级别直接相关：

| 问题 | READ UNCOMMITTED | READ COMMITTED | REPEATABLE READ | SERIALIZABLE |
|-----|-----------------|---------------|----------------|-------------|
| 脏读 | 可能 | 不可能 | 不可能 | 不可能 |
| 不可重复读 | 可能 | 可能 | 不可能（InnoDB） | 不可能 |
| 幻读 | 可能 | 可能 | 不可能（InnoDB） | 不可能 |

MySQL InnoDB 的 REPEATABLE READ 是目前 OLTP 系统的最优选择——在保证数据一致性的同时，性能也足够好。

---

## 下一步

理解了隔离级别之后，接下来看 MySQL 锁机制的详细实现——表锁、行锁、间隙锁、临键锁分别是什么。

从 [锁机制概述](/database/mysql/transaction/lock/basic) 继续。

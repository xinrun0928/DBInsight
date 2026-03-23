# MVCC 与隔离级别

理解了 MVCC 的三个核心组件（隐藏字段、Undo Log、ReadView）之后，这一节用具体例子讲清楚 MVCC 在不同隔离级别下的行为差异。

---

## 不同隔离级别下的 ReadView

| 隔离级别 | ReadView 何时生成 | 同一个事务中多次读是否一致 |
|---------|-----------------|--------------------|
| READ UNCOMMITTED | 不生成 ReadView | ❌ 不一致 |
| READ COMMITTED | **每个语句**开始时生成 | ⚠️ 可能不一致 |
| REPEATABLE READ | **每个事务**开始时生成 | ✅ 一致 |
| SERIALIZABLE | ReadView 退化（加锁） | ✅ 一致 |

---

## READ COMMITTED 下的 MVCC

### 核心特点

READ COMMITTED：**每个 SELECT 语句开始时，都会创建新的 ReadView**。

这意味着同一事务中，第二次 SELECT 可能看到第一次 SELECT 看不到的数据——**不可重复读**。

### 案例演示

```sql
-- 表 orders：id=1, status='pending', TRX_ID=100（事务100 插入）

-- 事务A（READ COMMITTED）：
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
BEGIN;

-- T1：事务A 第一次 SELECT
SELECT * FROM orders WHERE id = 1;
-- ReadView_A1: m_ids=[], min_trx_id=1, max_trx_id=101
-- row.trx_id=100 < min_trx_id → 可见
-- 结果：status='pending'

-- 事务B（并发）：
BEGIN;
UPDATE orders SET status = 'paid' WHERE id = 1;
-- 新版本：TRX_ID=200, ROLL_PTR → Undo Log（旧版本 TRX_ID=100）
COMMIT;

-- T2：事务A 第二次 SELECT
SELECT * FROM orders WHERE id = 1;
-- **创建新 ReadView_A2**
-- ReadView_A2: m_ids=[], min_trx_id=1, max_trx_id=201
-- row.trx_id=200 < max_trx_id → 不在活跃列表 → 可见
-- 结果：status='paid'（⚠️ 与第一次不同！不可重复读）
```

### 为什么 READ COMMITTED 要每次都创建新 ReadView？

READ COMMITTED 的设计哲学是：**"我只关心当前语句开始时，哪些事务已经提交了"**。

每个语句都是独立的"查询时刻"，这是 Oracle 数据库的默认隔离级别。

---

## REPEATABLE READ 下的 MVCC

### 核心特点

REPEATABLE READ：**事务开始时创建 ReadView，整个事务期间复用**。

这就是"可重复读"的核心含义——同一个事务中，无论查多少次，结果都一样。

### 案例演示

```sql
-- 表 orders：id=1, status='pending', TRX_ID=100

-- 事务A（REPEATABLE READ，默认）：
BEGIN;

-- T1：事务A 第一次 SELECT
SELECT * FROM orders WHERE id = 1;
-- ReadView_A: m_ids=[], min_trx_id=1, max_trx_id=101
-- row.trx_id=100 < min_trx_id → 可见
-- 结果：status='pending'
-- **这个 ReadView_A 会被缓存，整事务复用**

-- 事务B（并发）：
BEGIN;
UPDATE orders SET status = 'paid' WHERE id = 1;
COMMIT;

-- T2：事务A 第二次 SELECT
SELECT * FROM orders WHERE id = 1;
-- **复用 ReadView_A！**（不是新建）
-- row.trx_id=200 不在 m_ids，但新版本对 ReadView_A 不可见
-- 沿着版本链走：通过 ROLL_PTR 找到 Undo Log 中的旧版本
-- 旧版本 row.trx_id=100 < min_trx_id → 可见
-- 结果：status='pending'（✅ 与第一次相同！可重复读）
```

### 关键区别

```
READ COMMITTED：
每次 SELECT → 新建 ReadView → 可能看到新数据

REPEATABLE READ：
事务开始 → 创建一个 ReadView → 复用 → 永远只看到事务开始时的快照
```

---

## MVCC 如何解决幻读

幻读 = 同一事务中，两次查询返回的**行数**不同。

在 REPEATABLE READ + MVCC + 临键锁的组合下，幻读不可能发生。

### 案例演示

```sql
-- 表 orders：id=1,3,5（共3行），所有行 status='pending'

-- 事务A（REPEATABLE READ）：
BEGIN;

-- T1：第一次查询
SELECT * FROM orders WHERE status = 'pending';
-- 查到 3 行：id=1,3,5
-- ReadView 创建，临键锁锁住 (1,3), (3,5) 等所有 pending 相关的间隙

-- 事务B：
INSERT INTO orders VALUES (6, 'pending');
-- 尝试获取插入意向锁
-- 但 id=6 在临键锁 (5,+∞) 范围内
-- 被阻塞！无法插入

-- T2：第二次查询
SELECT * FROM orders WHERE status = 'pending';
-- 还是 3 行（id=1,3,5）
-- ✅ 幻读被防止
```

### MVCC vs 临键锁：各司其职

```
幻读防止的两个层次：
├── MVCC：防止"快照读的幻读"
│   └── 基于 ReadView，每次快照读看到的数据版本是确定的
│
└── 临键锁：防止"当前读的幻读"
    └── 锁住记录和间隙，阻止新记录插入
```

---

## MVCC 与当前读

当前读（FOR UPDATE / LOCK IN SHARE MODE / INSERT / UPDATE / DELETE）不走 MVCC，走的是**当前数据版本 + 临键锁**。

### 案例

```sql
-- 事务A（REPEATABLE READ）：
BEGIN;
SELECT * FROM orders WHERE id = 1 LOCK IN SHARE MODE;
-- 当前读：读取最新提交版本 + 临键锁

-- 事务B：
BEGIN;
UPDATE orders SET status = 'paid' WHERE id = 1;
-- 当前读：读取最新版本 + 临键锁
-- 与事务A 的锁冲突，阻塞

COMMIT;  -- 事务A 提交

-- 事务B：继续执行，UPDATE 生效
COMMIT;
```

### 为什么当前读不走 MVCC？

当前读的目的是**修改数据**。如果走 MVCC 读旧版本，修改后可能覆盖别人已提交的数据（脏写）。

```
脏写场景（如果不加锁）：
事务A：SELECT status='pending' → 计算 → 要改成 'cancelled'
事务B：SELECT status='pending' → 计算 → 要改成 'paid'
事务A：UPDATE status='cancelled'
事务B：UPDATE status='paid'  → 覆盖了事务A 的结果！
```

当前读通过**临键锁**确保：修改一行时，别人不能同时修改这一行。

---

## MVCC 与一致性读

MVCC 实现了**一致性读**（Consistent Read）。

> **一致性读**：在某个时间点，数据库呈现给所有事务看到的是同一个一致的状态。

### MySQL 的隔离级别与一致性

```
READ UNCOMMITTED：无需一致性读，直接读最新数据（可能不一致）
READ COMMITTED：语句级一致性读（每个语句是独立的）
REPEATABLE READ：事务级一致性读（整个事务是独立的快照）
SERIALIZABLE：完全串行化，不需要 MVCC
```

### 一致性读的实现

```sql
-- 事务A（REPEATABLE READ）：
SELECT * FROM orders WHERE id = 1;  -- 基于 ReadView 读取快照

-- 事务B 修改了 id=1 并提交

SELECT * FROM orders WHERE id = 1;  -- 仍然读到旧版本
-- 基于同一个 ReadView
-- 体现事务级一致性读
```

---

## MVCC 的性能调优

### 长 ReadView 的代价

ReadView 中的 `m_ids`（活跃事务列表）越大，遍历版本链时判断"是否可见"的开销越大。

```sql
-- 活跃事务越多，ReadView 的 m_ids 越长
-- 导致每次读取都需要遍历 Undo Log 版本链

-- 优化：减少长时间运行的事务
SHOW PROCESSLIST;  -- 查看长时间运行的查询
```

### Undo Log 膨胀

```sql
-- 长事务会导致 Undo Log 无法清理
-- 查看 Undo Log 使用
SHOW ENGINE INNODB STATUS\G
-- 找 "History list length"（越大说明 Undo Log 越多）

-- MySQL 8.0 配置
SHOW VARIABLES LIKE 'innodb_undo%';
-- innodb_undo_tablespaces：独立 Undo 表空间
-- innodb_undo_log_truncate：自动 truncate
```

---

## 小结

MVCC 在不同隔离级别下的行为：

| 隔离级别 | ReadView 生成时机 | 可重复读 | 脏读 | 幻读 |
|---------|-----------------|---------|------|------|
| READ UNCOMMITTED | 不生成 | ❌ | 可能 | 可能 |
| READ COMMITTED | 每个语句 | ❌ | 不可能 | 可能 |
| REPEATABLE READ | 每个事务 | ✅ | 不可能 | 不可能 |
| SERIALIZABLE | 退化（锁） | ✅ | 不可能 | 不可能 |

> **核心理解**：MVCC 是快照读的机制，临键锁是当前读的机制。两者结合，构成了 InnoDB 完整的隔离性保证。

---

## 下一步

MVCC 的核心在于 ReadView，而 ReadView 背后的数据来源是 Undo Log。接下来看 MySQL 的日志体系——Redo Log、Undo Log、Binlog 分别是什么，它们如何协同工作。

从 [日志体系](/database/mysql/transaction/log/index) 继续。

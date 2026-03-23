# MVCC 核心机制

MVCC 是 MySQL InnoDB 在 REPEATABLE READ 隔离级别下实现可重复读的核心技术。理解 MVCC，才能理解为什么 InnoDB 的隔离性这么好——不用锁也能保证一致性。

---

## MVCC 是什么

**MVCC = Multi-Version Concurrency Control（多版本并发控制）**

核心思想：**每个事务看到的数据版本是不同的**。通过保存数据的多个快照版本，让读写操作互不阻塞。

```
不用 MVCC（传统锁）：
事务A：读取数据 → 加锁 → 其他事务阻塞
事务B：写入数据 → 等待锁
        ↓
        性能差（读写互斥）

使用 MVCC：
事务A：读取快照1（时间点T1的数据）
事务B：写入新数据 → 创建快照2
        ↓
        性能好（读写不互斥）
```

---

## MVCC 的三个核心组件

MVCC 由三个组件协同工作：

```
MVCC 三剑客：
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│   隐藏字段        │ + │    Undo Log      │ + │    ReadView      │
│ (行记录中的元数据)  │   │ (版本链的载体)    │   │ (快照可见性判断)  │
└──────────────────┘   └──────────────────┘   └──────────────────┘
          │                      │                     │
          └──────────────────────┴─────────────────────┘
                                ↓
                         MVCC 机制
```

---

## 隐藏字段：每行记录都有两个隐藏列

InnoDB 在聚簇索引的每条记录中存储了两个隐藏字段：

```sql
-- 聚簇索引记录结构（简化版）
┌────────────────────────────────────────────────────┐
│ 行记录                                               │
├──────────┬──────────┬──────────────────────────────┤
│ DB_ROW_ID│TRX_ID    │ ROLL_PTR │ col1 | col2 | col3 │
│ (隐藏)   │(隐藏)    │ (隐藏)    │ (用户列)          │
└──────────┴──────────┴──────────┴─────────────────────┘
      ↑           ↑          ↑
   行ID         事务ID      回滚指针
 (6字节)       (6字节)      (7字节)
```

| 隐藏字段 | 大小 | 说明 |
|--------|------|------|
| `DB_ROW_ID` | 6 字节 | 行 ID，无主键时由 InnoDB 生成 |
| `TRX_ID` | 6 字节 | 最近修改这条记录的事务 ID |
| `ROLL_PTR` | 7 字节 | 指向 Undo Log 中旧版本的指针 |

### 隐藏字段的物理存储

```sql
-- InnoDB 使用隐藏列来维护版本链
-- TRX_ID：记录最后一次修改的事务 ID
-- ROLL_PTR：指向 Undo Log 中的旧版本
```

---

## Undo Log：版本链的载体

当一行数据被更新时，InnoDB 会把**旧版本**记录到 Undo Log 中，形成一条**版本链**。

### 版本链的形成

```
初始插入（事务100）：
id=1, name='Tom', TRX_ID=100, ROLL_PTR=null

第一次更新（事务200）：
旧版本存入 Undo Log → ROLL_PTR 指向旧版本
新版本：id=1, name='Amy', TRX_ID=200, ROLL_PTR → Undo Log

版本链：
id=1, name='Amy' ←─┐
       ROLL_PTR →  │ Undo Log
id=1, name='Tom' ──┘
       TRX_ID=100

读取时：根据 ReadView 和 TRX_ID 决定看哪个版本
```

### Undo Log 的类型

| 类型 | 作用 | 存活性 |
|-----|------|-------|
| 插入 Undo Log | 记录 INSERT 操作 | 事务提交后立即删除 |
| 更新 Undo Log | 记录 UPDATE/DELETE 操作 | 事务提交后不立即删除，供其他事务快照读 |

### Undo Log 的purge

```sql
-- 查看 Undo Log 状态
SHOW ENGINE INNODB STATUS\G
-- 看 "History list length"（历史链表长度）

-- PURGE 线程：异步清理不再需要的 Undo Log
-- 清理条件：
-- 1. 没有活跃事务需要读取旧版本
-- 2. 旧版本不在 ReadView 的"可见版本"范围内
```

---

## ReadView：快照可见性判断

ReadView 是 MVCC 最关键的概念。它是一个**快照**，记录了"在这个时间点，哪些事务已经提交，哪些还在进行"。

### ReadView 的构成

```sql
-- ReadView 包含四个关键字段
ReadView {
    creator_trx_id;     // 创建这个 ReadView 的事务 ID
    m_ids;              // 活跃事务 ID 列表（未提交的）
    min_trx_id;         // 活跃事务中的最小 ID
    max_trx_id;         // 创建 ReadView 时的最大事务 ID + 1
}
```

### 可见性判断规则

```sql
-- 判断一行数据（TRX_ID）对当前事务是否可见

IF (row.trx_id == creator_trx_id) THEN
    RETURN visible;  // 自己改的，自己当然能看见
ELSIF (row.trx_id < min_trx_id) THEN
    RETURN visible;  // 事务已提交，能看见
ELSIF (row.trx_id IN m_ids) THEN
    RETURN invisible;  // 事务未提交，看不见
ELSE
    RETURN visible;  // 已提交事务改的，能看见
END IF;
```

### ReadView 的生成时机

| 隔离级别 | ReadView 生成时机 | 结果 |
|---------|-----------------|-----|
| READ UNCOMMITTED | 不生成快照 | 每次都读最新版本（脏读） |
| READ COMMITTED | **每个语句开始时**生成新快照 | 同一事务中多次查询可能不同 |
| REPEATABLE READ | **事务开始时**生成一个快照 | 同一事务中多次查询结果一致 |
| SERIALIZABLE | 快照退化，依赖锁 | 无 MVCC |

---

## MVCC 在 REPEATABLE READ 下的工作流程

### 场景：可重复读

```sql
-- 时间线：
T1: 事务A：BEGIN
T2: 事务A：SELECT * FROM orders WHERE id = 1;  -- ReadView A 创建
T3: 事务B：BEGIN
T4: 事务B：UPDATE orders SET status = 'paid' WHERE id = 1;
T5: 事务B：COMMIT
T6: 事务A：SELECT * FROM orders WHERE id = 1;  -- 同一 ReadView A
T7: 事务A：结果和 T2 一样（可重复读！）
```

### 工作流程

```
事务A 在 T2 时刻的 ReadView：
  m_ids = []（无其他活跃事务）
  min_trx_id = 1
  max_trx_id = 100

事务B 在 T4 时刻修改了 id=1 的记录：
  新版本：TRX_ID=200, ROLL_PTR → Undo Log（旧版本 TRX_ID=100）

事务A 在 T6 时刻读取 id=1：
  row.trx_id = 200
  200 > max_trx_id(100)? 否
  200 在 m_ids 中? 否
  200 >= min_trx_id(1)? 是
  但 200 不在活跃列表中（已提交）
  → 可见！
```

> **等等，REPEATABLE READ 不应该不可重复读吗？**
>
> 仔细看：事务A 在 T2 时刻就创建了 ReadView，整个事务期间复用同一个快照。事务B 在 T5 提交了，但事务A 的 ReadView 是 T2 创建的，看到的还是 T2 时刻的数据快照——这就是"可重复读"！

---

## MVCC 在 READ COMMITTED 下的工作流程

```sql
-- 时间线：
T1: 事务A：BEGIN
T2: 事务A：SELECT * FROM orders WHERE id = 1;  -- ReadView A1 创建
T3: 事务B：BEGIN
T4: 事务B：UPDATE orders SET status = 'paid' WHERE id = 1;
T5: 事务B：COMMIT
T6: 事务A：SELECT * FROM orders WHERE id = 1;  -- **新 ReadView A2**
T7: 事务A：能看到新数据（不可重复读！）
```

**关键区别**：READ COMMITTED 在**每个语句开始时**都创建新的 ReadView，所以 T2 和 T6 看到的可能不同。

---

## 当前读 vs 快照读

这是 MVCC 中最容易被混淆的概念。

### 快照读（Snapshot Read）

普通 SELECT 语句，使用 MVCC 读取历史快照：

```sql
SELECT * FROM orders WHERE id = 1;  -- 快照读
```

快照读可能读到旧版本数据（取决于 ReadView）。

### 当前读（Current Read）

加锁的 SELECT 或 DML 语句，读取最新提交的数据：

```sql
-- 当前读
SELECT * FROM orders WHERE id = 1 LOCK IN SHARE MODE;  -- 加 S 锁
SELECT * FROM orders WHERE id = 1 FOR UPDATE;           -- 加 X 锁
INSERT INTO orders VALUES (...);                          -- 插入
UPDATE orders SET status = 'paid' WHERE id = 1;          -- 更新
DELETE FROM orders WHERE id = 1;                          -- 删除
```

当前读总是读取最新提交的数据版本。

### 为什么要区分

```sql
-- 事务A：
BEGIN;
SELECT * FROM orders WHERE id = 1;  -- 快照读，可能读到旧数据

-- 事务B：
BEGIN;
UPDATE orders SET status = 'paid' WHERE id = 1;
COMMIT;

-- 事务A：
UPDATE orders SET status = 'cancelled' WHERE id = 1;  -- 当前读
-- 此时 UPDATE 读取最新数据（status='paid'），然后更新为 'cancelled'
-- MVCC 不影响写操作，写操作总是基于最新数据
COMMIT;
```

---

## MVCC + 临键锁 = 完整的隔离性

MVCC 解决了**快照读**的一致性问题，临键锁解决了**当前读**的幻读问题。

```
REPEATABLE READ 的完整保护：
├── 快照读（普通 SELECT）
│   └── MVCC 保护：基于 ReadView 读取可见的历史版本
│
└── 当前读（SELECT FOR UPDATE / INSERT / UPDATE / DELETE）
    └── 临键锁保护：锁住记录和间隙，防止幻读
```

这就是为什么 MySQL InnoDB 在 REPEATABLE READ 下可以同时做到：

- 快照读不阻塞快照读（MVCC）
- 快照读不阻塞当前读（MVCC + 锁）
- 当前读不阻塞快照读（MVCC + 锁）
- 不会出现幻读（临键锁）

---

## MVCC 的代价

MVCC 不是免费的午餐：

| 代价 | 说明 |
|-----|------|
| 存储空间 | 每行多个版本，Undo Log 膨胀 |
| 清理成本 | PURGE 线程需要定期清理旧版本 |
| 查询成本 | 每次读需要遍历版本链（虽然不长） |
| 维护成本 | 事务长时，Undo Log 保留时间长 |

### 避免 MVCC 副作用

```sql
-- 避免长事务（长事务会导致 Undo Log 无法清理）
-- 查看长时间运行的事务
SELECT 
    trx_id,
    trx_started,
    TIMESTAMPDIFF(SECOND, trx_started, NOW()) AS running_sec,
    trx_query
FROM information_schema.INNODB_TRX
ORDER BY running_sec DESC;

-- 调优 Undo Log 空间
SHOW VARIABLES LIKE 'innodb_undo%';
-- innodb_undo_tablespaces：Undo 表空间数量
-- innodb_undo_log_truncate：是否自动 truncate Undo Log
```

---

## 小结

MVCC 三大组件：

| 组件 | 作用 |
|-----|------|
| 隐藏字段 | TRX_ID（谁改的）+ ROLL_PTR（改前的指针） |
| Undo Log | 版本链的载体，旧版本存储在这里 |
| ReadView | 判断"谁改的数据我能看见"的快照 |

ReadView 的关键：

- **REPEATABLE READ**：事务开始时创建 ReadView，事务内复用
- **READ COMMITTED**：每个语句开始时创建新 ReadView

MVCC + 临键锁 = InnoDB REPEATABLE READ 的完整隔离机制。

---

## 下一步

MVCC 在不同隔离级别下具体怎么工作的？RC 和 RR 的 ReadView 有什么本质区别？

从 [MVCC 与隔离级别](/database/mysql/transaction/mvcc/isolation) 继续。

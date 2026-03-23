# 锁机制概述

MySQL 的锁机制是隔离性的底层实现。这一节从最基础的概念出发，把 InnoDB 的锁体系梳理清楚。

---

## 锁的分类体系

MySQL（InnoDB）的锁可以从多个维度分类：

```
锁
├── 按数据结构
│   ├── B+ 树索引锁（Record Lock, Gap Lock, Next-Key Lock）
│   └── 意向锁（Intention Lock）
├── 按粒度
│   ├── 表锁
│   └── 行锁
├── 按性质
│   ├── 共享锁（S Lock）
│   └── 排他锁（X Lock）
└── 按算法
    ├── 记录锁（Record Lock）
    ├── 间隙锁（Gap Lock）
    ├── 临键锁（Next-Key Lock）
    └── 插入意向锁（Insert Intention Lock）
```

---

## 共享锁 vs 排他锁

这是锁的最基本分类。

| 锁类型 | 记号 | 兼容情况 | 说明 |
|-------|------|---------|-----|
| 共享锁（Shared） | S | S 与 S 兼容，S 与 X 不兼容 | 读取数据时加 |
| 排他锁（Exclusive） | X | X 与任何锁都不兼容 | 写入数据时加 |

```sql
-- 事务A：加共享锁
BEGIN;
SELECT * FROM orders WHERE id = 100 LOCK IN SHARE MODE;
-- 加 S 锁在 id=100 这条记录上

-- 事务B：尝试加共享锁
SELECT * FROM orders WHERE id = 100 LOCK IN SHARE MODE;
-- ✓ 成功：S 与 S 兼容

-- 事务C：尝试加排他锁
UPDATE orders SET status = 'paid' WHERE id = 100;
-- ✗ 阻塞：X 与 S 不兼容

-- 事务A：提交，释放 S 锁
COMMIT;

-- 事务C：锁获得，继续执行
UPDATE orders SET status = 'paid' WHERE id = 100;
COMMIT;
```

### 锁的兼容矩阵

| | S 锁 | X 锁 |
|---|------|------|
| **S 锁** | ✅ 兼容 | ❌ 不兼容 |
| **X 锁** | ❌ 不兼容 | ❌ 不兼容 |

---

## 记录锁（Record Lock）

记录锁锁住的是**索引记录**，而不是数据行本身。

```sql
-- 假设 id=100 是 orders 表的主键
SELECT * FROM orders WHERE id = 100 LOCK IN SHARE MODE;
-- 锁住的是 id=100 这条主键索引记录
```

**注意**：即使查询条件是 `WHERE name = 'Tom'`，如果 name 有索引，锁的也是 name 索引记录；如果 name 没有索引，锁的就是聚簇索引（主键）记录。

### 记录锁的特点

- **只锁一行**：精确定位到单条记录
- **行锁是索引锁**：锁的是索引记录，不是整行
- **与隔离级别的关系**：任何隔离级别下都可能加记录锁

---

## 间隙锁（Gap Lock）

间隙锁锁住的是**索引记录之间的间隙**，防止其他事务在间隙中插入新记录。

```sql
-- orders 表 id=1,3,5 存在
-- 间隙为：(-∞,1), (1,3), (3,5), (5,+∞)

-- 事务A：
BEGIN;
SELECT * FROM orders WHERE id = 3 LOCK IN SHARE MODE;
-- 锁住：记录 id=3，以及它左边的间隙 (1,3)

-- 事务B：
INSERT INTO orders VALUES (2, ...);  -- ✗ 阻塞！(1,3) 间隙被锁
INSERT INTO orders VALUES (4, ...);  -- ✗ 阻塞！(3,5) 间隙被锁
INSERT INTO orders VALUES (6, ...);  -- ✗ 阻塞！(5,+∞) 间隙被锁
```

### 间隙锁的要点

| 要点 | 说明 |
|-----|------|
| 锁的是间隙，不是记录 | 防止在间隙中插入新记录 |
| 范围是前一个记录到后一个记录 | 从 id=1 到 id=5 之间的间隙 |
| 间隙是开区间 | 不包括端点记录本身 |
| 只在 REPEATABLE READ 下生效 | READ COMMITTED 不加间隙锁 |

### 间隙锁的"神奇"行为

```sql
-- 事务A：
SELECT * FROM orders WHERE id > 5 LOCK IN SHARE MODE;
-- 锁住：(5, +∞) 整个右半边间隙
-- 任何插入 id > 5 的操作都会被阻塞

-- 事务B：
INSERT INTO orders VALUES (100, ...);  -- ✗ 阻塞！(5,+∞) 被锁
```

---

## 临键锁（Next-Key Lock）

**临键锁 = 记录锁 + 间隙锁**，是 InnoDB 在 REPEATABLE READ 下的默认加锁方式。

```sql
-- orders 表：id=1, 3, 5

-- 事务A：
SELECT * FROM orders WHERE id = 3 LOCK IN SHARE MODE;
-- 锁住：
--   记录锁：id=3
--   间隙锁：(1,3) 和 (3,5)
--   临键锁：[1,3) 和 [3,5) —— 两个临键锁

-- 等价于：
--   Next-Key Lock on (-∞,1]    → 锁住前一个记录到当前记录
--   Next-Key Lock on (1,3]     → 锁住间隙(1,3)和记录3
--   Next-Key Lock on (3,5]     → 锁住间隙(3,5)和记录5
```

### 临键锁的边界

临键锁的锁住范围 = **左开右闭区间**。

```
表记录：1, 3, 5

临键锁区间：
(-∞, 1]   → 锁住左无穷到1
(1, 3]    → 锁住1到3之间的间隙，以及3本身
(3, 5]    → 锁住3到5之间的间隙，以及5本身
(5, +∞)   → 锁住5到正无穷
```

### 临键锁解决幻读

正是临键锁的间隙部分，防止了幻读：

```sql
-- 事务A：
BEGIN;
SELECT * FROM orders WHERE status = 'pending';  -- 查到 id=3,4
-- 临键锁：锁住所有 status='pending' 的行和前后间隙
-- 其他事务无法在锁住的间隙中插入新的 pending 记录

-- 事务B：
INSERT INTO orders (status='pending') VALUES (...);
-- 被阻塞！插入位置在间隙中被锁
```

---

## 插入意向锁（Insert Intention Lock）

插入意向锁是一种特殊的间隙锁，由 INSERT 操作在插入数据之前获取。

```sql
-- orders 表：id=1, 5
-- 间隙：(1,5)

-- 事务A：
BEGIN;
INSERT INTO orders VALUES (2, ...);
-- 获取插入意向锁（1,5）区间

-- 事务B：
BEGIN;
INSERT INTO orders VALUES (3, ...);
-- 也获取插入意向锁（1,5）区间
-- ✓ 不会阻塞！因为两个插入意向锁不互斥
-- 它们都在等待获取同一位置的行锁

-- 事务C：
BEGIN;
SELECT * FROM orders WHERE id > 0 LOCK IN SHARE MODE;
-- 获取间隙锁（1,5）—— 与插入意向锁互斥！
-- 事务A 和事务B 的 INSERT 都会被阻塞
```

### 插入意向锁的要点

| 要点 | 说明 |
|-----|------|
| 是一种间隙锁 | 属于 Gap Lock 的子类 |
| 由 INSERT 获取 | 插入数据前自动获取 |
| 多个 INSERT 不互斥 | 多个事务可以同时准备插入（不阻塞） |
| 与间隙锁互斥 | 如果有 SELECT ... LOCK IN SHARE MODE，INSERT 会被阻塞 |

---

## 意向锁（Intention Lock）

InnoDB 支持**行级锁**（锁一行）和**表级锁**（锁整表）。为了在同一张表上同时支持两种锁，引入了**意向锁**。

### 意向锁的作用

```
场景：事务A 在某行加了行锁
      事务B 想对整张表加表锁

问题：事务B 需要检查表上有没有行锁
      但遍历每一行检查行锁的代价很大

解决：事务A 加行锁时，同时在表级别加意向锁
      表示"有人在某行加了锁"
      事务B 检查意向锁即可知道是否有行锁
```

### 意向锁的类型

| 类型 | 记号 | 说明 |
|-----|------|-----|
| 意向共享锁 | IS | 准备在某行加 S 锁 |
| 意向排他锁 | IX | 准备在某行加 X 锁 |

```sql
-- 事务A：
SELECT * FROM orders WHERE id = 100 LOCK IN SHARE MODE;
-- 加 S 行锁 + IS 表锁

-- 事务B：
LOCK TABLE orders WRITE;  -- 尝试加表级 X 锁
-- 检查到 IS 锁 → 阻塞！表上有行锁的意向
```

### 意向锁兼容矩阵

| | IS | IX | S | X |
|---|----|----|---|---|
| **IS** | ✅ | ✅ | ✅ | ❌ |
| **IX** | ✅ | ✅ | ❌ | ❌ |
| **S** | ✅ | ❌ | ✅ | ❌ |
| **X** | ❌ | ❌ | ❌ | ❌ |

---

## 自增锁（Auto-Inc Lock）

自增锁是表级锁，用于 AUTO_INCREMENT 字段的并发安全。

```sql
CREATE TABLE t (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ...
);

-- 事务A：插入
INSERT INTO t VALUES (NULL, ...);  -- 获取自增锁，分配 id=1

-- 事务B：插入
INSERT INTO t VALUES (NULL, ...);  -- 获取自增锁，分配 id=2
-- 两个事务可以并发执行，自增序列保证连续递增
```

| 配置 | 行为 |
|-----|-----|
| innodb_autoinc_lock_mode = 0 | 传统模式，每次 INSERT 都加自增锁 |
| innodb_autoinc_lock_mode = 1 | 轻量级锁，批量插入时一次性分配（默认） |
| innodb_autoinc_lock_mode = 2 | 交错锁模式，性能最高，但主从复制可能不一致（需要 ROW 模式） |

---

## 查看锁信息

```sql
-- 查看当前锁等待
SELECT 
    r.trx_id,
    r.trx_mysql_thread_id,
    r.trx_query,
    b.trx_id AS blocking_trx_id,
    b.trx_query AS blocking_query,
    b.trx_started AS blocking_started
FROM information_schema.INNODB_LOCK_WAITS w
JOIN information_schema.INNODB_TRX r ON r.trx_id = w.requesting_trx_id
JOIN information_schema.INNODB_TRX b ON b.trx_id = w.blocking_trx_id;

-- 查看所有锁
SELECT * FROM information_schema.INNODB_LOCKS;

-- 查看当前所有事务
SELECT 
    trx_id,
    trx_state,
    trx_started,
    trx_mysql_thread_id,
    trx_query
FROM information_schema.INNODB_TRX;

-- 查看 INNODB 状态（最全面）
SHOW ENGINE INNODB STATUS\G
-- 看 "TRANSACTIONS" 和 "LOCKS" 部分
```

---

## 小结

InnoDB 锁体系的核心：

| 锁类型 | 锁住什么 | 作用 |
|-------|--------|-----|
| 记录锁 | 单条索引记录 | 精确锁定一行 |
| 间隙锁 | 索引记录之间的间隙 | 防止幻读 |
| 临键锁 | 记录 + 前后间隙 | 防止幻读（REPEATABLE READ 默认） |
| 插入意向锁 | 插入位置的间隙 | 多个 INSERT 不互斥 |
| 意向锁 | 表级 | 协调行锁和表锁共存 |
| 自增锁 | 表级 AUTO_INCREMENT | 保证序列安全 |

> 理解这些锁的层次关系，就理解了 InnoDB 并发控制的底层逻辑。

---

## 下一步

InnoDB 的行锁机制不止记录锁、间隙锁、临键锁这几种。表锁和元数据锁（MDL）又是怎么回事？

从 [表锁与元数据锁](/database/mysql/transaction/lock/table) 继续。

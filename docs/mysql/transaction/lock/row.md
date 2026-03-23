# 行锁详解

InnoDB 的行锁是并发控制的精髓。这一节把记录锁、间隙锁、临键锁的场景彻底讲清楚。

---

## 行锁的三种形态

InnoDB 的行锁不是单一的一种锁，而是三种锁的组合：

```
行锁体系：
├── 记录锁（Record Lock）    —— 锁住索引记录本身
├── 间隙锁（Gap Lock）      —— 锁住记录之间的间隙
└── 临键锁（Next-Key Lock）  —— 记录锁 + 间隙锁
```

---

## 记录锁（Record Lock）

记录锁是最简单的行锁，锁住某一条索引记录。

### 什么时候加记录锁

当查询条件能**精确命中一条记录**时，加记录锁。

```sql
-- 表 orders：id=1,2,3,4,5
-- 条件：精确主键值

-- 事务A：
BEGIN;
SELECT * FROM orders WHERE id = 3 LOCK IN SHARE MODE;
-- 只锁 id=3 这一条记录

-- 事务B：
SELECT * FROM orders WHERE id = 3 LOCK IN SHARE MODE;  -- ✓ 不阻塞
UPDATE orders SET status = 'paid' WHERE id = 3;        -- ✓ 不阻塞（同一行）
UPDATE orders WHERE id = 3 FOR UPDATE;                  -- ✓ 不阻塞
UPDATE orders WHERE id = 4;                             -- ✓ 不阻塞（不同行）
```

### 记录锁不锁什么

```sql
-- 事务A：
BEGIN;
SELECT * FROM orders WHERE id = 3 LOCK IN SHARE MODE;
-- 只锁 id=3

-- 事务B：
INSERT INTO orders VALUES (2, ...);  -- ✓ 不阻塞（不在锁范围内）
INSERT INTO orders VALUES (4, ...);  -- ✓ 不阻塞
```

---

## 间隙锁（Gap Lock）

间隙锁锁住的是索引记录之间的间隙，防止其他事务在间隙中插入新记录。

### 什么时候加间隙锁

在 **REPEATABLE READ** 隔离级别下，当查询条件**匹配多条记录**时（范围查询或使用 `<` `>` `BETWEEN`），加间隙锁。

```sql
-- orders 表记录：id=1, 3, 5, 7, 9

-- 事务A：
BEGIN;
SELECT * FROM orders WHERE id > 2 AND id < 6 LOCK IN SHARE MODE;
-- 锁住：
--   间隙 (1,3)
--   间隙 (3,5)
--   间隙 (5,7)

-- 事务B：
INSERT INTO orders VALUES (2, ...);  -- ✗ 阻塞！插入 (1,3) 间隙
INSERT INTO orders VALUES (4, ...);  -- ✗ 阻塞！插入 (3,5) 间隙
INSERT INTO orders VALUES (6, ...);  -- ✗ 阻塞！插入 (5,7) 间隙
INSERT INTO orders VALUES (8, ...);  -- ✓ 不阻塞（8 在锁的右边界之外）
```

### 间隙锁的"边界"

```
表记录：id=1, 3, 5, 7, 9

SELECT * FROM orders WHERE id > 2 AND id < 6 LOCK IN SHARE MODE;
锁住的间隙：
┌───┬─────┬───┬─────┬───┬─────┐
│ 1 │(1,3)│ 3 │(3,5)│ 5 │(5,7)│ 7 ...
└───┴─────┴───┴─────┴───┴─────┘
     ↑锁住  ↑锁住  ↑锁住
```

### 左右边界间隙

```sql
-- 只查下界
SELECT * FROM orders WHERE id > 5 LOCK IN SHARE MODE;
-- 锁住：(5, +∞) —— 所有大于5的间隙

-- 只查上界
SELECT * FROM orders WHERE id < 5 LOCK IN SHARE MODE;
-- 锁住：(-∞, 5) —— 所有小于5的间隙
```

---

## 临键锁（Next-Key Lock）

临键锁 = 记录锁 + 间隙锁，是 InnoDB 在 REPEATABLE READ 下的默认加锁方式。

### 什么时候加临键锁

当查询条件**不能精确定位到一条记录**时（即范围查询），加临键锁。

```sql
-- orders 表记录：id=1, 3, 5, 7, 9

-- 事务A：
BEGIN;
SELECT * FROM orders WHERE id <= 5 LOCK IN SHARE MODE;
-- 临键锁覆盖：
--   (-∞, 1]  → 临键锁：(-∞,1) 间隙 + id=1 记录
--   (1, 3]   → 临键锁：id=3 记录 + (1,3) 间隙
--   (3, 5]   → 临键锁：id=5 记录 + (3,5) 间隙

-- 事务B：
INSERT INTO orders VALUES (2, ...);  -- ✗ 阻塞！(1,3) 间隙被锁
INSERT INTO orders VALUES (4, ...);  -- ✗ 阻塞！(3,5) 间隙被锁
INSERT INTO orders VALUES (6, ...);  -- ✗ 阻塞！(5,7) 间隙被锁
INSERT INTO orders VALUES (8, ...);  -- ✓ 不阻塞（8 在所有锁之外）
```

---

## 唯一索引的加锁行为

这是最需要强调的**特例**：

> **当查询条件使用唯一索引且等值精确匹配时，临键锁退化为记录锁。**

```sql
-- orders 表：id=主键(聚簇), user_id=唯一索引

-- 事务A：
BEGIN;
SELECT * FROM orders WHERE user_id = 'U10086' LOCK IN SHARE MODE;
-- user_id 有唯一索引，等值精确匹配
-- 临键锁退化为：只锁 user_id='U10086' 这一行

-- 事务B：
INSERT INTO orders VALUES (10, 'U10086', ...);  -- ✗ 阻塞！（违反唯一约束）
INSERT INTO orders VALUES (10, 'U10087', ...);  -- ✓ 不阻塞！（不在锁范围内）
```

### 为什么唯一索引会退化？

因为**唯一索引保证了一个值只对应一条记录**。既然只能匹配到一条记录，就不存在"间隙"的概念了——间隙锁退化。

### 非唯一索引的加锁

```sql
-- orders 表：status=非唯一索引

-- 事务A：
BEGIN;
SELECT * FROM orders WHERE status = 'pending' LOCK IN SHARE MODE;
-- status='pending' 的记录有多条
-- 临键锁锁住所有匹配行和它们之间的间隙

-- 如果 pending 记录是 id=3,5,7：
-- 临键锁：(1,3], (3,5], (5,7], (7,9)
-- 锁住整个 (1,9) 范围，所有 pending 记录和间隙
```

---

## 主键查询的加锁

主键查询加锁分两种情况：

### 精确匹配主键

```sql
-- 事务A：
BEGIN;
SELECT * FROM orders WHERE id = 5 LOCK IN SHARE MODE;
-- 只锁 id=5（主键唯一，退化为记录锁）

-- 事务B：
INSERT INTO orders VALUES (5, ...);  -- ✗ 阻塞（主键冲突）
INSERT INTO orders VALUES (6, ...);  -- ✓ 不阻塞
```

### 范围查询主键

```sql
-- 事务A：
BEGIN;
SELECT * FROM orders WHERE id > 5 LOCK IN SHARE MODE;
-- 临键锁：锁住 (5, +∞) 整个范围

-- 事务B：
INSERT INTO orders VALUES (100, ...);  -- ✗ 阻塞
```

---

## 等值查询与临键锁

这里有一个**容易踩坑的细节**：

```sql
-- orders 表：id=1,3,5,7,9

-- 事务A：
BEGIN;
SELECT * FROM orders WHERE id = 3 LOCK IN SHARE MODE;
-- 精确匹配 id=3
-- 临键锁：(1,3] + (3,5]
-- 注意：左右两个间隙都被锁！

-- 事务B：
INSERT INTO orders VALUES (2, ...);  -- ✗ 阻塞！(1,3) 被锁
INSERT INTO orders VALUES (4, ...);  -- ✗ 阻塞！(3,5) 被锁
INSERT INTO orders VALUES (6, ...);  -- ✗ 阻塞！(5,7) 被锁
```

> **关键点**：等值查询（id=3）在 InnoDB 中会同时锁住**左右两个间隙**。这是为了防止幻读——如果只锁左间隙，id=4 可能被插入，幻读依然可能发生。

---

## FOR UPDATE 与 LOCK IN SHARE MODE

```sql
-- 读锁（S 锁）：允许其他事务读，但不允许写
SELECT * FROM orders WHERE id = 5 LOCK IN SHARE MODE;

-- 写锁（X 锁）：排他，其他事务既不能读也不能写
SELECT * FROM orders WHERE id = 5 FOR UPDATE;
```

| 锁模式 | 记号 | 其他读 | 其他写 |
|-------|------|-------|-------|
| LOCK IN SHARE MODE | S | ✅ 允许 | ❌ 阻塞 |
| FOR UPDATE | X | ❌ 阻塞 | ❌ 阻塞 |

### FOR UPDATE 的典型用法：悲观锁

```sql
-- 扣库存场景（防止超卖）
BEGIN;
SELECT stock FROM products WHERE id = 100 FOR UPDATE;
-- 获取 X 锁，其他事务无法修改这条记录

-- 检查库存
SET @stock = 10;  -- 假设查询结果
IF @stock > 0 THEN
    UPDATE products SET stock = stock - 1 WHERE id = 100;
END IF;
COMMIT;
```

---

## 行锁与索引的关系

行锁锁的是**索引记录**，不是数据行本身。

```sql
-- orders 表：id=主键, user_id=非唯一索引, name=无索引

-- 查询用非唯一索引 user_id
SELECT * FROM orders WHERE user_id = 10086 FOR UPDATE;
-- 锁住：user_id=10086 的索引记录 + 前后间隙
-- 记录锁在 user_id 索引树上，不在聚簇索引树上

-- 查询用无索引列 name
SELECT * FROM orders WHERE name = 'Tom' FOR UPDATE;
-- 全表扫描 → 锁住所有行 + 所有间隙 → 锁整表！
```

> **重要教训**：用无索引字段作为查询条件，会导致行锁退化为表锁！所有行都被锁定，其他事务无法写入。

---

## 行锁超时

```sql
-- 查看行锁等待超时
SHOW VARIABLES LIKE 'innodb_lock_wait_timeout';
-- 默认 50 秒

-- 修改超时（单位：秒）
SET GLOBAL innodb_lock_wait_timeout = 5;

-- 超时后的行为
-- ERROR 1205: Lock wait timeout exceeded; try restarting transaction
```

> 死锁时 InnoDB 会主动回滚其中一个事务（代价最小的那个）。但如果不是死锁而是普通锁等待，只能等超时。

---

## 小结

InnoDB 行锁的行为总结：

| 查询条件 | 索引类型 | 锁形态 | 锁范围 |
|---------|---------|--------|--------|
| 等值，主键/唯一索引 | 唯一 | 记录锁 | 只锁一行 |
| 等值，非唯一索引 | 非唯一 | 临键锁 | 记录 + 左右间隙 |
| 范围，主键/唯一索引 | 唯一 | 临键锁 | 范围 + 右间隙 |
| 范围，非唯一索引 | 非唯一 | 临键锁 | 覆盖整个范围 |
| 无索引 | - | 临键锁 | 锁整表（⚠️ 灾难） |

> 记住：**临键锁是默认形态，记录锁是唯一索引的退化，间隙锁是临键锁去掉右记录**。理解了这个退化逻辑，就能理解 InnoDB 行锁的所有行为。

---

## 下一步

乐观锁和悲观锁有什么区别？死锁是怎么产生的？如何避免？

从 [乐观锁、悲观锁与死锁](/database/mysql/transaction/lock/optimistic-pessimistic) 继续。

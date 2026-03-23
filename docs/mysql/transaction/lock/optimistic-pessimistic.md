# 乐观锁、悲观锁与死锁

这一节从编程思想的角度，讲清楚两种锁策略的选择，以及生产环境中最头疼的——死锁问题。

---

## 悲观锁 vs 乐观锁

这是两种截然不同的并发控制思想。

### 悲观锁（Pessimistic Locking）

**核心假设**：冲突必然发生，提前加锁。

```
悲观锁的思维：
"我假定这次更新一定会和别人冲突，所以我一上来就把资源锁住，谁也别想动。"
```

```sql
-- 悲观锁实现：SELECT ... FOR UPDATE
BEGIN;
SELECT stock FROM products WHERE id = 100 FOR UPDATE;
-- 事务持有 X 锁，直到 COMMIT/ROLLBACK 才释放
-- 其他事务想修改 id=100 的任何字段，全部阻塞

UPDATE products SET stock = stock - 1 WHERE id = 100;
COMMIT;
```

**特点**：

| 优点 | 缺点 |
|-----|------|
| 简单直接，不容易出错 | 并发度低，高并发下性能差 |
| 适合写多读少 | 锁时间越长，死锁概率越高 |
| 适合冲突频繁的场景 | 可能导致长事务 |

### 乐观锁（Optimistic Locking）

**核心假设**：冲突是小概率事件，先干再说，冲突了再处理。

```
乐观锁的思维：
"我假定这次更新大概率不会和别人冲突，我先更新了试试。
如果真的冲突了（比如版本号不对），我就回滚重试。"
```

```sql
-- 乐观锁实现：版本号
CREATE TABLE products (
    id BIGINT PRIMARY KEY,
    name VARCHAR(100),
    stock INT NOT NULL DEFAULT 0,
    version INT NOT NULL DEFAULT 0   -- 版本号字段
);

-- 业务代码：
BEGIN;
-- 读取当前版本
SELECT stock, version FROM products WHERE id = 100;
-- 得到：stock=10, version=3

-- 更新时检查版本
UPDATE products 
SET stock = stock - 1, 
    version = version + 1    -- 版本号自增
WHERE id = 100 
  AND version = 3;           -- 检查版本是否变化

-- 检查影响行数
-- 如果影响行数 = 0，说明版本变了（有人改过了），回滚重试
IF ROW_COUNT() = 0 THEN
    ROLLBACK;
    -- 重试逻辑...
ELSE
    COMMIT;
END IF;
```

**另一种实现：基于时间戳**

```sql
UPDATE products 
SET stock = stock - 1, 
    update_time = NOW()
WHERE id = 100 
  AND update_time = '2024-01-15 10:30:00';  -- 时间戳比较
```

**特点**：

| 优点 | 缺点 |
|-----|------|
| 并发度高，无锁等待 | 实现复杂 |
| 适合读多写少 | 冲突多时重试代价大 |
| 适合微服务/分布式 | 可能多次重试，用户体验差 |

### 两种锁的决策树

```
冲突频率如何？
├── 高冲突（库存扣减、账户余额）→ 悲观锁
└── 低冲突（用户信息更新）→ 乐观锁

并发量如何？
├── 高并发 + 低冲突 → 乐观锁
└── 低并发 + 高冲突 → 悲观锁

业务要求如何？
├── 强一致性 → 悲观锁
└── 最终一致性 → 乐观锁
```

---

## 全局锁（FTWRL）

全局锁是最"暴力"的锁——锁整个数据库实例。

### 典型场景：全量备份

```sql
-- 执行全量备份时，需要锁住所有表
FLUSH TABLES WITH READ LOCK;
-- 所有表加全局读锁：所有写操作全部阻塞
-- 然后执行 mysqldump 备份
-- 备份完成后
UNLOCK TABLES;
```

### 全局锁的危害

```
FLUSH TABLES WITH READ LOCK;
          ↓
  所有写操作（INSERT/UPDATE/DELETE）全部阻塞
          ↓
  应用层大量超时
          ↓
  用户无法下单、无法支付
          ↓
  30分钟后备份完成，锁释放
```

### MySQL 8.0 的替代方案

```sql
-- 方式一：使用可重复读快照（备份工具用）
mysqldump --single-transaction -uroot -p db_name
-- 原理：在 REPEATABLE READ 下开启事务，备份快照数据
-- 前提：所有表都是 InnoDB

-- 方式二：使用备份锁（MySQL 8.0）
BACKUP DATABASE db_name TO '/backup/';
-- 备份锁是 MySQL 8.0 引入的，只阻塞 DDL，不阻塞 DML
```

---

## 死锁（Deadlock）

### 什么是死锁

死锁 = 两个或多个事务互相持有对方需要的锁，形成循环等待。

```
死锁图示：
┌──────────┐    持有 X锁(行1)    ┌──────────┐
│  事务A    │ ─────────────────→ │  订单表   │
│          │ ←───────────────── │ (行2被锁) │
└──────────┘    等待 X锁(行2)    └──────────┘
                             
事务A：持有行1，等待行2
事务B：持有行2，等待行1
循环等待，死锁形成
```

### 死锁的典型案例

```sql
-- 事务A：先锁 id=1
BEGIN;
SELECT * FROM orders WHERE id = 1 FOR UPDATE;

-- 事务B：先锁 id=2
BEGIN;
SELECT * FROM orders WHERE id = 2 FOR UPDATE;

-- 事务A：尝试锁 id=2 → 等待
SELECT * FROM orders WHERE id = 2 FOR UPDATE;

-- 事务B：尝试锁 id=1 → 死锁！
SELECT * FROM orders WHERE id = 1 FOR UPDATE;
-- InnoDB 检测到死锁，立即回滚其中一个事务
-- ERROR 1213: Deadlock found when trying to get lock
```

### InnoDB 死锁处理策略

1. **检测**：InnoDB 维护一个 Waits-For 图，实时检测死锁
2. **回滚**：选择**回滚代价最小**的事务回滚（undo log 记录少的那条）
3. **通知**：返回死锁错误给应用层

```sql
SHOW ENGINE INNODB STATUS\G
-- 输出中的 "LATEST DETECTED DEADLOCK" 部分会显示最近一次死锁的详情：
-- 包括：死锁涉及的事务、SQL、等待的锁
```

---

## 避免死锁的策略

死锁无法完全避免，但可以通过设计减少发生概率。

### 策略一：固定顺序获取锁

```sql
-- ❌ 错误：不同事务按不同顺序获取锁
-- 事务A：先锁 id=1 → 再锁 id=2
-- 事务B：先锁 id=2 → 再锁 id=1
-- → 死锁

-- ✅ 正确：所有事务都按同样顺序获取锁
-- 事务A：先锁 id=1 → 再锁 id=2
-- 事务B：先锁 id=1 → 再锁 id=2
-- → 不会死锁（事务B 等事务A 释放 id=1）
```

### 策略二：减小锁粒度

```sql
-- ❌ 错误：用无索引字段查询，锁整表
SELECT * FROM orders WHERE name = 'Tom' FOR UPDATE;  -- 全表锁！

-- ✅ 正确：用主键精确查询，只锁一行
SELECT * FROM orders WHERE id = 100 FOR UPDATE;
```

### 策略三：减小事务大小

```sql
-- ❌ 错误：一个大事务锁住多行
BEGIN;
SELECT * FROM orders WHERE status = 'pending' FOR UPDATE;
-- 可能锁住几万行

-- ✅ 正确：分批处理，每批小事务
DECLARE @id INT;
DECLARE @done INT DEFAULT 0;

WHILE @done = 0 DO
    START TRANSACTION;
    SELECT id INTO @id FROM orders 
    WHERE status = 'pending' LIMIT 1 FOR UPDATE;
    
    IF @id IS NULL THEN
        SET @done = 1;
        COMMIT;
    ELSE
        UPDATE orders SET status = 'processing' WHERE id = @id;
        COMMIT;
    END IF;
END WHILE;
```

### 策略四：设置合理的锁超时

```sql
-- 设置较短的超时，让死锁快速暴露
SET GLOBAL innodb_lock_wait_timeout = 5;  -- 5 秒超时

-- 应用层处理死锁（需要重试）
try {
    // 执行业务
} catch (DeadlockException e) {
    Thread.sleep(100);  // 短暂等待
    retry();            // 重试
}
```

### 策略五：使用低隔离级别

```sql
-- 在允许幻读的场景下，使用 READ COMMITTED
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
-- READ COMMITTED 不加间隙锁，死锁概率大幅降低
-- 但需要接受幻读的可能
```

---

## 死锁监控

```sql
-- 1. 查看最近死锁详情
SHOW ENGINE INNODB STATUS\G
-- 找 "LATEST DETECTED DEADLOCK" 部分

-- 2. 开启死锁信息记录到错误日志
SET GLOBAL innodb_print_all_deadlocks = ON;
-- 死锁信息会写入 error log

-- 3. performance_schema 监控
SELECT * FROM performance_schema.events_statements_history
WHERE thread_id IN (
    SELECT DISTINCT thread_id 
    FROM performance_schema.events_transactions_history
    WHERE state = 'ROLLED BACK'
);
```

---

## 生产环境死锁排查实战

```sql
-- Step 1: 发现死锁
SHOW ENGINE INNODB STATUS\G
-- 看 "TRANSACTIONS" 部分，找到 "ROLLING BACK" 或 "LOCK WAIT" 的事务

-- Step 2: 找到阻塞的 SQL
SELECT 
    trx.trx_id,
    trx.trx_mysql_thread_id,
    trx.trx_query,
    trx.trx_started,
    trx.trx_rows_locked,
    trx.trx_tables_locked
FROM information_schema.INNODB_TRX trx
WHERE trx.trx_state = 'LOCK WAIT';

-- Step 3: 分析锁等待关系
SELECT 
    r.trx_id AS waiting_trx_id,
    r.trx_query AS waiting_query,
    b.trx_id AS blocking_trx_id,
    b.trx_query AS blocking_query,
    b.trx_started AS blocking_started,
    TIMESTAMPDIFF(SECOND, b.trx_started, NOW()) AS blocking_seconds
FROM information_schema.INNODB_LOCK_WAITS w
JOIN information_schema.INNODB_TRX r ON r.trx_id = w.requesting_trx_id
JOIN information_schema.INNODB_TRX b ON b.trx_id = w.blocking_trx_id;
```

---

## 小结

悲观锁 vs 乐观锁的选择：

| 场景 | 推荐策略 |
|-----|---------|
| 高并发、低冲突 | 乐观锁 |
| 低并发、高冲突 | 悲观锁 |
| 库存扣减 | 悲观锁（SELECT FOR UPDATE） |
| 用户资料更新 | 乐观锁（版本号） |
| 批量处理 | 分批小事务 + 悲观锁 |

死锁的避免：

- 按固定顺序获取锁
- 减小锁粒度（用索引）
- 减小事务大小
- 设置合理超时
- 必要时降低隔离级别

> 记住：**死锁不是 bug，是业务逻辑问题**。减少死锁的核心是改进业务逻辑，而不是配置参数。

---

## 下一步

锁的信息怎么监控？InnoDB 的内存结构和锁监控系统是怎样的？

从 [锁监控与内存结构](/database/mysql/transaction/lock/monitor) 继续。

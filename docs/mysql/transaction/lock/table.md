# 表锁与元数据锁

行锁锁数据，**表锁锁结构**。理解表锁和元数据锁（MDL），才能避免"加了字段表就锁死了"这种生产事故。

---

## 表锁（Table Lock）

### MyISAM 的表锁

在 MyISAM 引擎中，表锁是唯一的并发控制方式：

```sql
-- 读锁：所有连接只能读，不能写
LOCK TABLE orders READ;

-- 写锁：只有当前连接能读写，其他连接全部阻塞
LOCK TABLE orders WRITE;

-- 解锁
UNLOCK TABLES;
```

| 锁类型 | 当前连接 | 其他连接 |
|-------|--------|---------|
| READ | 读/写 | 只读 |
| WRITE | 读/写 | 全部阻塞 |

### InnoDB 的表锁

InnoDB 主要使用行锁，但也会使用表锁：

```sql
-- 显式加表锁
LOCK TABLE orders READ, users WRITE;

-- InnoDB 中显式加表锁会影响所有行锁的行为
-- 如果表有显式表锁，行锁只在该表锁范围内生效

UNLOCK TABLES;
```

### ALTER TABLE 与表锁

`ALTER TABLE` 是最常见的表锁场景：

```sql
-- MySQL 5.5 及之前：ALTER TABLE 会锁整表（读写全阻塞）
ALTER TABLE orders ADD COLUMN remark VARCHAR(500);
-- 执行期间，orders 表无法读写！

-- MySQL 5.6+：支持在线 DDL（Online DDL）
ALTER TABLE orders ADD COLUMN remark VARCHAR(500), 
    ALGORITHM=INPLACE, LOCK=NONE;
-- ALGORITHM=INPLACE：原地修改，不重建表
-- LOCK=NONE：允许读写并发
```

### Online DDL 的限制

| 操作 | ALGORITHM=INPLACE | LOCK |
|-----|------------------|-----|
| 添加普通列 | ✅ 支持 | LOCK=NONE |
| 添加有默认值的列 | ✅ 支持 | LOCK=NONE |
| 添加索引 | ✅ 支持 | LOCK=SHARED |
| 修改列类型 | ❌ 不支持 | - |
| 修改字符集 | ❌ 不支持 | - |

> **建议**：生产环境使用 `pt-online-schema-change`（Percona Toolkit）或 `gh-ost`（GitHub）做大事务的表结构变更，它们通过创建新表、增量同步数据的方式，避免锁表。

---

## 元数据锁（MDL）

元数据锁（Metadata Lock，MDL）是 MySQL 5.5.3+ 引入的，用于保护表结构，防止 DDL 和 DML 并发冲突。

### MDL 的作用

```
MDL 锁层次：
事务1：SELECT * FROM orders     → MDL 读锁
事务2：ALTER TABLE orders ...    → 需要 MDL 写锁
                                      ↓
                               阻塞！需要等 MDL 读锁释放
```

### MDL 的锁类型

| 锁类型 | 触发操作 | 兼容 |
|-------|---------|-----|
| MDL 读锁 | SELECT, INSERT, UPDATE, DELETE | 读读兼容 |
| MDL 写锁 | ALTER TABLE, DROP TABLE | 与读锁不兼容 |

### MDL 锁的常见问题

#### 问题一：长查询阻塞 DDL

```sql
-- 事务A：开启但未关闭的长查询
BEGIN;
SELECT * FROM orders;  -- MDL 读锁
-- 业务逻辑处理（很慢）...
-- 此时未提交，MDL 读锁持有中

-- 事务C：DDL 操作（另一个会话）
ALTER TABLE orders ADD COLUMN remark VARCHAR(500);
-- 被 MDL 读锁阻塞！
-- 所有后续的 SELECT/INSERT 都会被这个 DDL 阻塞
```

**解决方案**：

```sql
-- 查看当前 MDL 锁
SELECT 
    OBJECT_TYPE,
    OBJECT_SCHEMA,
    OBJECT_NAME,
    LOCK_TYPE,
    LOCK_DURATION,
    LOCK_STATUS,
    THREAD_ID
FROM performance_schema.metadata_locks
WHERE OBJECT_TYPE = 'TABLE';

-- 杀死阻塞的会话
SHOW PROCESSLIST;
KILL <thread_id>;
```

#### 问题二：DDL 阻塞大量查询

```sql
-- 事务A：开启一个事务，但一直不提交
BEGIN;
SELECT * FROM orders LIMIT 1;
-- MDL 读锁

-- 事务C：ALTER TABLE（阻塞）
ALTER TABLE orders ADD COLUMN remark VARCHAR(500);  -- 需要 MDL 写锁

-- 事务D, E, F...：所有新来的 SELECT 都会被 DDL 阻塞
-- 原因是：DDL 的 MDL 写锁申请排在所有读锁后面
```

**这是最危险的生产事故**：一个慢查询占着 MDL 读锁，后续所有查询和 DDL 全部堆积。

### MDL 锁安全实践

| 实践 | 说明 |
|-----|------|
| 避免长事务 | 事务用完立即提交/回滚 |
| DDL 在低峰期执行 | 减少并发冲突 |
| 用 pt-osc / gh-ost | 避免 MDL 锁直接加在原表 |
| 设置 MDL 超时 | `lock_wait_timeout` 参数 |
| 监控 MDL 锁等待 | performance_schema.metadata_locks |

```sql
-- 设置 MDL 锁等待超时（默认 1 年！）
SET SESSION lock_wait_timeout = 30;  -- 30 秒
-- 生产环境建议设置小一点

-- 查看 MDL 超时配置
SHOW VARIABLES LIKE 'lock_wait_timeout';
```

---

## 锁的查看命令汇总

### information_schema 表

```sql
-- 1. 查看当前锁等待（最常用）
SELECT 
    r.trx_id,
    r.trx_mysql_thread_id,
    r.trx_query,
    b.trx_id AS blocking_trx_id,
    b.trx_mysql_thread_id AS blocking_thread,
    b.trx_query AS blocking_query
FROM information_schema.INNODB_LOCK_WAITS w
JOIN information_schema.INNODB_TRX r ON r.trx_id = w.requesting_trx_id
JOIN information_schema.INNODB_TRX b ON b.trx_id = w.blocking_trx_id;

-- 2. 查看所有锁
SELECT * FROM information_schema.INNODB_LOCKS;

-- 3. 查看所有事务
SELECT 
    trx_id, trx_state, trx_started, 
    TIMESTAMPDIFF(SECOND, trx_started, NOW()) AS running_sec,
    trx_mysql_thread_id, trx_query
FROM information_schema.INNODB_TRX
ORDER BY trx_started;

-- 4. 查看 MDL 锁
SELECT * FROM performance_schema.metadata_locks
WHERE OBJECT_TYPE = 'TABLE';

-- 5. 查看表级锁
SHOW STATUS LIKE 'Table_locks%';
```

### SHOW ENGINE INNODB STATUS

```sql
SHOW ENGINE INNODB STATUS\G

-- 关键部分：
-- TRANSACTIONS：事务和锁等待
-- LOCKS：锁的详细信息
-- FILE I/O：I/O 线程状态
-- LOG：Redo Log 状态
-- BUFFER POOL AND MEMORY：Buffer Pool 状态
-- INDIVIDUAL BUFFER POOL INFO：每个 Buffer Pool 实例
```

---

## 死锁检测

InnoDB 有自动死锁检测机制：

```sql
-- 死锁示例
-- 事务A：锁住 id=1
BEGIN;
SELECT * FROM orders WHERE id = 1 FOR UPDATE;  -- X锁 id=1

-- 事务B：锁住 id=2
BEGIN;
SELECT * FROM orders WHERE id = 2 FOR UPDATE;  -- X锁 id=2

-- 事务A：尝试锁 id=2
SELECT * FROM orders WHERE id = 2 FOR UPDATE;  -- 等待 id=2 释放

-- 事务B：尝试锁 id=1
SELECT * FROM orders WHERE id = 1 FOR UPDATE;  -- 死锁！
-- InnoDB 检测到死锁，选择回滚一个事务（通常是回滚代价小的）
-- ERROR 1213: Deadlock found when trying to get lock
```

### 死锁检测的代价

```sql
SHOW VARIABLES LIKE 'innodb_deadlock_detect';
-- 默认 ON：开启死锁检测

-- 关闭死锁检测（高并发下可能需要，但非常危险！）
SET GLOBAL innodb_deadlock_detect = OFF;
-- 关闭后，死锁不会自动检测，只能通过 innodb_lock_wait_timeout 解决
-- 后果：长时间锁等待，可能导致大量连接堆积
```

---

## 小结

表锁和元数据锁是 MySQL 并发控制的两个关键机制：

| 锁类型 | 锁住什么 | 影响范围 | 常见问题 |
|-------|--------|---------|---------|
| 表锁 | 整张表 | 所有行 | ALTER TABLE 锁表 |
| 元数据锁 | 表结构 | DDL vs DML | 长查询阻塞 DDL |
| 行锁 | 单行/间隙 | 单行 | 长时间锁等待 |
| 意向锁 | 表级标识 | 协调表锁和行锁 | 本身不阻塞 |

> 记住：**MDL 锁是最容易在生产环境制造"雪崩"的凶手**。一个未关闭的长事务、一个慢查询，可能导致整个数据库实例的 DDL 全部阻塞。监控 MDL 锁等待，是 DBA 最重要的日常之一。

---

## 下一步

行锁的详细机制——记录锁、间隙锁、临键锁的完整使用场景是什么？

从 [行锁详解](/database/mysql/transaction/lock/row) 继续。

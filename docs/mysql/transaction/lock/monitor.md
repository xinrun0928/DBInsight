# 锁监控与内存结构

理解锁的监控手段，才能在生产环境出问题时有据可查。这一节介绍 InnoDB 的锁监控视图和内存结构。

---

## 锁信息查看

### 核心视图

MySQL 提供了三个 information_schema 视图来查看锁信息：

```sql
-- 查看锁等待关系（最常用）
SELECT 
    request_engine AS req_engine,
    request_tablespace AS req_tablespace,
    request_index AS req_index,
    request_lock_type AS req_lock_type,
    request_lock_mode AS req_lock_mode,
    request_lock_data AS req_lock_data,
    blocking_engine AS blk_engine,
    blocking_index AS blk_index,
    blocking_lock_type AS blk_lock_type,
    blocking_lock_mode AS blk_lock_mode,
    blocking_lock_data AS blk_lock_data
FROM information_schema.INNODB_LOCK_WAITS;
```

```sql
-- 查看所有锁（了解当前全局锁持有情况）
SELECT 
    lock_id,          -- 锁 ID
    lock_trx_id,      -- 持有锁的事务 ID
    lock_mode,        -- 锁模式：S, X, IS, IX, GAP, AUTO_INC
    lock_type,        -- 锁类型：RECORD（行锁）或 TABLE（表锁）
    lock_table,       -- 被锁的表
    lock_index,       -- 被锁的索引
    lock_space,       -- 表空间 ID
    lock_page,        -- 页号
    lock_rec,         -- 页内记录号
    lock_data         -- 锁住的具体数据（主键值）
FROM information_schema.INNODB_LOCKS;
```

```sql
-- 查看所有事务
SELECT 
    trx_id,           -- 事务 ID
    trx_state,        -- 状态：RUNNING, LOCK WAIT, ROLLING BACK, COMMITTING
    trx_started,       -- 事务开始时间
    trx_requested_lock_id,  -- 正在等待的锁 ID
    trx_wait_started,  -- 开始等待的时间
    trx_weight,        -- 权重（越大越先被回滚）
    trx_mysql_thread_id,    -- MySQL 线程 ID
    trx_query,         -- 正在执行的 SQL
    trx_rows_locked,  -- 锁住的行数
    trx_rows_modified  -- 修改的行数
FROM information_schema.INNODB_TRX;
```

### 常用监控 SQL

#### 1. 查看当前所有锁等待

```sql
SELECT 
    r.trx_id,
    r.trx_mysql_thread_id,
    r.trx_query,
    LEFT(r.trx_state, 20) AS state,
    TIMESTAMPDIFF(SECOND, r.trx_wait_started, NOW()) AS wait_sec,
    b.trx_mysql_thread_id AS blocked_by,
    b.trx_query AS blocked_sql
FROM information_schema.INNODB_TRX r
JOIN information_schema.INNODB_LOCK_WAITS w ON r.trx_id = w.requesting_trx_id
JOIN information_schema.INNODB_TRX b ON b.trx_id = w.blocking_trx_id
ORDER BY wait_sec DESC;
```

#### 2. 查看长时间运行的事务

```sql
SELECT 
    trx_id,
    trx_mysql_thread_id,
    LEFT(trx_query, 80) AS query_preview,
    trx_state,
    trx_rows_locked,
    trx_rows_modified,
    TIMESTAMPDIFF(SECOND, trx_started, NOW()) AS running_sec
FROM information_schema.INNODB_TRX
WHERE trx_state = 'RUNNING'
ORDER BY running_sec DESC;
```

#### 3. 查看锁住的行数最多的前 10 个事务

```sql
SELECT 
    trx_id,
    trx_mysql_thread_id,
    trx_rows_locked,
    trx_rows_modified,
    trx_state,
    TIMESTAMPDIFF(SECOND, trx_started, NOW()) AS running_sec
FROM information_schema.INNODB_TRX
ORDER BY trx_rows_locked DESC
LIMIT 10;
```

---

## InnoDB 内存结构

InnoDB 的内存结构是理解锁监控和性能优化的基础。

```
InnoDB 内存结构：
┌─────────────────────────────────────────────┐
│            Buffer Pool（缓冲池）              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Instance │ │ Instance │ │ Instance │ ... │
│  │    0     │ │    1     │ │    2     │    │
│  └──────────┘ └──────────┘ └──────────┘    │
│  ┌──────────────────────────────────┐       │
│  │  数据页缓存   │  索引页缓存   │  锁对象  │       │
│  └──────────────────────────────────┘       │
├─────────────────────────────────────────────┤
│         Change Buffer（写缓冲/合并缓冲）       │
├─────────────────────────────────────────────┤
│              Log Buffer（日志缓冲）            │
├─────────────────────────────────────────────┤
│            Dictionary Cache（字典缓存）       │
├─────────────────────────────────────────────┤
│         Adaptive Hash Index（自适应Hash）     │
└─────────────────────────────────────────────┘
```

### Buffer Pool

Buffer Pool 是 InnoDB 最核心的内存区域，用于缓存数据页和索引页。

```sql
-- 查看 Buffer Pool 配置
SHOW VARIABLES LIKE 'innodb_buffer_pool%';

-- 查看 Buffer Pool 使用情况
SHOW STATUS LIKE 'Innodb_buffer_pool%';
```

| 关键统计 | 说明 |
|---------|-----|
| Innodb_buffer_pool_pages_total | 总页数 |
| Innodb_buffer_pool_pages_free | 空闲页数 |
| Innodb_buffer_pool_pages_dirty | 脏页数（已修改未刷盘） |
| Innodb_buffer_pool_read_requests | 读请求次数 |
| Innodb_buffer_pool_write_requests | 写请求次数 |
| Innodb_buffer_pool_reads | 物理读次数（需要从磁盘读） |
| Innodb_buffer_pool_hit_ratio | 命中率（越接近 1 越好） |

### Change Buffer

Change Buffer（写缓冲）是 InnoDB 对非唯一索引的写操作优化。

```sql
-- 查看 Change Buffer 状态
SHOW STATUS LIKE 'Innodb_ibuf%';
-- Innodb_ibuf_size：Change Buffer 大小
-- Innodb_ibuf_pending_merges：待合并的记录数
```

### Lock Sys

Lock Sys 是 InnoDB 用于管理锁的内存区域：

```
Lock Sys 内存结构：
┌─────────────────────────────────┐
│     Lock Hash Table（锁哈希表）    │
│  索引键 → 锁对象链表              │
│  快速定位某行记录上有哪些锁         │
├─────────────────────────────────┤
│     锁对象（Lock Object）         │
│  每行记录对应一个锁对象             │
│  记录：锁类型、持有者、等待者        │
├─────────────────────────────────┤
│     事务对象（Transaction Object）│
│  每个活动事务一个对象               │
│  记录：状态、持有锁列表、等待锁     │
└─────────────────────────────────┘
```

### 查看 Lock Sys 内存使用

```sql
-- 查看 innodb 内存分配
SHOW ENGINE INNODB STATUS\G
-- 看 "BUFFER POOL AND MEMORY" 部分
-- 看 "LOCK TRANSACTION" 部分
```

---

## SHOW ENGINE INNODB STATUS 解读

这是最全面的 InnoDB 状态查看命令：

```sql
SHOW ENGINE INNODB STATUS\G
```

输出包含多个部分：

### 1. BACKGROUND THREAD

```yaml
Semaphores:
  Mutex spin waits 0, rounds 1234, OS waits 5
  RW-shared spins 45, OS waits 10
  RW-excl spins 0, OS waits 0
```
自旋锁统计，反映 CPU 争用程度。

### 2. TRANSACTIONS（锁和事务）

```yaml
TRANSACTIONS:
Trx id counter 123456789
Purge done for trx's n:o < 123456780 undo n:o < 0
History list length 15
# 活跃事务列表
LIST OF TRANSACTIONS FOR EACH SESSION:
---TRANSACTION 123456789, not started
MySQL thread id 5, query id 1234 localhost root
TABLE LOCK table "shop"."orders" trx id 123456789 lock mode IX
RECORD LOCKS space id 123 page no 5 n bits 72 index "PRIMARY" of table "shop"."orders"
trx id 123456789 lock_mode X locks rec but not gap
Record lock, heap no 2 PHYSICAL RECORD: n_fields 3; # 锁住的记录详情
```

### 3. FILE I/O

```yaml
FILE I/O:
I/O thread 0 state: waiting for completed aio requests (insert buffer thread)
I/O thread 1 state: waiting for completed aio requests (log thread)
I/O thread 2 state: waiting for completed aio requests (read thread)
I/O thread 3 state: waiting for completed aio requests (write thread)
Pending normal aio reads: [0, 0, 0, 0]
Pending normal aio writes: [0, 0, 0, 0]
Pending flushes (fsync) log: 0
Pending aio writes: [0, 0, 0, 0]
```

### 4. LOG

```yaml
LOG:
---
Log sequence number: 1234567890
Log flushed up to:  1234567890
Pages flushed up to: 1234567800
Last checkpoint at: 1234567800
Pending log writes: 0
Pending chkp writes: 0
```

### 5. BUFFER POOL AND MEMORY

```yaml
BUFFER POOL AND MEMORY
Total large memory allocated 8585216000   # 总内存
Dictionary memory allocated 1234567       # 字典缓存
Buffer pool size 524288                   # Buffer Pool 页数（524288 × 16KB = 8GB）
Free buffers 102400                       # 空闲页
Database pages 409600                     # 已用页
Old database pages 151000                 # Old 区域页
Modified db pages 2048                   # 脏页
Pending reads 0
Pending writes: LRU 0, flush list 0, single page 0
Pages read 1234567, created 1234, written 12345
Buffer pool hit rate 1000 / 1000          # 命中率
```

---

## Performance Schema 锁监控

MySQL 5.7+ 提供更精细的锁监控：

```sql
-- 开启锁监控
UPDATE performance_schema.setup_instruments
SET enabled = 'YES', timed = 'YES'
WHERE name LIKE 'lock/%';

UPDATE performance_schema.setup_consumers
SET enabled = 'YES'
WHERE name LIKE 'events_lock%';

-- 查看所有锁事件
SELECT 
    OBJECT_SCHEMA,
    OBJECT_NAME,
    LOCK_TYPE,
    LOCK_MODE,
    LOCK_STATUS,
    COUNT(*) AS lock_count
FROM performance_schema.metadata_locks
WHERE OBJECT_TYPE = 'TABLE'
GROUP BY 1,2,3,4,5
ORDER BY lock_count DESC;

-- 查看锁等待历史
SELECT * FROM performance_schema.events_waits_history
WHERE OBJECT_NAME = 'orders'
ORDER BY TIMER_START DESC
LIMIT 20;
```

---

## 报警阈值建议

生产环境建议设置以下监控报警：

| 监控项 | 报警阈值 | 处理措施 |
|-------|---------|---------|
| 锁等待超时次数 | > 0 / min | 检查慢查询和长事务 |
| 脏页比例 | > 50% | 调大 Buffer Pool 或加快刷盘 |
| 锁等待时间 > 30s | > 0 | 立即查看并处理 |
| Buffer Pool 命中率 | < 99% | 调大 Buffer Pool |
| 长事务（> 60s） | > 0 | 立即查看并处理 |
| 死锁次数 | > 5 / min | 优化业务锁逻辑 |

---

## 小结

锁监控的核心视图：

| 视图 | 用途 |
|-----|------|
| INNODB_TRX | 查看所有活动事务 |
| INNODB_LOCKS | 查看所有锁 |
| INNODB_LOCK_WAITS | 查看锁等待关系 |
| metadata_locks | 查看 MDL 锁 |
| SHOW ENGINE INNODB STATUS | 综合状态（最全面） |

InnoDB 内存结构的核心：

| 组件 | 作用 |
|-----|------|
| Buffer Pool | 缓存数据页和索引页 |
| Change Buffer | 优化非唯一索引的写操作 |
| Log Buffer | Redo Log 缓冲区 |
| Lock Hash Table | 锁对象的快速查找 |

> 记住：**监控是预防，定位是诊断**。在生产环境出问题之前，先把监控建立好。

---

## 下一步

MVCC 是 InnoDB 在 REPEATABLE READ 下实现可重复读的核心机制。它是怎么工作的？ReadView、Undo Log、隐藏字段分别扮演什么角色？

从 [MVCC 核心机制](/database/mysql/transaction/mvcc/basic) 继续。

# trace 与 Sys schema

EXPLAIN 告诉你 MySQL 做了什么，但不会告诉你**为什么**这样做。MySQL 8.0 的 optimizer trace 和 Sys schema，能让你看到优化器的"思考过程"。

---

## optimizer trace：看懂优化器的决策

### 开启 trace

```sql
-- 开启（会话级）
SET optimizer_trace = 'enabled=on';

-- 设置最大追踪大小（默认 1MB，需要够大）
SET optimizer_trace_max_mem_size = 1048576;
```

### 使用 trace

```sql
-- 执行要分析的查询
SELECT * FROM orders 
WHERE customer_id = 100 
  AND status = 'paid'
ORDER BY created_at DESC
LIMIT 10;

-- 查看 trace
SELECT * FROM information_schema.OPTIMIZER_TRACE\G
```

### trace 输出解读

trace 输出包含四个部分：

```json
{
  "join_preparation": { ... },      // 1. 语句准备阶段
  "join_optimization": {            // 2. 优化阶段（最重要）
    "rows_estimation": [ ... ],     //    扫描行数估算
    "considered_execution_plans": [ //    候选执行计划
      {
        "plan_prefix": [],
        "table": "`orders`",
        "best_access_path": {
          "considered_access_paths": [
            { "access_type": "ref", "rows": 150, ... },
            { "access_type": "range", "rows": 500, ... }
          ]
        },
        "chosen_access_path": {
          "access_type": "ref",
          "index": "idx_customer_status",
          "rows": 150
        }
      }
    ]
  },
  "join_execution": { ... }        // 3. 执行阶段
}
```

### 重点看什么

#### 1. considered_execution_plans：候选计划对比

```json
"considered_execution_plans": [
  {
    "plan_prefix": [],
    "table": "`orders`",
    "best_access_path": {
      "considered_access_paths": [
        // 使用 idx_customer_status 索引：扫描 150 行
        { "access_type": "ref", "rows": 150, "chosen": true },
        // 使用主键索引：需要回表，扫描 150000 行
        { "access_type": "ref", "rows": 150000, "chosen": false }
      ]
    }
  }
]
```

优化器比较了多个访问路径，选择了扫描行数最少（150行 vs 150000行）的那个。

#### 2. rows_estimation：行数估算

如果 rows 估算值与实际值差距很大，说明统计信息过期了：

```sql
-- 更新统计信息
ANALYZE TABLE orders;
```

#### 3. 为什么会选错索引？

如果 `rows_estimation` 不准确（统计信息过时），或者优化器估算错误，就会选错索引。

查看 trace 可以帮你判断：

```
"access_type": "range",
"rows": 5   ← 优化器认为只会扫描 5 行
           ← 实际扫描了 50000 行 → 说明统计信息严重过时
```

### 关闭 trace

```sql
SET optimizer_trace = 'enabled=off';
```

---

## EXPLAIN FORMAT=JSON

MySQL 5.7+ 支持 JSON 格式的 EXPLAIN，比表格更详细：

```sql
EXPLAIN FORMAT=JSON
SELECT * FROM orders o
JOIN users u ON o.user_id = u.id
WHERE o.status = 'paid';
```

JSON 输出包含：
- 完整的成本估算（read_cost, eval_cost, prefix_cost）
- 每个操作的详细成本分析
- 嵌套循环的深度信息

---

## Sys schema：性能诊断的瑞士军刀

MySQL 8.0 自带 Sys schema，提供大量性能诊断视图。

### 安装 Sys schema

```sql
-- MySQL 8.0 默认已安装
-- 如果没装：
-- SOURCE /usr/share/mysql/sysschema/sys_schema.sql
```

### 常用诊断视图

#### 1. 找出最慢的 SQL（按总耗时排序）

```sql
SELECT 
    DIGEST_TEXT AS query,
    DIGEST AS digest_hash,
    COUNT_STAR AS exec_count,
    SUM_TIMER_WAIT / 1000000000000 AS total_sec,
    AVG_TIMER_WAIT / 1000000000000 AS avg_sec,
    MIN_TIMER_WAIT / 1000000000000 AS min_sec,
    MAX_TIMER_WAIT / 1000000000000 AS max_sec,
    SUM_ROWS_EXAMINED AS rows_scanned,
    SUM_ROWS_SENT AS rows_returned
FROM performance_schema.events_statements_summary_by_digest
WHERE DIGEST_TEXT IS NOT NULL
ORDER BY total_sec DESC
LIMIT 10;
```

#### 2. 找出使用临时表的 SQL

```sql
SELECT 
    DIGEST_TEXT AS query,
    COUNT_STAR AS exec_count,
    SUM_CREATED_TMP_TABLES AS tmp_tables,
    SUM_CREATED_TMP_DISK_TABLES AS tmp_disk_tables
FROM performance_schema.events_statements_summary_by_digest
WHERE DIGEST_TEXT IS NOT NULL
  AND SUM_CREATED_TMP_TABLES > 0
ORDER BY SUM_CREATED_TMP_DISK_TABLES DESC;
```

> **关注**：如果 `tmp_disk_tables > 0`，说明查询在磁盘上创建了临时表——这是性能杀手，需要优化（加索引或改写）。

#### 3. 找出执行 filesort 的 SQL

```sql
SELECT 
    DIGEST_TEXT AS query,
    SUM_SORT_MERGE_PASSES AS merge_passes,
    SUM_SORT_RANGE AS range_sorts,
    SUM_SORT_ROWS AS rows_sorted,
    SUM_SORT_SCAN AS table_scans
FROM performance_schema.events_statements_summary_by_digest
WHERE DIGEST_TEXT IS NOT NULL
  AND SUM_SORT_MERGE_PASSES > 0
ORDER BY SUM_SORT_MERGE_PASSES DESC;
```

#### 4. 找出未使用索引的 SQL（耗时查询）

```sql
SELECT 
    QUERY,
    TOTAL LatENCY,
    EXECUTION LatENCY,
    ROWS_EXAMINED,
    ROWS_SENT,
    INDEXES_FULL_SCANS,
    INDEXES_RANGE_SCANS
FROM sys.statements_with_sorting
WHERE QUERY LIKE '%orders%'
ORDER BY TOTAL_LATENCY DESC;
```

#### 5. 找出全表扫描的表

```sql
SELECT 
    OBJECT_SCHEMA AS db,
    OBJECT_NAME AS tbl,
    COUNT_STAR AS full_table_scans,
    SUM_ROWS_EXAMINED AS rows_scanned,
    AVG_ROWS_EXAMINED AS avg_rows_per_scan
FROM performance_schema.table_io_waits_summary_by_table
WHERE OBJECT_SCHEMA NOT IN ('mysql', 'performance_schema', 'information_schema')
  AND COUNT_STAR > 0
ORDER BY SUM_ROWS_EXAMINED DESC
LIMIT 20;
```

#### 6. 查看 Buffer Pool 使用情况

```sql
SELECT 
    POOL_ID,
    POOL_SIZE / 1024 / 1024 AS pool_size_mb,
    FREE_BUFFERS,
    DATABASE_PAGES,
    OLD_DATABASE_PAGES,
    PAGES_DIRTY,
    PAGES_FLUSHED,
    PAGES_CREATED,
    PAGES_READ,
    HIT_RATE,
    Young_making_RATE,
    NOT_YOUNG_RATE
FROM sys.innodb_buffer_stats_by_pool;

-- 查看哪些表占 Buffer Pool 最多
SELECT 
    TABLE_NAME,
    PAGE_NUMBER,
    PAGES,
    PAGES * 16 / 1024 AS size_mb
FROM sys.innodb_buffer_page_lru
ORDER BY PAGES DESC
LIMIT 20;
```

#### 7. 查看锁等待

```sql
SELECT 
    r.trx_id AS waiting_trx_id,
    r.trx_mysql_thread_id AS waiting_thread,
    r.trx_query AS waiting_query,
    b.trx_id AS blocking_trx_id,
    b.trx_mysql_thread_id AS blocking_thread,
    b.trx_query AS blocking_query,
    b.trx_started AS blocking_started,
    b.trx_rows_locked AS blocking_rows_locked
FROM information_schema.INNODB_LOCK_WAITS w
JOIN information_schema.INNODB_TRX b ON b.trx_id = w.blocking_trx_id
JOIN information_schema.INNODB_TRX r ON r.trx_id = w.requesting_trx_id;
```

---

## Sys schema 常用视图速查

| 视图 | 用途 |
|-----|------|
| `sys.statements_with_sorting` | 有排序的 SQL |
| `sys.statements_with_temp_tables` | 使用临时表的 SQL |
| `sys.schema_unused_indexes` | 未使用的索引 |
| `sys.statements_with_full_table_scans` | 全表扫描的 SQL |
| `sys.innodb_buffer_stats_by_table` | 各表占用 Buffer Pool |
| `sys.waits_by_user_by_latency` | 最慢的等待事件 |
| `sys.processlist` | 当前连接进程 |
| `sys.innodb_lock_waits` | 当前锁等待 |
| `sys.user_summary` | 用户连接统计 |

---

## 综合诊断流程

```
发现慢 SQL
    ↓
EXPLAIN 分析执行计划
    ↓
是否全表扫描 / filesort / temporary？
    ↓ 是
optimizer trace 看优化器为什么选这个计划
    ↓
ANALYZE TABLE 更新统计信息
    ↓
Sys schema 查同类 SQL 的历史表现
    ↓
针对性优化（加索引 / 改写法 / 调整参数）
```

---

## 小结

trace 和 Sys schema 提供了 EXPLAIN 无法提供的能力：

| 工具 | 核心价值 |
|-----|---------|
| optimizer trace | 看优化器的决策过程，理解"为什么选了这个计划" |
| EXPLAIN JSON | 获取完整的成本估算数据 |
| Sys schema | 快速定位最慢 SQL、最占资源的查询、未使用的索引 |

> 工具只是手段，目标是找到**真正的瓶颈**。数据驱动，而不是经验驱动。

---

## 下一步

工具学会了，该实战了。索引失效是最常见的性能问题——MySQL 在哪些情况下会放弃索引走全表扫描？

从 [索引失效的 11 种情况](/database/mysql/optimize/sql/index-invalid) 继续。

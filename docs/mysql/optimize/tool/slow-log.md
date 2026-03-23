# 慢查询日志与 SHOW PROFILE

优化之前，先找到问题在哪里。MySQL 提供了两件利器：慢查询日志和 SHOW PROFILE。

---

## 慢查询日志：找到那条拖后腿的 SQL

慢查询日志（Slow Query Log）记录执行时间超过阈值的 SQL——这是发现性能问题的第一步。

### 配置参数

| 参数 | 说明 | 默认值 |
|-----|------|-------|
| slow_query_log | 是否开启慢查询日志 | OFF |
| slow_query_log_file | 日志文件路径 | `主机名-slow.log` |
| long_query_time | 慢查询阈值（秒） | 10.000 |
| log_queries_not_using_indexes | 记录未使用索引的查询 | OFF |
| log_throttle_queries_not_using_indexes | 未使用索引日志的限流 | 0（不限） |
| min_examined_row_limit | 只记录扫描行数大于此值的查询 | 0 |

### 开启慢查询日志

```sql
-- 方法一：临时开启（重启后失效）
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;      -- 1 秒
SET GLOBAL slow_query_log_file = '/var/lib/mysql/slow.log';
SET GLOBAL log_queries_not_using_indexes = 'ON';

-- 方法二：永久配置（my.cnf）
[mysqld]
slow_query_log = 1
slow_query_log_file = /var/lib/mysql/slow.log
long_query_time = 1
log_queries_not_using_indexes = 1
```

> **建议**：生产环境设置 `long_query_time = 0.5`（500ms），并开启 `log_queries_not_using_indexes`。

### 查看日志内容

```bash
# 日志文件路径（查配置）
SHOW VARIABLES LIKE 'slow_query_log_file';

# 查看慢查询数量
SHOW GLOBAL STATUS LIKE 'Slow_queries';

# 查看最近的慢查询（MySQL 8.0+）
SHOW FULL PROCESSLIST;  -- 当前正在执行的慢查询
```

### 日志格式解读

```
# Time: 2024-01-15T03:12:45.123456Z
# User@Host: app_user[app_user] @ 192.168.1.10 [192.168.1.10]
# Query_time: 3.582341  Lock_time: 0.000213  Rows_sent: 152  Rows_examined: 152000
SET timestamp=1705291965;
SELECT o.*, u.name, u.email
FROM orders o
JOIN users u ON o.user_id = u.id
WHERE o.status = 'pending'
  AND o.created_at > '2024-01-01';
```

关键指标：

| 字段 | 含义 |
|-----|------|
| Query_time | 查询总耗时（秒） |
| Lock_time | 等待锁的时间 |
| Rows_sent | 返回行数 |
| Rows_examined | 扫描行数 |

> **重要指标**：如果 `Rows_examined` 远大于 `Rows_sent`，说明走了全表扫描——这是优化重点。

### 慢查询分析工具

```bash
# mysqldumpslow（MySQL 自带）
mysqldumpslow -s t -t 10 /var/lib/mysql/slow.log      # 按耗时 top 10
mysqldumpslow -s c -t 10 /var/lib/mysql/slow.log      # 按出现频率 top 10
mysqldumpslow -s r -t 10 /var/lib/mysql/slow.log      # 按扫描行数 top 10
mysqldumpslow -g 'orders' /var/lib/mysql/slow.log     # 过滤包含 orders 的查询

# pt-query-digest（Percona Toolkit，推荐）
pt-query-digest /var/lib/mysql/slow.log
# 输出：查询汇总 + 每种查询的详细分析
```

---

## SHOW PROFILE：SQL 执行过程分解

`SHOW PROFILE` 能把一条 SQL 的执行过程分解成多个阶段，显示每个阶段的耗时——比慢查询日志更精细。

### 开启 Profile

```sql
-- 查看是否开启
SHOW VARIABLES LIKE 'profiling';

-- 开启（会话级）
SET profiling = 'ON';
```

### 使用 Profile

```sql
-- 执行查询
SELECT o.id, u.name, SUM(o.amount) AS total
FROM orders o
JOIN users u ON o.user_id = u.id
WHERE o.status = 'paid'
GROUP BY o.id, u.name
ORDER BY total DESC
LIMIT 10;

-- 查看查询 ID
SHOW PROFILES;
-- +----------+-------------+---------------------------+
-- | Query_ID | Duration    | Query                    |
-- +----------+-------------+---------------------------+
-- |        1 | 2.34152200  | SELECT ... (上面那条SQL) |
-- +----------+-------------+---------------------------+

-- 查看该查询的详细阶段
SHOW PROFILE FOR QUERY 1;
```

典型输出：

```
+----------------------+----------+
| Status               | Duration |
+----------------------+----------+
| starting             | 0.000089 |
| checking permissions | 0.000005 |
| Opening tables       | 0.000012 |
| System lock          | 0.000004 |
| init                 | 0.000022 |
| optimizing           | 0.000015 |
| statistics           | 0.000031 |
| preparing            | 0.000019 |
| executing            | 0.000003 |
| Sorting result       | 2.340982 |  ← ⚠️ 主要耗时在这里！
| sending data         | 0.000201 |
| end                  | 0.000008 |
| query end            | 0.000004 |
| closing tables       | 0.000003 |
| freeing items        | 0.000015 |
| cleaning up          | 0.000006 |
+----------------------+----------+
```

### Profile 阶段解读

| 阶段 | 含义 | 优化方向 |
|-----|------|--------|
| Opening tables | 打开表缓存 | 增大 table_open_cache |
| System lock | 等待表/行锁 | 检查锁争用 |
| optimizing | 查询优化器工作 | 看 EXPLAIN |
| statistics | 分析索引统计 | ANALYZE TABLE |
| preparing | 准备执行 | 正常阶段 |
| executing | 执行查询 | 关注 Sending data |
| **Sorting result** | **文件排序** | **加索引或优化 ORDER BY** |
| Sending data | 返回数据 | 加索引或减少扫描行数 |

### 常见问题定位

```sql
-- 查看所有阶段的 CPU 和 I/O 消耗
SHOW PROFILE CPU, BLOCK IO FOR QUERY 1;

-- 查看指定查询
SHOW PROFILE MEMORY FOR QUERY 1;

-- 查看可能导致问题的阶段
SHOW PROFILE ALL FOR QUERY 1;
```

---

## Performance Schema：更强大的诊断工具

MySQL 5.6+ 的 Performance Schema 提供了比 SHOW PROFILE 更全面的诊断能力。

### 开启监控

```sql
-- 查看可用的 setup 表
SHOW TABLES LIKE 'setup%';

-- 开启所有事件监控
UPDATE performance_schema.setup_instruments
SET enabled = 'YES', timed = 'YES'
WHERE name LIKE 'stage/%';

-- 开启消费者
UPDATE performance_schema.setup_consumers
SET enabled = 'YES'
WHERE name LIKE 'events_stages%';
```

### 查找耗时最长的 SQL

```sql
-- 最近的慢查询（带阶段分析）
SELECT 
    DIGEST_TEXT AS query,
    COUNT_STAR AS exec_count,
    SUM_TIMER_WAIT / 1000000000000 AS total_sec,
    AVG_TIMER_WAIT / 1000000000000 AS avg_sec,
    MIN_TIMER_WAIT / 1000000000000 AS min_sec,
    MAX_TIMER_WAIT / 1000000000000 AS max_sec
FROM performance_schema.events_statements_summary_by_digest
WHERE DIGEST_TEXT IS NOT NULL
ORDER BY total_sec DESC
LIMIT 10;
```

### 查看当前正在执行的慢查询

```sql
SELECT 
    p.ID,
    p.USER,
    p.HOST,
    p.DB,
    ROUND(p.TIME / 1000, 2) AS exec_sec,
    LEFT(p.INFO, 100) AS sql_preview,
    s.TEXT AS statement_info
FROM information_schema.PROCESSLIST p
JOIN performance_schema.events_statements_current s 
    ON p.ID = s.THREAD_ID
WHERE p.COMMAND != 'Sleep'
  AND p.TIME > 5    -- 执行超过 5 秒
ORDER BY p.TIME DESC;
```

---

## 诊断流程：三步定位慢 SQL

```
第一步：开启慢查询日志
        ↓
   找到耗时 > 1s 的 SQL
        ↓
第二步：SHOW PROFILE 分解阶段
        ↓
   定位到具体耗时环节（Sorting? Sending data?）
        ↓
第三步：EXPLAIN 分析执行计划
        ↓
   针对性优化（加索引？改写法？）
```

---

## 小结

慢查询日志 + SHOW PROFILE + Performance Schema 构成了一套完整的性能诊断体系：

| 工具 | 适用场景 | 精度 |
|-----|--------|-----|
| 慢查询日志 | 发现慢 SQL（> long_query_time） | 秒级 |
| SHOW PROFILE | 分析单条 SQL 的阶段耗时 | 毫秒级 |
| Performance Schema | 全局监控、历史分析 | 纳秒级 |

> 记住：优化之前，先测量。不要凭感觉猜，先用慢查询日志找到问题 SQL，再用 EXPLAIN 分析原因。

---

## 下一步

EXPLAIN 的输出中，每个字段分别代表什么？如何从 EXPLAIN 的输出中找到优化方向？

从 [EXPLAIN 全字段剖析](/database/mysql/optimize/tool/explain) 继续。

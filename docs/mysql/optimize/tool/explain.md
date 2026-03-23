# EXPLAIN 全字段剖析

找到慢 SQL 后，下一步是用 EXPLAIN 看它的执行计划——这才是优化的依据。

---

## EXPLAIN 的基础用法

```sql
EXPLAIN SELECT * FROM orders WHERE customer_id = 10086;

-- MySQL 8.0+ 支持 EXPLAIN ANALYZE（带实际运行时间）
EXPLAIN ANALYZE SELECT * FROM orders WHERE customer_id = 10086;
```

EXPLAIN 不会真正执行 SQL（除非用 ANALYZE），它只分析执行计划并返回预估数据。

---

## 输出字段全解析

EXPLAIN 的输出包含 12 个字段：

```
+----+-------------+--------+------------+-------+---------------+---------+---------+
| id | select_type | table  | partitions | type  | possible_keys | key     | key_len |
+----+-------------+--------+------------+-------+---------------+---------+---------+
|  1 | SIMPLE      | orders | NULL       | ref   | idx_customer  | idx_xxx | 8       |
+----+-------------+--------+------------+-------+---------------+---------+---------+

| ref   | rows | filtered | Extra                          |
+-------+------+----------+--------------------------------+
| const | 152  |   100.00 | Using index condition; Using MRR |
+-------+------+----------+--------------------------------+
```

### 字段一：id — 执行顺序

| id 值 | 含义 |
|-----|------|
| id 相同 | 按书写顺序执行 |
| id 不同 | id 大的先执行（子查询场景） |
| id 为 NULL | 结果行 UNION 合并时出现 |

```sql
EXPLAIN SELECT * FROM orders
WHERE user_id = (
    SELECT id FROM users WHERE email = 'test@example.com'
);
-- +----+-------------+--------+...+-------------+
-- | id | select_type | table  |...| possible_keys |
-- +----+-------------+--------+...+-------------+
-- |  1 | PRIMARY     | orders |...| NULL          |
-- |  2 | SUBQUERY    | users  |...| idx_email     |
-- +----+-------------+--------+...+-------------+
```

### 字段二：select_type — 查询类型

| select_type | 含义 |
|------------|------|
| SIMPLE | 简单 SELECT（无 UNION/子查询） |
| PRIMARY | 外层查询 |
| SUBQUERY | 子查询（子查询在 SELECT 中） |
| DERIVED | 派生表（子查询在 FROM 中） |
| UNION | UNION 的右侧查询 |
| UNION RESULT | UNION 结果合并 |
| DEPENDENT SUBQUERY | 依赖外层的子查询 |
| DEPENDENT UNION | 依赖外层的 UNION |

### 字段三：table — 表名

显示这行数据来自哪个表（别名或实际表名）。

### 字段四：partitions — 分区

如果表有分区，显示查询涉及的分区：

```sql
EXPLAIN SELECT * FROM orders PARTITION (p202401);
-- partitions: p202401
```

### 字段五：type — 连接类型（最重要）

type 是判断查询效率的核心字段，从好到差排序：

```
system > const > eq_ref > ref > range > index > ALL
 ↑最优                ↑常见          ↑最差
```

| type 值 | 含义 | 性能 |
|--------|-----|-----|
| **system** | 表只有一行（系统表） | 最好，实际不存在 |
| **const** | 最多匹配一行（主键/唯一索引等值） | 极好 |
| **eq_ref** | 唯一索引扫描，每行只返回一个匹配 | 好 |
| **ref** | 非唯一索引扫描，返回匹配的所有行 | 较好 |
| **ref_or_null** | ref + 额外搜索 NULL 值 | 尚可 |
| **range** | 索引范围扫描（> < BETWEEN IN） | 一般 |
| **index** | 全索引扫描（不需要回表，按索引顺序遍历） | 差 |
| **ALL** | 全表扫描 | 最差 |

#### 典型场景示例

```sql
-- const：主键等值查询
EXPLAIN SELECT * FROM orders WHERE id = 100;
-- type: const

-- eq_ref：JOIN 时用主键/唯一索引
EXPLAIN SELECT * FROM orders o JOIN users u ON o.user_id = u.id;
-- type: eq_ref (对 o 表) / const (对 u 表，主键)

-- ref：非唯一索引等值查询
EXPLAIN SELECT * FROM orders WHERE status = 'paid';
-- type: ref

-- range：范围查询
EXPLAIN SELECT * FROM orders WHERE created_at > '2024-01-01';
-- type: range

-- ALL：全表扫描（⚠️ 需要优化）
EXPLAIN SELECT * FROM orders WHERE name = 'Tom';
-- type: ALL

-- index：全索引扫描（比 ALL 好，因为索引通常比数据小）
EXPLAIN SELECT COUNT(*) FROM orders;
-- type: index
```

> **优化目标**：type 至少要达到 `ref` 级别，如果出现 `ALL`，必须优化。

### 字段六：possible_keys — 可能使用的索引

MySQL 优化器认为可能适用的索引列表（不一定真的用了）。

### 字段七：key — 实际使用的索引

最重要的字段之一。显示优化器最终选择了哪个索引。

- `NULL` = 没有使用索引（⚠️ 可能需要建索引）
- 值 ≠ NULL = 使用了对应索引（但不一定最优）

### 字段八：key_len — 索引使用的字节数

显示使用了索引的多长部分。

```sql
-- 联合索引 idx_orders(cid, status, created_at)
-- (BIGINT=8 + 1变长 + VARCHAR(20)=20*3+2=64 + DATETIME=5) ≈ 77
EXPLAIN SELECT * FROM orders WHERE customer_id = 100 AND status = 'paid';
-- key_len: 9   → 只用了 customer_id (8+1变长)
-- key_len: 74  → 用了两列 customer_id + status
```

key_len 可以帮助你判断**联合索引是否被完整利用**：

| key_len | 说明 |
|--------|-----|
| 等于索引总长度 | 索引完全使用 |
| 小于索引总长度 | 只用了前缀 |
| 很小 | 可能漏掉了某个列 |

### 字段九：ref — 与索引比较的列

显示与索引列比较的值类型：

| ref 值 | 含义 |
|-------|------|
| `const` | 常量等值（如 `WHERE id = 100`） |
| `func` | 函数计算（如 `WHERE id = func(col)`） |
| `db.table.col` | 与某列的值比较 |
| `NULL` | 全索引扫描（index 类型时出现） |

### 字段十：rows — 预估扫描行数

MySQL 优化器预估需要检查的行数。这个数字越小越好。

```sql
EXPLAIN SELECT * FROM orders WHERE status = 'paid';
-- rows: 152000  → 扫描 15 万行才能找到结果（⚠️ 需要优化）
```

> **注意**：rows 是**扫描行数**，不是返回行数。filtered 列会告诉你扫描行数中实际符合条件的比例。

### 字段十一：filtered — 过滤比例

rows 扫描的行中，符合 WHERE 条件的预估百分比：

| filtered 值 | 含义 |
|-----------|-----|
| 100.00 | 所有扫描行都符合条件 |
| 1.00 | 1% 的扫描行符合条件（⚠️ 浪费） |
| 很小 | 索引区分度差，考虑改写查询 |

计算：真正扫描的行数 ≈ rows × filtered / 100

### 字段十二：Extra — 额外信息（最重要）

Extra 包含大量优化提示，常见值：

#### Using filesort — ⚠️ 需要优化

```sql
EXPLAIN SELECT * FROM orders WHERE status = 'paid' ORDER BY created_at;
-- Extra: Using filesort
```

表示 MySQL 在内存或磁盘上做了额外的排序操作（排序不在索引中）。

**优化方案**：

```sql
-- 方案一：建联合索引覆盖 ORDER BY 字段
CREATE INDEX idx_status_created ON orders(status, created_at);

-- 方案二：确保 ORDER BY 字段在复合索引中且顺序正确
-- (status, created_at) 能覆盖，created_at 单独不行
```

#### Using index — 覆盖索引，不需要回表

```sql
EXPLAIN SELECT customer_id, status FROM orders WHERE status = 'paid';
-- Extra: Using index
```

最好的情况——查询的所有字段都在索引中，直接从索引返回，不需要回表。

#### Using index condition — ICP（索引条件下推）

```sql
EXPLAIN SELECT * FROM orders WHERE status = 'paid' AND remark LIKE '%VIP%';
-- Extra: Using index condition
```

MySQL 5.6+ 优化：先把索引条件下推到存储引擎层过滤，减少回表次数。

#### Using MRR — Multi-Range Read 优化

```sql
EXPLAIN SELECT * FROM orders WHERE customer_id IN (100, 200, 300);
-- Extra: Using MRR
```

将随机 I/O 转为顺序 I/O，提升范围查询性能。

#### Using where — 需要在 MySQL 服务层额外过滤

```sql
EXPLAIN SELECT * FROM orders WHERE status = 'paid' AND YEAR(created_at) = 2024;
-- Extra: Using where
```

> YEAR() 函数导致 created_at 上的索引失效，在服务层做了额外过滤。

#### Using temporary — ⚠️ 需要优化

```sql
EXPLAIN SELECT * FROM orders GROUP BY status;
-- Extra: Using temporary; Using filesort
```

需要创建临时表（内存或磁盘），性能差。

#### No matching rows in index constraint

无法找到匹配的记录，查询直接返回空。

#### Impossible WHERE noticed after reading const values

WHERE 条件矛盾，查询直接返回空（如 `WHERE id = 1 AND id = 2`）。

---

## Extra 完整对照表

| Extra 值 | 说明 | 性能影响 |
|---------|------|--------|
| Using index | 覆盖索引，性能好 | ✅ 好 |
| Using index condition | ICP 下推优化 | ✅ 好 |
| Using MRR | 顺序读取优化 | ✅ 好 |
| Using filesort | 额外排序 | ⚠️ 需优化 |
| Using temporary | 使用临时表 | ⚠️ 需优化 |
| Using where | 服务层额外过滤 | ⚠️ 视情况 |
| Using join buffer | JOIN 时使用缓冲 | ⚠️ 大表需优化 |
| Impossible WHERE | 条件矛盾 | ✅ 结果为空 |
| Select tables optimized away | 优化器消除了表 | ✅ 好 |

---

## 实战案例

### 案例一：索引未被使用

```sql
EXPLAIN SELECT * FROM orders WHERE YEAR(created_at) = 2024;
-- type: ALL (全表扫描！)
-- Extra: Using where

-- 原因：函数导致索引失效
-- 优化：用范围查询替代
EXPLAIN SELECT * FROM orders 
WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01';
```

### 案例二：复合索引顺序不对

```sql
-- 索引：(status, created_at)
EXPLAIN SELECT * FROM orders ORDER BY created_at;
-- Extra: Using filesort（⚠️！跳过了第一列）

EXPLAIN SELECT * FROM orders WHERE status = 'paid' ORDER BY created_at;
-- Extra: (空，无 filesort)  ✅
```

### 案例三：回表次数过多

```sql
-- 主键 id，用户名 name 建了索引，查询全字段
EXPLAIN SELECT id, name FROM users WHERE name = 'Tom';
-- Extra: Using index（覆盖索引，不需要回表）✅

EXPLAIN SELECT * FROM users WHERE name = 'Tom';
-- Extra: Using index condition（需要回表）⚠️
```

---

## 小结

EXPLAIN 是 MySQL 优化的核心工具，记住这张优先级表：

| 字段 | 优化优先级 | 判断标准 |
|-----|----------|---------|
| type | ⭐⭐⭐ | 至少 ref/range，不要 ALL |
| key | ⭐⭐⭐ | 不为 NULL，否则可能缺索引 |
| rows | ⭐⭐ | 越小越好 |
| Extra | ⭐⭐⭐ | 警惕 filesort/temporary/Using where |

> 优化口诀：**type 不要 ALL，Extra 不要 sort。key 不为空是基本要求，rows 越小越开心。**

---

## 下一步

EXPLAIN 的预估数据不够精确？MySQL 8.0 的 trace 和 Sys schema 提供了更精细的诊断能力。

从 [trace 与 Sys schema](/database/mysql/optimize/tool/trace) 继续。

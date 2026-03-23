# 分页优化与覆盖索引

假设你要实现一个订单列表页面，第 100 页、每页 20 条记录。大多数人会这么写：

```sql
SELECT * FROM orders 
WHERE status = 'paid' 
ORDER BY created_at DESC 
LIMIT 1920, 20;
```

这条 SQL 看起来很正常，但它会扫描多少行？答案是 **至少 1940 行**——因为 MySQL 必须先定位到第 1920 条记录，然后取 20 条。

这就是深度分页问题的本质。

---

## 深度分页问题

### 问题演示

```sql
-- 第 1 页：快如闪电
SELECT * FROM orders ORDER BY id LIMIT 0, 20;
-- 扫描：20 行

-- 第 10000 页：慢如蜗牛
SELECT * FROM orders ORDER BY id LIMIT 1920000, 20;
-- 扫描：至少 1920020 行
-- LIMIT offset 越大，扫描行数越多
```

为什么会这样？

```
MySQL LIMIT 执行逻辑：
1. 从第一行开始扫描
2. 数到第 1920020 行
3. 取最后 20 行
4. 前 1920000 行全部白扫
```

> **规律**：`LIMIT offset, n` 的扫描行数 = `offset + n`。当 offset 很大时，前面大量的扫描都是浪费。

### 问题定位

```sql
EXPLAIN SELECT * FROM orders ORDER BY id LIMIT 1920000, 20;
-- rows: 1920020 ⚠️ 扫描近 200 万行
```

---

## 方案一：延迟关联（延迟 JOIN）

**核心思想**：先用索引定位到主键 ID，再回表取完整数据。

```sql
-- ❌ 原始写法
SELECT * FROM orders 
WHERE status = 'paid' 
ORDER BY created_at DESC 
LIMIT 1920000, 20;

-- ✅ 延迟关联写法
SELECT o.*, u.name
FROM orders o
JOIN (
    SELECT id FROM orders 
    WHERE status = 'paid' 
    ORDER BY created_at DESC 
    LIMIT 1920000, 20
) AS o_idx ON o.id = o_idx.id
JOIN users u ON o.user_id = u.id;
```

执行过程：

```
子查询：只扫描索引树，取 20 个主键 ID → 扫描 1920020 行（索引，覆盖索引，无需回表）
回表：拿 20 个主键 ID 查完整行 → 回表 20 次
JOIN：与 users 表关联 → 20 行
总成本 ≈ 1920020 + 20 + 20 = 1920040（但子查询的扫描是索引扫描，比回表快很多）
```

> **关键**：子查询中 `SELECT id` 只取主键——主键在 InnoDB 中是聚簇索引，叶子节点直接就是行数据，可以快速定位。

### 延迟关联的变体

```sql
-- 写法二：直接 JOIN
SELECT o.*
FROM orders o
INNER JOIN (
    SELECT id FROM orders 
    WHERE status = 'paid' 
    ORDER BY created_at DESC 
    LIMIT 1920000, 20
) AS o_idx USING(id);
```

---

## 方案二：游标分页（最佳，适合前端场景）

**核心思想**：用上一页最后一条记录的位置作为起点，代替 OFFSET。

```sql
-- 原始：OFFSET 分页
SELECT * FROM orders 
WHERE status = 'paid' 
ORDER BY created_at DESC 
LIMIT 20 OFFSET 10000;

-- ✅ 游标分页：用上一页最后一条的位置
SELECT * FROM orders 
WHERE status = 'paid' 
  AND created_at < '2024-01-15 10:30:00'  -- ← 上页最后一条的时间
  AND id < 12345                            -- ← 联合主键去重
ORDER BY created_at DESC, id DESC 
LIMIT 20;
```

### 游标分页的实现

前端需要保存上一页最后一条记录的信息：

```sql
-- 假设前端需要展示第 N 页，已知上一页最后一条是：
-- created_at = '2024-01-15 10:30:00', id = 12345

-- 获取下一页
SELECT * FROM orders 
WHERE status = 'paid' 
  AND (created_at < '2024-01-15 10:30:00' 
       OR (created_at = '2024-01-15 10:30:00' AND id < 12345))
ORDER BY created_at DESC, id DESC 
LIMIT 20;

-- 配套索引
CREATE INDEX idx_status_created_id ON orders(status, created_at DESC, id DESC);
```

### 游标分页 vs OFFSET 分页

| 维度 | OFFSET 分页 | 游标分页 |
|-----|------------|---------|
| 跳页 | ✅ 支持 | ❌ 不支持 |
| 一致性 | 翻页过程中数据变化会错位 | 取决于游标字段 |
| 性能 | offset 越大越慢 | 恒定 O(log n) |
| 适合场景 | 后台管理（需要跳页） | 前端 Feed 流（只向下翻） |
| 数据变化 | 新增数据会打乱页码 | 新增数据不会影响当前页 |

---

## 方案三：覆盖索引

**核心思想**：让查询的所有字段都在索引中，无需回表。

```sql
-- 原始：需要回表
SELECT * FROM orders WHERE status = 'paid' ORDER BY created_at DESC LIMIT 20;
-- Extra: Using where ⚠️ 需要回表

-- ✅ 覆盖索引：SELECT 的字段全在索引中
CREATE INDEX idx_orders_covering 
    ON orders(status, created_at DESC, id, amount, customer_id);
--                 ↑         ↑       ↑   ↑      ↑
--            WHERE字段   排序字段  主键  SELECT字段

-- 现在这个查询完全走索引，不需要回表
SELECT id, amount, customer_id, created_at 
FROM orders 
WHERE status = 'paid' 
ORDER BY created_at DESC 
LIMIT 20;
-- Extra: Using index ✅ —— 覆盖索引
```

### 覆盖索引的原理

```
覆盖索引查询流程：
1. 从索引树直接获取 SELECT 字段
2. 无需访问主键索引（回表）
3. 节省一次 I/O
```

> **覆盖索引的适用场景**：查询字段少、固定，且集中在少数几张表。字段太多时索引会变大，影响写入性能。

---

## 方案四：搜索条件转主键范围

适合有明确搜索条件的场景：

```sql
-- ❌ 深度分页：扫描 1920000 行
SELECT * FROM orders WHERE status = 'paid' LIMIT 1920000, 20;

-- ✅ 搜索条件转主键范围：先查 ID
SELECT * FROM orders WHERE id >= (
    SELECT id FROM orders WHERE status = 'paid' ORDER BY id LIMIT 1920000, 1
) LIMIT 20;
```

原理：先在子查询中定位到起始主键 ID（走索引），再从该 ID 起取 20 条。

---

## 方案五：记录总数缓存

如果 UI 必须显示"共 N 页"，优化方向是**减少 COUNT 查询**：

```sql
-- ❌ 每次分页都 COUNT（全表扫描）
SELECT COUNT(*) FROM orders WHERE status = 'paid';  -- 扫描全表

-- ✅ 方案：用 Redis 缓存总数
-- 定时更新：
SET @total = SELECT COUNT(*) FROM orders WHERE status = 'paid';
HSET orders:paid page_cache total @total expire 3600

-- 或：只显示"加载更多"，不显示总页数
-- 读到最后一页时返回空数组，前端不再请求
```

---

## ICP：索引条件下推

MySQL 5.6+ 的 **Index Condition Pushdown**（ICP）也是分页优化的好帮手。

### ICP 的作用

```sql
-- 索引：idx_status_created(status, created_at)
SELECT * FROM orders 
WHERE status = 'paid' 
  AND created_at > '2024-01-01'
  AND remark LIKE '%VIP%';
-- Extra: Using index condition ⚠️ —— ICP 生效
```

**没有 ICP 时**：

```
1. 存储引擎：只通过 status 过滤，找到匹配的行，返回所有列
2. MySQL 服务层：对 remark 字段再做 LIKE 过滤
```

**有 ICP 时**：

```
1. 存储引擎：通过 status 找到候选行，同时用 created_at 和 remark 过滤
2. 只有符合所有条件的行才返回
3. 减少了 MySQL 服务层和存储引擎之间的数据传输
```

> **ICP 能减少回表次数**，对于 `LIMIT n` 的场景，ICP 可以让存储引擎提前过滤，减少无效回表。

---

## 实战：综合优化方案

### 场景：订单列表，每页 20 条，需要支持跳页

**索引设计**：

```sql
-- 主查询索引（覆盖 WHERE + ORDER BY）
CREATE INDEX idx_orders_list 
    ON orders(status, created_at DESC, id);

-- 如果需要 JOIN users，加上覆盖字段
CREATE INDEX idx_orders_list_full 
    ON orders(status, created_at DESC, id, customer_id);
```

**SQL 写法**：

```sql
-- 第一版：普通写法（适合浅分页）
SELECT o.id, o.amount, o.created_at, o.status,
       u.name AS customer_name
FROM orders o
JOIN users u ON o.user_id = u.id
WHERE o.status = 'paid'
ORDER BY o.created_at DESC
LIMIT 20 OFFSET 0;

-- 第二版：深度分页优化（OFFSET > 1000 时切换）
-- 页码 <= 50：直接用 OFFSET
-- 页码 > 50：改用延迟关联
SELECT o.id, o.amount, o.created_at, o.status,
       u.name AS customer_name
FROM (
    SELECT id FROM orders
    WHERE status = 'paid'
    ORDER BY created_at DESC
    LIMIT 20 OFFSET 10000
) AS idx
JOIN orders o ON idx.id = o.id
JOIN users u ON o.user_id = u.id;

-- 第三版：前端改用游标分页（最推荐）
-- 只支持"下一页"，不支持"跳到第 N 页"
SELECT o.id, o.amount, o.created_at, o.status,
       u.name AS customer_name
FROM orders o
JOIN users u ON o.user_id = u.id
WHERE o.status = 'paid'
  AND (o.created_at, o.id) < (:last_created_at, :last_id)
ORDER BY o.created_at DESC, o.id DESC
LIMIT 20;
```

---

## 小结

深度分页优化的五种方案：

| 方案 | 原理 | 适用场景 | 限制 |
|-----|------|--------|-----|
| 延迟关联 | 先索引取 ID，再回表 | 大 OFFSET 分页 | 需要改写 SQL |
| 游标分页 | 用位置替代 OFFSET | 前端 Feed 流 | 不支持跳页 |
| 覆盖索引 | 不回表 | SELECT 字段少的查询 | 索引字段多 |
| 主键范围 | 先定位 ID，再范围取 | 有明确搜索条件 | 需要 ID 连续 |
| COUNT 缓存 | Redis 缓存总数 | 需要显示总页数 | 数据一致性 |

> 记住：**OFFSET 的本质是跳过前面的行**。优化方向不是减少要跳过的行数，而是**用索引定位替代线性扫描**。

---

## 下一步

索引和 SQL 写法都优化了，但表结构本身设计不合理，性能天花板就在那里。主键怎么选？范式和反范式如何权衡？

从 [主键设计、范式与反范式](/database/mysql/optimize/sql/design) 继续。

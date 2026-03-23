# JOIN 与子查询优化

JOIN 和子查询是 SQL 中最常用的操作，但也是性能问题的重灾区。这一节从原理出发，讲清楚怎么写高效的 JOIN 和子查询。

---

## JOIN 的底层原理：嵌套循环连接

MySQL（InnoDB）的 JOIN 使用的是 **Nested Loop Join**（嵌套循环连接）算法。理解它，才能理解所有 JOIN 优化的本质。

### 嵌套循环连接的原理

```sql
-- 两表 JOIN
SELECT * FROM orders o JOIN users u ON o.user_id = u.id
WHERE o.status = 'paid';
```

MySQL 的执行过程（伪代码）：

```
for (orders 中每一条记录) {
    for (users 中每一条记录) {      -- 这里是性能杀手！
        if (orders.user_id == users.id) {
            结果集.add(orders行 + users行);
        }
    }
}
```

**问题**：如果 `orders` 有 10 万行，`users` 有 5 万行，最坏情况要比较 **50 亿次**！

### 驱动表与被驱动表

```
驱动表（小表/有索引的表）  ×  被驱动表（大表/无索引的表）
       ↓                              ↓
  循环 N 次                    每个结果循环 M 次
       ↓                              ↓
  总比较次数 = N × M
```

**优化方向**：让被驱动表有索引，这样在内层循环中可以直接通过索引定位，时间复杂度从 O(M) 降到 O(log M)。

---

## 驱动表的选择

### 原则：小表驱动大表，有索引的表驱动无索引的表

```sql
-- orders (100万行) × users (10万行)
-- users.id 是主键，有索引

-- ❌ 错误理解：orders 在前，所以 orders 是驱动表
SELECT * FROM orders o JOIN users u ON o.user_id = u.id;
-- MySQL 优化器会选择哪边作为驱动表，不完全取决于书写顺序
-- 优化器会尝试小表驱动大表

-- ✅ 正确理解：确保被驱动表的连接字段有索引
-- orders.user_id 已建索引 → users 仍然是驱动表，orders 是被驱动表
-- 或者：users.id（主键）驱动 orders（有索引）
```

### 查看 JOIN 的执行计划

```sql
EXPLAIN SELECT * FROM orders o JOIN users u ON o.user_id = u.id;
-- table: o, type: ALL（⚠️ 全表扫描）
-- table: u, type: const（主键等值）
-- 解读：MySQL 选择 users 作为驱动表，遍历全表 orders
```

### 手动指定驱动表（极端场景）

如果优化器选错了，可以通过 STRAIGHT_JOIN 强制指定：

```sql
SELECT STRAIGHT_JOIN * 
FROM orders o JOIN users u ON o.user_id = u.id;
-- 强制 orders 作为驱动表
```

> **慎用**：大多数情况下优化器是对的。只有在统计信息不准确导致选错时才考虑。

---

## JOIN 的索引设计

### 外键必须建索引

```sql
-- orders 表
CREATE TABLE orders (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,          -- 外键
    status VARCHAR(20),
    amount DECIMAL(10,2),
    INDEX idx_user_id (user_id)        -- 必须建索引！
) ENGINE=InnoDB;

-- users 表
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50)
) ENGINE=InnoDB;
```

### 多表 JOIN 的索引策略

```sql
-- 三表 JOIN：t1 JOIN t2 ON ... JOIN t3 ON ...
-- t1 驱动 t2，t2 驱动 t3
-- t2 被 t1 和 t3 驱动，所以 t2 上连接字段都要有索引
-- t3 被 t2 驱动，所以 t3 上连接字段要有索引

CREATE INDEX idx_t2_a ON t2(a);
CREATE INDEX idx_t2_b ON t2(b);
CREATE INDEX idx_t3_b ON t3(b);
```

---

## 子查询优化

子查询是 SQL 中另一个性能杀手。MySQL 对子查询的优化历史是一部"血泪史"——5.5 时代子查询极慢，5.6 开始优化，8.0 相对成熟。

### 子查询的执行方式

#### 1. 标量子查询（Scalar Subquery）

```sql
SELECT * FROM orders 
WHERE amount = (SELECT MAX(amount) FROM orders);
```

单个值，MySQL 会先执行子查询，结果作为常量，效率高。

#### 2. 表子查询（Table Subquery）

```sql
SELECT * FROM orders 
WHERE user_id IN (SELECT id FROM users WHERE vip_level = 3);
```

**5.5 时代**：MySQL 先执行子查询得到结果集，再对 orders 表逐行比对，效率极差（**相关子查询**）。

**5.6+ 时代**：优化器会自动将 IN 子查询改写为 JOIN：

```sql
-- MySQL 内部可能改写为：
SELECT o.* FROM orders o
JOIN (SELECT id FROM users WHERE vip_level = 3) u ON o.user_id = u.id;
```

**8.0+**：可以显式使用 EXPLAIN 查看改写结果：

```sql
EXPLAIN SELECT * FROM orders 
WHERE user_id IN (SELECT id FROM users WHERE vip_level = 3);
-- 看 Extra 列是否出现 "Using join buffer"
```

#### 3. 相关子查询（Correlated Subquery）

```sql
SELECT * FROM orders o
WHERE amount > (SELECT AVG(amount) FROM orders WHERE user_id = o.user_id);
--                                          ↑ 依赖外层 o 表
```

**必须对每行外层数据执行一次子查询**，效率极差。

**优化方案**：改写为 JOIN + GROUP BY：

```sql
-- 改写为 JOIN
SELECT o.*, avg_tab.avg_amount
FROM orders o
JOIN (
    SELECT user_id, AVG(amount) AS avg_amount 
    FROM orders 
    GROUP BY user_id
) avg_tab ON o.user_id = avg_tab.user_id
WHERE o.amount > avg_tab.avg_amount;
```

---

## EXISTS vs IN

```sql
-- 写法一：IN
SELECT * FROM users WHERE id IN (SELECT user_id FROM orders WHERE status = 'paid');

-- 写法二：EXISTS
SELECT * FROM users u WHERE EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id AND status = 'paid');
```

| 场景 | 推荐 | 原因 |
|-----|------|------|
| 小表驱动大表（IN 子查询结果集小） | IN | 先算子查询，结果集小 |
| 大表驱动小表（外层数据少） | EXISTS | 外层数据少，子查询执行次数少 |
| 子查询列有索引 | 两者都可 | 索引加速 |

**MySQL 优化器会自动处理**，大多数情况下两者性能相近。复杂场景用 EXPLAIN 对比。

---

## ORDER BY 优化

### Using filesort 的原因

```sql
-- orders 表有索引 idx_status_created(status, created_at)
EXPLAIN SELECT * FROM orders 
WHERE status = 'paid' 
ORDER BY created_at DESC;
-- Extra: (空) ✅ —— ORDER BY 在索引中已有序，无需排序

EXPLAIN SELECT * FROM orders 
WHERE status = 'paid' 
ORDER BY amount DESC;
-- Extra: Using filesort ⚠️ —— amount 不在索引中，需要排序
```

### 排序缓冲区

```sql
-- 查看排序相关配置
SHOW VARIABLES LIKE '%sort%';

-- sort_buffer_size：每个连接排序缓冲区大小
-- max_length_for_sort_data：决定排序算法的阈值
```

| sort_buffer_size | 适用场景 |
|-----------------|---------|
| 256KB（默认） | 小结果集排序 |
| 2MB | 中等结果集（几万行） |
| 4MB+ | 大结果集（百万行） |

> **注意**：sort_buffer_size 是每个连接独占的，不要设置过大（256MB），否则内存消耗严重。

### 优化 ORDER BY 的方法

1. **加索引覆盖排序字段**（最佳）
2. **减少排序字段数量**：SELECT 只取需要的列
3. **增大 sort_buffer_size**（适度）
4. **使用索引顺序扫描**：`ORDER BY` 顺序与索引一致

---

## GROUP BY 优化

### GROUP BY 的执行逻辑

```sql
EXPLAIN SELECT status, COUNT(*) FROM orders GROUP BY status;
-- Extra: Using temporary; Using filesort ⚠️
```

MySQL 执行 GROUP BY 有两种方式：

1. **松散索引扫描（Loose Index Scan）**：利用索引的有序性分组，效率高
2. **紧凑索引扫描（Tight Index Scan）**：需要排序后再分组，效率低

### 触发松散索引扫描的条件

```sql
-- GROUP BY 字段在索引中连续，且 SELECT 只涉及分组字段
-- 索引：idx_status_created(status, created_at)
EXPLAIN SELECT status FROM orders GROUP BY status;
-- Extra: Using index for group-by ✅ —— 松散索引扫描

EXPLAIN SELECT status, COUNT(*) FROM orders GROUP BY status;
-- Extra: Using index for group-by ✅ —— 松散索引扫描
-- 聚合函数不破坏松散扫描

EXPLAIN SELECT status, COUNT(*), created_at FROM orders GROUP BY status;
-- Extra: Using temporary; Using filesort ⚠️
-- created_at 不在 GROUP BY 中且不连续，松散扫描失效
```

### GROUP BY 优化建议

| 问题 | 解决方案 |
|-----|---------|
| GROUP BY 字段没有索引 | 建复合索引 `(group_col1, group_col2)` |
| SELECT 包含非分组字段 | 去掉不必要的字段 |
| GROUP BY 顺序与索引不一致 | 调整 GROUP BY 顺序匹配索引 |
| 同时有 WHERE 和 GROUP BY | WHERE 条件放索引前面，GROUP BY 放后面 |

---

## 综合优化实战

### 场景：多表 JOIN + ORDER BY + LIMIT

```sql
-- 原始慢查询
SELECT o.*, u.name, u.email
FROM orders o
JOIN users u ON o.user_id = u.id
WHERE o.status = 'paid'
ORDER BY o.created_at DESC
LIMIT 100;
```

分析：

```
EXPLAIN 结果：
table: o, type: ref, key: idx_status, Extra: Using where
table: u, type: eq_ref, key: PRIMARY, Extra: (空)
Sorting result: Using filesort ⚠️
```

优化：

```sql
-- 优化一：为 JOIN 字段和排序字段建复合索引
CREATE INDEX idx_status_created ON orders(status, created_at DESC);

-- 优化二：如果 users 表查询字段多，考虑覆盖索引
-- 先在 orders 上用索引覆盖 JOIN 和排序，再关联 users
CREATE INDEX idx_orders_join_sort ON orders(status, created_at DESC, user_id);

-- 优化三：分页查询优化（用子查询先定位主键）
SELECT o.*, u.name, u.email
FROM (
    SELECT id FROM orders 
    WHERE status = 'paid' 
    ORDER BY created_at DESC 
    LIMIT 100
) o_idx
JOIN orders o ON o_idx.id = o.id
JOIN users u ON o.user_id = u.id;
-- 核心思想：用子查询先取 ID（走索引，无需回表），再 JOIN 回表取数据
```

---

## 小结

JOIN 和子查询优化的核心原则：

| 场景 | 优化要点 |
|-----|---------|
| JOIN | 被驱动表连接字段必须有索引 |
| JOIN | 小表驱动大表（优化器通常自动处理） |
| 子查询 | 优先改写为 JOIN（MySQL 5.6+ 会自动改写） |
| 相关子查询 | 务必改写为 JOIN + GROUP BY |
| ORDER BY | 用索引覆盖排序字段 |
| GROUP BY | 遵循索引顺序，减少 SELECT 字段 |

> 记住：**JOIN 的性能瓶颈在被驱动表有没有索引，子查询的性能瓶颈在是否相关。** 解决这两个核心问题，90% 的性能问题都会消失。

---

## 下一步

深度分页是生产环境最常见的性能杀手——查询第 10000 页时，MySQL 要扫描多少行？覆盖索引和延迟关联如何解决？

从 [分页优化与覆盖索引](/database/mysql/optimize/sql/pagination-covering) 继续。

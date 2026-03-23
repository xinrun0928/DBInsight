# 索引设计：适合与不适合的场景

索引是把双刃剑——用对了加速查询，用错了拖慢写入、浪费空间。很多性能问题，不是查得不够快，而是索引建得不对。

---

## 索引设计的核心原则

在谈具体场景之前，先记住三条铁律：

> **铁律一**：索引是给**频繁出现在 WHERE/JOIN/ORDER BY/GROUP BY** 中的字段建的。
>
> **铁律二**：索引列的**区分度**（ cardinality / selectivity ）越高，效果越好。
>
> **铁律三**：索引不是越多越好。越多，维护成本越高，写入越慢。

---

## 适合创建索引的场景

### 场景一：WHERE 条件中的高频字段

```sql
-- 用户表，经常按手机号查询
SELECT * FROM users WHERE phone = '13800138000';
--                                    ↑↑↑
--                            phone 应该建索引

CREATE INDEX idx_users_phone ON users(phone);
```

**判断方法**：统计该字段在 WHERE 中的出现频率，越高越值得建。

### 场景二：JOIN 连接的字段

```sql
-- 订单表经常和用户表 JOIN
SELECT o.id, u.name, o.amount
FROM orders o
JOIN users u ON o.user_id = u.id;
--                    ↑       ↑
--           JOIN 条件两边都应该建索引

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_users_id ON users(id);  -- id 是主键，已有索引
```

**判断方法**：被频繁 JOIN 的外键字段必须建索引。

### 场景三：ORDER BY 和 GROUP BY 涉及的字段

```sql
-- 按创建时间排序的查询
SELECT * FROM orders
WHERE status = 'paid'
ORDER BY created_at DESC;

--                               ↑↑↑↑
--         status（等值）+ created_at（排序）→ 联合索引
CREATE INDEX idx_orders_status_created ON orders(status, created_at DESC);
```

**判断方法**：如果 ORDER BY/GROUP BY 的列已经在索引中，MySQL 可以直接使用索引的有序性，省去 filesort。

### 场景四：区分度高的字段

区分度 = 不同值的数量 / 总行数，越接近 1 越好。

```sql
-- 分析字段区分度
SELECT COUNT(DISTINCT status) / COUNT(*) FROM orders;
-- 0.0001 → 很差，几乎所有订单状态都差不多

SELECT COUNT(DISTINCT user_id) / COUNT(*) FROM orders;
-- 0.95 → 非常好，几乎每个用户都有独立订单
```

| 区分度范围 | 索引效果 | 建议 |
|---------|--------|-----|
| 0.8 ~ 1.0 | 优秀 | 建索引效果明显 |
| 0.3 ~ 0.8 | 一般 | 可以建，看查询频率 |
| 0.01 ~ 0.3 | 差 | 谨慎建，考虑复合索引 |
| < 0.01 | 极差 | 不建议建索引 |

### 场景五：有高并发查询需求的字段

```sql
-- 数据仓库中，按日期分区的报表查询
SELECT date, SUM(amount)
FROM sales
WHERE date BETWEEN '2024-01-01' AND '2024-12-31'
GROUP BY date;

-- date 字段建索引
CREATE INDEX idx_sales_date ON sales(date);
```

### 场景六：主键和外键

- **主键**：自动创建聚簇索引（必须建）
- **外键**：建了外键约束的列必须建索引（否则级联操作会很慢）

```sql
CREATE TABLE orders (
    id BIGINT PRIMARY KEY,           -- 聚簇索引
    user_id BIGINT NOT NULL,          -- 外键
    FOREIGN KEY (user_id) REFERENCES users(id)
    -- MySQL 自动为 user_id 创建索引（如果不存在）
);
```

---

## 不适合创建索引的场景

### 场景一：区分度极低的字段

```sql
-- 性别字段，只有 0/1 两种值
SELECT * FROM users WHERE gender = 0;
--                              ↑↑↑
--              区分度 ≈ 50%，建了索引也扫描一半数据

CREATE INDEX idx_users_gender ON users(gender);  -- ❌ 不建议
```

**替代方案**：如果这类字段必须过滤，用复合索引让其他高区分度列来筛选：

```sql
-- 高频查询：查某个性别的 VIP 用户
CREATE INDEX idx_users_vip_gender ON users(vip_level, gender);
-- 先用 vip_level 过滤到 1% 数据，再在结果中用 gender 过滤
```

### 场景二：频繁更新的字段

```sql
-- 登录计数表：last_login 每次登录都更新
CREATE TABLE login_stats (
    user_id BIGINT PRIMARY KEY,
    login_count INT DEFAULT 0,
    last_login DATETIME,    -- ⚠️ 每次登录都更新
    INDEX idx_last_login (last_login)  -- ❌ 不建议
);
```

更新流程：每次用户登录 → UPDATE 时先更新 last_login → InnoDB 还要更新 last_login 的索引树 → 索引维护成本高。

### 场景三：表数据量很小

```sql
-- 配置表，只有 10 行数据
SELECT * FROM config WHERE key = 'max_connections';

CREATE INDEX idx_config_key ON config(key);  -- ❌ 不值得
```

10 行数据，全表扫描和索引扫描几乎没有差别——B+ 树高度 0~1，遍历 10 行，索引反而多一次指针跳转。

**经验法则**：表小于 1000 行时，大多数情况下索引意义不大（当然，OLTP 业务的小表也要看查询频率）。

### 场景四：长字符串字段（无前缀索引）

```sql
-- content 字段存长文本，TEXT 类型
SELECT * FROM articles WHERE content LIKE '%MySQL%';

CREATE INDEX idx_articles_content ON articles(content);  -- ❌ 不行
```

TEXT/BLOB 字段不能直接建普通索引，因为索引长度有限制。可以用**前缀索引**：

```sql
-- 用前 50 个字符建前缀索引
CREATE INDEX idx_articles_content_pre ON articles(content(50));

-- 或者直接用全文索引
CREATE FULLTEXT INDEX ft_articles_content ON articles(content);
```

### 场景五：查询中从不使用的字段

> 建了不用 = 纯浪费。

定期用以下 SQL 审计未使用的索引（MySQL 8.0+）：

```sql
-- 查看索引使用情况（performance_schema）
SELECT 
    object_schema,
    object_name,
    index_name,
    count_star AS usage_count
FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE index_name IS NOT NULL
  AND count_star = 0
ORDER BY object_schema, object_name;
```

找到使用次数为 0 的索引，直接删掉。

### 场景六：过多索引

一张表的索引过多会产生严重的写入性能问题。

| 问题 | 影响 |
|-----|------|
| INSERT | 每条记录要更新所有索引，I/O 倍增 |
| UPDATE | 更新索引列时，相应索引都要更新 |
| DELETE | 删除记录时，所有索引的对应条目都要删 |
| 空间 | 索引文件可能比数据文件还大 |

**经验法则**：单表索引数量控制在 5 个以内。

---

## 索引设计 checklist

写完 SQL 后问自己：

```
□ 这个 SQL 在 WHERE 中用了哪些列？ → 检查是否已建索引
□ 这个 SQL 在 JOIN 中用了哪些列？ → 检查外键是否已建索引
□ 这个 SQL 在 ORDER BY 中用了哪些列？ → 考虑复合索引
□ 被索引的列区分度如何？ → cardinality 接近总行数才有效
□ 这个字段更新频繁吗？ → 频繁更新的列不适合建索引
□ 这个表有多少个索引了？ → 超过 5 个要重新评估
```

---

## 小结

索引设计是 MySQL 优化的起点，也是最容易出错的环节。

记住两句话：

- **建索引之前先看查询**：不要为了"以后可能用到"而建索引
- **索引好不好，看 Cardinality**：区分度低等于没建

---

## 下一步

理解了索引的原理和设计原则，现在深入到 InnoDB 的底层存储结构——索引是如何在磁盘上组织的？

从 [InnoDB 页结构](/database/mysql/optimize/innodb/page) 继续。

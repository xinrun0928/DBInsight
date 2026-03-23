# 自连接、内连接与外连接

这一节讲清楚 SQL92 和 SQL99 标准中最重要的几种连接方式，以及它们的实际应用。

---

## 内连接（INNER JOIN）

**只保留两边都匹配的行**。

```sql
-- SQL92 语法
SELECT o.*, u.name 
FROM orders o, users u
WHERE o.user_id = u.id;

-- SQL99 语法（推荐）
SELECT o.*, u.name 
FROM orders o
INNER JOIN users u ON o.user_id = u.id;
```

### 内连接的执行过程

```
orders:  id=1 user_id=10, id=2 user_id=20, id=3 user_id=30
users:   id=10 name='Tom', id=20 name='Amy'

ON o.user_id = u.id:

匹配过程：
o.id=1 + o.user_id=10 → 匹配 users.id=10 → 结果: order1 + Tom
o.id=2 + o.user_id=20 → 匹配 users.id=20 → 结果: order2 + Amy
o.id=3 + o.user_id=30 → users 中无 id=30 → 丢弃

最终：只保留 2 条匹配的行
```

**不匹配的行被丢弃**：user_id=30 的订单没有匹配的用户，直接丢失。

---

## 外连接（OUTER JOIN）

外连接保留"一边不匹配"的行。

### 左外连接（LEFT OUTER JOIN）

**保留左表全部行，右表不匹配则填 NULL**。

```sql
SELECT o.*, u.name
FROM orders o
LEFT JOIN users u ON o.user_id = u.id;
```

```
orders:  id=1 user_id=10, id=2 user_id=20, id=3 user_id=30
users:   id=10 name='Tom', id=20 name='Amy'

结果：
id=1 + user_id=10 → Tom    ← 匹配
id=2 + user_id=20 → Amy    ← 匹配
id=3 + user_id=30 → NULL   ← 不匹配，填 NULL
```

### 右外连接（RIGHT OUTER JOIN）

**保留右表全部行，左表不匹配则填 NULL**。

```sql
SELECT o.*, u.name
FROM orders o
RIGHT JOIN users u ON o.user_id = u.id;
```

```
结果：
id=1 + user_id=10 → Tom    ← 匹配
id=2 + user_id=20 → Amy    ← 匹配
NULL              → Bob   ← orders 中没有 user_id=40 的订单
```

### 全外连接（FULL OUTER JOIN）

**保留两边所有行，不匹配的一侧填 NULL**。

MySQL 不直接支持 FULL OUTER JOIN，但可以用 UNION 模拟：

```sql
-- 方式一：MySQL 模拟全外连接
SELECT o.*, u.name
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
UNION
SELECT o.*, u.name
FROM orders o
RIGHT JOIN users u ON o.user_id = u.id;

-- 方式二：用 UNION ALL + WHERE（保留重复）
SELECT o.*, u.name
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
UNION ALL
SELECT o.*, u.name
FROM orders o
RIGHT JOIN users u ON o.user_id = u.id
WHERE o.id IS NULL;  -- 过滤掉已匹配的行
```

---

## SQL92 vs SQL99 语法对比

| SQL92 | SQL99 | 说明 |
|-------|-------|------|
| `FROM a, b WHERE a.id = b.id` | `FROM a JOIN b ON a.id = b.id` | 等值连接 |
| 不支持 | `LEFT JOIN / RIGHT JOIN` | 外连接 |
| 连接条件和过滤混在一起 | ON 只管连接，WHERE 只管过滤 | 可读性更好 |

### SQL92 的问题

```sql
-- SQL92：连接条件和过滤混在一起
SELECT o.*, u.name
FROM orders o, users u
WHERE o.user_id = u.id
  AND o.status = 'pending'  -- 混合在一起，难以区分
  AND u.level = 'vip';
```

```sql
-- SQL99：清晰分离
SELECT o.*, u.name
FROM orders o
INNER JOIN users u ON o.user_id = u.id
WHERE o.status = 'pending'
  AND u.level = 'vip';
```

> **推荐使用 SQL99 语法**——连接条件和过滤条件分离，逻辑更清晰。

---

## 自然连接（NATURAL JOIN）

自然连接自动以**同名列**为连接条件，不需要写 ON。

```sql
-- 两张表都有 id 列，自动用 id 连接
SELECT *
FROM orders
NATURAL JOIN users;
-- 等价于：
SELECT *
FROM orders
JOIN users ON orders.id = users.id;  -- 自动推断

-- 如果没有同名列，返回笛卡尔积
```

> **慎用**：NATURAL JOIN 依赖同名列存在，容易产生意想不到的结果。生产环境推荐显式写 ON。

---

## USING 子句

如果列名相同，可以用 USING 简化：

```sql
-- 简化写法
SELECT *
FROM orders
JOIN users USING (id);
-- 等价于：
SELECT *
FROM orders
JOIN users ON orders.id = users.id;
```

---

## 实际应用

### 场景一：查所有订单，包含用户名（不丢失无用户订单）

```sql
SELECT 
    o.id,
    o.order_no,
    o.amount,
    IFNULL(u.name, '未知用户') AS customer_name
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
ORDER BY o.created_at DESC;
```

### 场景二：查所有用户，显示他们的订单数（不丢失无订单用户）

```sql
SELECT 
    u.id,
    u.name,
    COUNT(o.id) AS order_count,
    IFNULL(SUM(o.amount), 0) AS total_spent
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.name
ORDER BY total_spent DESC;
```

### 场景三：查同时买过商品 A 和商品 B 的用户

```sql
-- 用两个 JOIN 指向同一张表
SELECT DISTINCT o1.user_id
FROM orders o1
JOIN order_items oi1 ON o1.id = oi1.order_id AND oi1.product_id = 100  -- 商品 A
JOIN order_items oi2 ON o1.user_id = (
    SELECT user_id FROM orders o2 JOIN order_items oi3 ON o2.id = oi3.order_id WHERE oi3.product_id = 200
) oi2.product_id = 200;  -- 商品 B
```

---

## 小结

| 连接类型 | 保留什么 | 不匹配的行 |
|---------|---------|-----------|
| INNER JOIN | 两边都匹配 | 丢弃 |
| LEFT JOIN | 左表全部 | 右表填 NULL |
| RIGHT JOIN | 右表全部 | 左表填 NULL |
| FULL OUTER JOIN | 两边全部 | 各自填 NULL |

> 记忆口诀：**LEFT 留住左边，RIGHT 留住右边，INNER 只留两边都有，OUTER 留住"外面"的多余行**。

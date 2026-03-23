# 七种 JOIN 及 NATURAL JOIN / USING

JOIN 是 SQL 中最容易出错的部分。这一节用图解讲清楚所有 7 种 JOIN 的区别。

---

## 七种 JOIN 回顾

用集合图表示两种表（A 和 B）的连接：

```
表 A（orders）           表 B（users）
┌─────┐               ┌─────┐
│ 1   │               │ 10  │
│ 2   │               │ 20  │
│ 3   │               │ 30  │
└─────┘               └─────┘
```

### 1. INNER JOIN（内连接）

```sql
SELECT * FROM A INNER JOIN B ON A.id = B.id;
```

```
结果：只保留两边都匹配的行
┌─────┐
│ 1   │  ← A.id=1 匹配 B.id=10
│ 2   │  ← A.id=2 匹配 B.id=20
└─────┘
```

### 2. LEFT JOIN（左外连接）

```sql
SELECT * FROM A LEFT JOIN B ON A.id = B.id;
```

```
结果：保留 A 全部行，B 不匹配填 NULL
┌─────┐ ┌──────┐
│ 1   │ │ 10   │  ← 匹配
│ 2   │ │ 20   │  ← 匹配
│ 3   │ │ NULL │  ← 不匹配
└─────┘ └──────┘
```

### 3. RIGHT JOIN（右外连接）

```sql
SELECT * FROM A RIGHT JOIN B ON A.id = B.id;
```

```
结果：保留 B 全部行，A 不匹配填 NULL
┌──────┐ ┌─────┐
│ NULL │ │ 10  │
│ NULL │ │ 20  │
│ NULL │ │ 30  │  ← B 独有
└──────┘ └─────┘
```

### 4. FULL OUTER JOIN（全外连接）

```sql
-- MySQL 模拟
SELECT * FROM A LEFT JOIN B ON A.id = B.id
UNION
SELECT * FROM A RIGHT JOIN B ON A.id = B.id;
```

```
结果：两边全部保留，不匹配填 NULL
┌─────┐ ┌──────┐
│ 1   │ │ 10   │  ← 匹配
│ 2   │ │ 20   │  ← 匹配
│ 3   │ │ NULL │  ← A 独有
│ NULL│ │ 30   │  ← B 独有
└─────┘ └──────┘
```

### 5. LEFT JOIN excl（右表独有）

只保留 B 有、A 没有的行（LEFT JOIN - INNER JOIN）。

```sql
SELECT * FROM A LEFT JOIN B ON A.id = B.id WHERE B.id IS NULL;
```

```
结果：
┌──────┐ ┌─────┐
│ NULL │ │ 30  │  ← B 独有
└──────┘ └─────┘
```

### 6. RIGHT JOIN excl（左表独有）

只保留 A 有、B 没有的行（RIGHT JOIN - INNER JOIN）。

```sql
SELECT * FROM A RIGHT JOIN B ON A.id = B.id WHERE A.id IS NULL;
```

```
结果：
┌─────┐ ┌──────┐
│ 3   │ │ NULL │  ← A 独有
└─────┘ └──────┘
```

### 7. CROSS JOIN（笛卡尔积）

```sql
SELECT * FROM A CROSS JOIN B;
```

```
结果：A × B 的笛卡尔积
┌─────┐ ┌──────┐
│ 1   │ │ 10   │
│ 1   │ │ 20   │
│ 1   │ │ 30   │
│ 2   │ │ 10   │
│ 2   │ │ 20   │
│ 2   │ │ 30   │
│ 3   │ │ 10   │
│ 3   │ │ 20   │
│ 3   │ │ 30   │
└─────┘ └──────┘
```

---

## 集合对照表

| JOIN 类型 | A∩B | A-B | B-A | A×B |
|---------|-----|-----|-----|-----|
| INNER | ✅ | ❌ | ❌ | ❌ |
| LEFT | ✅ | ✅ | ❌ | ❌ |
| RIGHT | ✅ | ❌ | ✅ | ❌ |
| FULL | ✅ | ✅ | ✅ | ❌ |
| A LEFT excl B | ❌ | ✅ | ❌ | ❌ |
| B RIGHT excl A | ❌ | ❌ | ✅ | ❌ |
| CROSS | ❌ | ❌ | ❌ | ✅ |

---

## NATURAL JOIN

NATURAL JOIN 自动匹配**同名列**进行连接，不需要写 ON。

```sql
-- 两张表都有 id 列
SELECT * FROM orders NATURAL JOIN users;
-- 等价于：
SELECT * FROM orders JOIN users ON orders.id = users.id;
```

**问题**：如果意外出现同名列，可能产生意外结果。

```sql
-- 如果 orders 表有 created_by 列，users 表也有 created_by 列
-- NATURAL JOIN 会用 created_by 连接，而不只是 id
-- 灾难：订单和用户通过创建时间连接（完全错误）
```

> **生产建议**：不要用 NATURAL JOIN，显式写出连接条件。

---

## USING 子句

当列名相同时，用 USING 简化：

```sql
-- 简洁写法
SELECT *
FROM orders
JOIN users USING (id);

-- 等价于：
SELECT *
FROM orders
JOIN users ON orders.id = users.id;
```

### USING 的优势

```sql
-- 多表连接，有多个相同列时
SELECT *
FROM order_items
JOIN orders USING (order_id)
JOIN products USING (product_id);

-- 比 ON 简洁很多
-- ON order_items.order_id = orders.order_id 
-- AND order_items.product_id = products.product_id
```

### USING 的注意点

```sql
-- SELECT * 时，USING 会合并同名列（只出现一次）
-- ON 会保留两边的列

-- USING (id)
SELECT * FROM orders JOIN users USING (id);
-- 结果：id, user_id, amount, name, email  ← id 只出现一次

-- ON o.id = u.id
SELECT * FROM orders o JOIN users u ON o.id = u.id;
-- 结果：o.id, u.id, user_id, name, email   ← 两边 id 都出现
```

---

## 实际应用场景

### 场景一：查所有订单，包含用户名（不允许丢失）

```sql
SELECT o.id, o.amount, IFNULL(u.name, 'Ghost') AS customer
FROM orders o
LEFT JOIN users u ON o.user_id = u.id;
```

### 场景二：查下了单但从未付款的用户

```sql
SELECT DISTINCT u.*
FROM users u
JOIN orders o ON u.id = o.user_id
LEFT JOIN payments p ON o.id = p.order_id
WHERE p.id IS NULL;
```

### 场景三：笛卡尔积的应用（生成时间维度表）

```sql
-- 生成一年的日期表
SELECT DATE_ADD('2024-01-01', INTERVAL n DAY) AS calendar_date
FROM (
    SELECT @row := @row + 1 AS n
    FROM any_small_table,
         (SELECT @row := -1) r
    LIMIT 365
) t;
```

---

## 小结

七种 JOIN 实际上是四种基础操作的不同组合：

```
笛卡尔积（×）
    ↓ 过滤
内连接（A∩B）
    ↓ 加左独有（A-B）
左连接（A∪(A-B)）
    ↓ 加右独有（B-A）
全外连接（A∪B）
```

> 实际开发中，**INNER、LEFT、笛卡尔积**三种用得最多，其他四种是理解工具，在特定场景下才用。

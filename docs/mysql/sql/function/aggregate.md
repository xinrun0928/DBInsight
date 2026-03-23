# 聚合函数与 GROUP BY

聚合函数将多行数据汇总成一行，是数据分析的核心工具。结合 GROUP BY，可以做分组统计。

---

## 聚合函数一览

| 函数 | 说明 | 忽略 NULL |
|-----|------|----------|
| `COUNT(*)` | 计数（包含 NULL） | 不适用 |
| `COUNT(col)` | 计数（忽略 NULL） | ✅ 忽略 |
| `COUNT(DISTINCT col)` | 去重计数 | ✅ 忽略 |
| `SUM(col)` | 求和 | ✅ 忽略 |
| `AVG(col)` | 平均值 | ✅ 忽略 |
| `MAX(col)` | 最大值 | ✅ 忽略 |
| `MIN(col)` | 最小值 | ✅ 忽略 |
| `GROUP_CONCAT(col)` | 字符串拼接 | ✅ 忽略 |
| `STD / STDDEV(col)` | 标准差 | ✅ 忽略 |
| `VARIANCE(col)` | 方差 | ✅ 忽略 |

---

## COUNT 的三种写法

```sql
-- COUNT(*)：统计所有行（包括重复和 NULL）
SELECT COUNT(*) FROM orders;  -- 1000

-- COUNT(col)：统计非 NULL 的行
SELECT COUNT(phone) FROM users;  -- 忽略 phone 为 NULL 的用户

-- COUNT(DISTINCT col)：去重计数
SELECT COUNT(DISTINCT status) FROM orders;  -- 返回有多少种不同的状态

-- COUNT + DISTINCT 配合：组合使用
SELECT COUNT(DISTINCT user_id) AS unique_customers,
       COUNT(DISTINCT product_id) AS unique_products
FROM orders;
```

### COUNT(*) vs COUNT(col)

```sql
-- orders 表有 1000 行，其中 50 行的 remark 字段为 NULL
SELECT COUNT(*) FROM orders;       -- 1000（统计所有行）
SELECT COUNT(remark) FROM orders;   -- 950（忽略 NULL）
SELECT COUNT(DISTINCT remark) FROM orders;  -- 100（去重后的非 NULL 值）
```

---

## SUM / AVG / MAX / MIN

```sql
-- 统计订单总金额
SELECT SUM(amount) AS total_amount FROM orders;

-- 平均订单金额
SELECT AVG(amount) AS avg_amount FROM orders;

-- 最高和最低薪资
SELECT MAX(salary) AS max_salary, MIN(salary) AS min_salary FROM employees;

-- 组合使用
SELECT 
    COUNT(*) AS order_count,
    SUM(amount) AS total_amount,
    AVG(amount) AS avg_amount,
    MAX(amount) AS max_amount,
    MIN(amount) AS min_amount
FROM orders
WHERE status = 'completed';
```

### 聚合函数忽略 NULL

```sql
-- 假设 amount 列有 3 行：100, NULL, 200
SELECT SUM(amount) FROM t;   -- 300（忽略 NULL）
SELECT AVG(amount) FROM t;   -- 150（忽略 NULL，只算2行）
SELECT COUNT(amount) FROM t;  -- 2（忽略 NULL）

-- 如果想把 NULL 当 0 处理：
SELECT SUM(IFNULL(amount, 0)) FROM t;   -- 300
SELECT AVG(IFNULL(amount, 0)) FROM t;   -- 100（NULL→0，共3行）
```

---

## GROUP BY：分组

### 基本用法

```sql
-- 按状态统计订单数
SELECT 
    status,
    COUNT(*) AS order_count
FROM orders
GROUP BY status;

-- 按月统计收入
SELECT 
    DATE_FORMAT(created_at, '%Y-%m') AS month,
    SUM(amount) AS monthly_revenue,
    COUNT(*) AS order_count
FROM orders
WHERE status = 'paid'
GROUP BY DATE_FORMAT(created_at, '%Y-%m')
ORDER BY month;
```

### GROUP BY + 聚合函数组合

```sql
-- 按用户统计消费
SELECT 
    user_id,
    COUNT(*) AS order_count,
    SUM(amount) AS total_spent,
    AVG(amount) AS avg_order_value,
    MAX(created_at) AS last_order_date
FROM orders
GROUP BY user_id
HAVING order_count >= 5  -- 过滤：至少下过 5 单的用户
ORDER BY total_spent DESC;
```

---

## HAVING：过滤分组

HAVING 和 WHERE 的区别：

| 子句 | 作用对象 | 执行时机 | 能用聚合函数 |
|-----|---------|---------|----------|
| WHERE | 行（分组前过滤） | 先于 GROUP BY | ❌ 不能 |
| HAVING | 分组（分组后过滤） | 后于 GROUP BY | ✅ 能 |

```sql
-- 查消费总额超过 10000 的用户
SELECT 
    user_id,
    SUM(amount) AS total_spent
FROM orders
GROUP BY user_id
HAVING SUM(amount) > 10000
ORDER BY total_spent DESC;

-- WHERE 和 HAVING 配合
SELECT 
    status,
    COUNT(*) AS cnt,
    SUM(amount) AS total
FROM orders
WHERE created_at >= '2024-01-01'    -- 先过滤行
GROUP BY status
HAVING COUNT(*) > 100                 -- 再过滤分组
ORDER BY total DESC;
```

---

## GROUP_CONCAT：字符串聚合

GROUP_CONCAT 将分组内的多行字符串合并成一行：

```sql
-- 按部门列出所有员工
SELECT 
    department,
    GROUP_CONCAT(name ORDER BY name SEPARATOR ', ') AS employee_list
FROM employees
GROUP BY department;

-- 结果：
-- Engineering | Alice, Bob, Charlie
-- Sales       | David, Eve, Frank

-- SEPARATOR：分隔符（默认逗号）
SELECT 
    order_id,
    GROUP_CONCAT(product_id SEPARATOR '; ') AS products
FROM order_items
GROUP BY order_id;

-- DISTINCT：去重
SELECT 
    department,
    GROUP_CONCAT(DISTINCT LEFT(name, 1) ORDER BY LEFT(name, 1) SEPARATOR '') AS initials
FROM employees
GROUP BY department;
```

### GROUP_CONCAT 的长度限制

```sql
-- 查看默认长度
SHOW VARIABLES LIKE 'group_concat_max_len';  -- 默认 1024

-- 设置全局或会话级别长度
SET SESSION group_concat_max_len = 8192;
```

---

## 多级分组

### ROLLUP：合计行

MySQL 不支持 CUBE，但支持 ROLLUP：

```sql
-- 按部门和小组统计，再加合计行
SELECT 
    department,
    team,
    COUNT(*) AS headcount,
    SUM(salary) AS total_salary
FROM employees
GROUP BY department, team WITH ROLLUP;

-- 结果：
-- Engineering, Backend, 10, 800000    ← 各组
-- Engineering, NULL, 25, 2000000     ← Engineering 合计
-- NULL, NULL, 50, 5000000         ← 总计
-- 注意：WITH ROLLUP 会在分组层级添加 NULL 行
```

### 手动模拟 CUBE（交叉聚合）

```sql
-- CUBE：所有分组组合的交叉聚合
-- MySQL 不直接支持，用 UNION ALL 模拟
SELECT department, team, SUM(salary) AS total
FROM employees GROUP BY department, team
UNION ALL
SELECT department, 'ALL' AS team, SUM(salary) AS total
FROM employees GROUP BY department
UNION ALL
SELECT 'ALL' AS department, team, SUM(salary) AS total
FROM employees GROUP BY team
UNION ALL
SELECT 'ALL', 'ALL', SUM(salary) FROM employees;
```

---

## 综合案例

### 场景一：用户留存分析

```sql
-- 计算每月新增用户数和次月留存率
WITH monthly_users AS (
    SELECT 
        DATE_FORMAT(created_at, '%Y-%m') AS month,
        DATE_FORMAT(created_at, '%Y-%m') AS reg_month,
        id AS user_id
    FROM users
),
user_orders AS (
    SELECT 
        DATE_FORMAT(o.created_at, '%Y-%m') AS order_month,
        mu.reg_month,
        COUNT(DISTINCT mu.user_id) AS active_users
    FROM monthly_users mu
    JOIN orders o ON mu.user_id = o.user_id
    GROUP BY DATE_FORMAT(o.created_at, '%Y-%m'), mu.reg_month
)
SELECT 
    mu.month AS register_month,
    COUNT(DISTINCT mu.user_id) AS new_users,
    COUNT(DISTINCT CASE 
        WHEN DATE_FORMAT(o.created_at, '%Y-%m') > mu.month 
        THEN mu.user_id END) AS retained_users,
    COUNT(DISTINCT CASE 
        WHEN DATE_FORMAT(o.created_at, '%Y-%m') = DATE_FORMAT(DATE_ADD(STR_TO_DATE(CONCAT(mu.month, '-01'), INTERVAL 1 MONTH), '%Y-%m')
        THEN mu.user_id END) AS m1_retained
FROM monthly_users mu
LEFT JOIN orders o ON mu.user_id = o.user_id
GROUP BY mu.month
ORDER BY mu.month;
```

### 场景二：商品销售排行榜

```sql
-- 按品类统计销售额 Top 3 商品
SELECT 
    category,
    product_name,
    total_sales
FROM (
    SELECT 
        p.category,
        p.name AS product_name,
        SUM(oi.quantity * oi.price) AS total_sales,
        ROW_NUMBER() OVER (
            PARTITION BY p.category 
            ORDER BY SUM(oi.quantity * oi.price) DESC
        ) AS rank_in_category
    FROM products p
    JOIN order_items oi ON p.id = oi.product_id
    JOIN orders o ON oi.order_id = o.id
    WHERE o.status = 'completed'
    GROUP BY p.category, p.id, p.name
) ranked
WHERE rank_in_category <= 3
ORDER BY category, total_sales DESC;
```

---

## 小结

聚合函数的核心要点：

| 要点 | 说明 |
|-----|------|
| 聚合函数忽略 NULL | SUM/AVG/COUNT 都不统计 NULL 值 |
| COUNT(*) vs COUNT(col) | * 统计所有行，col 只统计非 NULL |
| HAVING vs WHERE | WHERE 过滤行，HAVING 过滤分组 |
| GROUP_CONCAT | 将分组内的字符串合并，支持去重和排序 |

> 记住：**GROUP BY 是聚合的前提**（除 COUNT(*) 外），聚合函数将多行变成一行——理解这一点，就理解了聚合的本质。

# 窗口函数与 CTE（MySQL 8.0 新特性）

MySQL 8.0 引入了两个重磅特性：窗口函数和 CTE（公用表表达式）。这两个特性让复杂查询变得优雅而强大。

---

## 窗口函数是什么

窗口函数（Window Function）对**一组行**执行计算，但**不像 GROUP BY 那样折叠行**——每行都保留自己的值，同时获得聚合/排序信息。

```
GROUP BY：多行 → 一行（折叠）
窗口函数：多行 → 多行（每行带额外信息）
```

```sql
-- GROUP BY：每人只返回一行汇总
SELECT department, AVG(salary) AS avg_salary
FROM employees
GROUP BY department;

-- 窗口函数：每人还是一行，但多了平均薪资列
SELECT name, department, salary,
       AVG(salary) OVER (PARTITION BY department) AS dept_avg_salary
FROM employees;
-- 结果：每行都有部门的平均薪资
```

---

## 窗口函数一览

| 函数 | 说明 |
|-----|------|
| 聚合窗口函数 | SUM, AVG, COUNT, MIN, MAX |
| 排名函数 | ROW_NUMBER, RANK, DENSE_RANK |
| 分布函数 | PERCENT_RANK, CUME_DIST |
| 取值函数 | FIRST_VALUE, LAST_VALUE, LAG, LEAD, NTH_VALUE |
| 行号函数 | ROW_NUMBER |

---

## OVER 子句

`OVER` 定义窗口的边界：

```sql
-- PARTITION BY：分区（类似 GROUP BY）
-- ORDER BY：排序（窗口内的排序）
-- ROWS / RANGE：窗口大小

-- 基础语法
AVG(salary) OVER (
    PARTITION BY department        -- 按部门分区
    ORDER BY hire_date            -- 窗口内按入职日期排序
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW  -- 从第一行到当前行
) AS running_avg
```

### ROWS vs RANGE

```sql
-- ROWS：按物理行数计算
-- 窗口 = 当前行 ± 3 行
ROWS BETWEEN 3 PRECEDING AND 3 FOLLOWING

-- RANGE：按值范围计算（相同值一起计算）
-- 窗口 = 与当前行值相同的所有行
RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
```

---

## 排名函数

### ROW_NUMBER / RANK / DENSE_RANK

```sql
SELECT 
    name,
    department,
    salary,
    -- 每行按部门内薪资排名（1=最高）
    ROW_NUMBER() OVER (
        PARTITION BY department 
        ORDER BY salary DESC
    ) AS row_num,        -- 1, 2, 3, 4（无间隙）
    
    RANK() OVER (
        PARTITION BY department 
        ORDER BY salary DESC
    ) AS rank_num,       -- 1, 2, 2, 4（有间隙，并列后跳号）
    
    DENSE_RANK() OVER (
        PARTITION BY department 
        ORDER BY salary DESC
    ) AS dense_rank_num   -- 1, 2, 2, 3（无间隙，并列后不跳号）
FROM employees;
```

| salary | ROW_NUMBER | RANK | DENSE_RANK |
|--------|-----------|------|-----------|
| 10000 | 1 | 1 | 1 |
| 8000 | 2 | 2 | 2 |
| 8000 | 3 | 2 | 2 |
| 6000 | 4 | 4 | 3 |

### 实际应用：查部门薪资 Top 3

```sql
SELECT name, department, salary
FROM (
    SELECT name, department, salary,
           ROW_NUMBER() OVER (
               PARTITION BY department 
               ORDER BY salary DESC
           ) AS rank_in_dept
    FROM employees
) ranked
WHERE rank_in_dept <= 3;
```

---

## LAG 与 LEAD：取上下行

```sql
-- LAG(col)：取当前行**前**一行
-- LEAD(col)：取当前行**后**一行

SELECT 
    order_no,
    created_at,
    amount,
    -- 上一个订单的金额
    LAG(amount, 1) OVER (
        PARTITION BY user_id 
        ORDER BY created_at
    ) AS prev_amount,
    
    -- 上上一个订单的金额
    LAG(amount, 2) OVER (
        PARTITION BY user_id 
        ORDER BY created_at
    ) AS prev_2_amount,
    
    -- 下一个订单的金额
    LEAD(amount, 1) OVER (
        PARTITION BY user_id 
        ORDER BY created_at
    ) AS next_amount
FROM orders
ORDER BY user_id, created_at;
```

### 计算增长率

```sql
SELECT 
    order_no,
    created_at,
    amount,
    prev_amount,
    ROUND((amount - prev_amount) / prev_amount * 100, 2) AS growth_rate
FROM (
    SELECT 
        order_no,
        created_at,
        amount,
        LAG(amount, 1) OVER (ORDER BY created_at) AS prev_amount
    FROM orders
) t;
```

---

## FIRST_VALUE / LAST_VALUE / NTH_VALUE

```sql
-- FIRST_VALUE：窗口内第一个值
-- LAST_VALUE：窗口内最后一个值
-- NTH_VALUE(col, n)：窗口内第 n 个值

SELECT 
    order_no,
    created_at,
    amount,
    FIRST_VALUE(amount) OVER (
        PARTITION BY user_id 
        ORDER BY created_at
    ) AS first_amount,           -- 用户的第一笔订单金额
    
    LAST_VALUE(amount) OVER (
        PARTITION BY user_id 
        ORDER BY created_at
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS last_amount,             -- 用户的最后一笔订单金额
    
    NTH_VALUE(amount, 3) OVER (
        PARTITION BY user_id 
        ORDER BY created_at
    ) AS third_amount            -- 用户的第三笔订单金额
FROM orders
ORDER BY user_id, created_at;
```

---

## CTE：公用表表达式

CTE（Common Table Expression）是用**命名**的方式定义临时结果集，让复杂查询更易读。

### 基础 CTE

```sql
-- 一次性 CTE
WITH dept_salary_stats AS (
    SELECT 
        department,
        AVG(salary) AS avg_salary,
        MAX(salary) AS max_salary
    FROM employees
    GROUP BY department
)
SELECT 
    e.name,
    e.department,
    e.salary,
    d.avg_salary,
    ROUND((e.salary - d.avg_salary) / d.avg_salary * 100, 2) AS pct_vs_avg
FROM employees e
JOIN dept_salary_stats d ON e.department = d.department
ORDER BY pct_vs_avg DESC;
```

### 多重 CTE

```sql
WITH 
-- 第一个 CTE：活跃用户
active_users AS (
    SELECT user_id
    FROM orders
    WHERE status = 'completed'
    GROUP BY user_id
    HAVING COUNT(*) >= 5
),
-- 第二个 CTE：用户消费统计
user_stats AS (
    SELECT 
        o.user_id,
        SUM(o.amount) AS total_spent,
        COUNT(*) AS order_count
    FROM orders o
    WHERE o.user_id IN (SELECT user_id FROM active_users)
    GROUP BY o.user_id
),
-- 第三个 CTE：Top 10 消费用户
top_users AS (
    SELECT user_id, total_spent
    FROM user_stats
    ORDER BY total_spent DESC
    LIMIT 10
)
SELECT 
    u.name,
    u.email,
    s.order_count,
    s.total_spent,
    RANK() OVER (ORDER BY s.total_spent DESC) AS rank_in_top
FROM top_users t
JOIN users u ON t.user_id = u.id
JOIN user_stats s ON t.user_id = s.user_id
ORDER BY s.total_spent DESC;
```

### 递归 CTE

递归 CTE 可以生成序列、遍历层级结构：

```sql
-- 生成数字序列 1~100
WITH RECURSIVE seq(n) AS (
    SELECT 1
    UNION ALL
    SELECT n + 1 FROM seq WHERE n < 100
)
SELECT n FROM seq;

-- 生成日期序列
WITH RECURSIVE date_seq(d) AS (
    SELECT DATE('2024-01-01')
    UNION ALL
    SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM date_seq 
    WHERE d < '2024-01-31'
)
SELECT d AS calendar_date FROM date_seq;

-- 遍历组织架构（员工-经理层级）
WITH RECURSIVE org_path AS (
    -- 起点：CEO
    SELECT id, name, manager_id, name AS path
    FROM employees
    WHERE manager_id IS NULL
    
    UNION ALL
    
    -- 递归：下属
    SELECT e.id, e.name, e.manager_id, 
           CONCAT(op.path, ' -> ', e.name)
    FROM employees e
    JOIN org_path op ON e.manager_id = op.id
)
SELECT * FROM org_path ORDER BY path;
```

---

## 窗口函数与 CTE 的结合

```sql
-- 场景：计算用户每笔订单占总消费的比例
WITH user_spending AS (
    SELECT 
        user_id,
        order_no,
        amount,
        SUM(amount) OVER (
            PARTITION BY user_id
        ) AS total_user_spending,
        RANK() OVER (
            PARTITION BY user_id 
            ORDER BY amount DESC
        ) AS order_rank
    FROM orders
)
SELECT 
    order_no,
    amount,
    total_user_spending,
    ROUND(amount / total_user_spending * 100, 2) AS pct_of_total,
    CONCAT(order_rank, '/', COUNT(*) OVER (PARTITION BY user_id)) AS rank_info
FROM user_spending
ORDER BY user_id, amount DESC;
```

---

## 小结

窗口函数的核心价值：**在保留明细的同时获取汇总信息**。

| 函数 | 作用 |
|-----|------|
| SUM/AVG/COUNT OVER | 带聚合的明细查询 |
| ROW_NUMBER/RANK/DENSE_RANK | 排名 |
| LAG/LEAD | 前后行的值 |
| FIRST_VALUE/LAST_VALUE/NTH_VALUE | 取窗口内特定位置的值 |
| PERCENT_RANK/CUME_DIST | 百分位排名 |

CTE 的核心价值：**让复杂查询更易读、更易维护**。

| CTE 类型 | 用途 |
|--------|-----|
| 一次性 CTE | 简化嵌套查询，定义中间结果 |
| 递归 CTE | 生成序列、遍历树形结构 |

> 记住：**窗口函数 + CTE = 现代 SQL 的双剑合璧**。遇到需要"排名"、"累计"、"前后行比较"、"多步骤聚合"的需求，优先考虑窗口函数和 CTE。

# 子查询：单行子查询

子查询是"查询中的查询"——用括号包裹一个 SELECT 语句，作为另一个查询的一部分。

---

## 子查询的分类

按返回结果分类：

| 类型 | 返回值 | 适用运算符 |
|-----|-------|---------|
| 标量子查询 | 单个值（1行1列） | 任何运算符 |
| 列子查询 | 单列多行 | IN / NOT IN / ANY / ALL |
| 行子查询 | 单行多列 | = / <> / IN |
| 表子查询 | 多行多列 | 作为 FROM 数据源 |

按位置分类：

| 位置 | 名称 | 特点 |
|-----|------|-----|
| SELECT 后 | 标量子查询 | 每行返回一个值 |
| FROM 后 | 表子查询 | 先执行，作为临时表 |
| WHERE 后 | 标量/列/行子查询 | 条件过滤 |
| HAVING 后 | 标量子查询 | 分组后条件过滤 |

---

## 标量子查询

返回**单个值**的子查询，是最简单也最常用的子查询类型。

### 基本用法

```sql
-- 查薪资高于平均薪资的员工
SELECT name, salary
FROM employees
WHERE salary > (
    SELECT AVG(salary) FROM employees
);

-- 查最新一笔订单的详情
SELECT *
FROM orders
WHERE created_at = (
    SELECT MAX(created_at) FROM orders
);

-- 查每个部门薪资最高的员工
SELECT name, department, salary
FROM employees e
WHERE salary = (
    SELECT MAX(salary) FROM employees 
    WHERE department = e.department
);
```

### 标量子查询与列子查询结合

```sql
-- 查比整个公司平均薪资都高的部门
SELECT department, AVG(salary) AS avg_salary
FROM employees
GROUP BY department
HAVING AVG(salary) > (
    SELECT AVG(salary) FROM employees
)
ORDER BY avg_salary DESC;
```

---

## 相关子查询

**相关子查询**（Correlated Subquery）是指子查询依赖外层查询的列——子查询的执行次数等于外层查询的行数。

### 执行原理

```sql
-- 查每个部门薪资最高的员工
SELECT name, department, salary
FROM employees e
WHERE salary = (
    SELECT MAX(salary) 
    FROM employees 
    WHERE department = e.department  -- 依赖外层的 e.department
);
```

执行过程：

```
外层第一行（Alice, Engineering, 15000）：
  → 子查询 MAX(salary) WHERE department='Engineering' = 15000
  → 15000 = 15000 → 保留

外层第二行（Bob, Engineering, 12000）：
  → 子查询 MAX(salary) WHERE department='Engineering' = 15000
  → 12000 = 15000 → 不保留

外层第三行（Charlie, Sales, 10000）：
  → 子查询 MAX(salary) WHERE department='Sales' = 10000
  → 10000 = 10000 → 保留
```

### 相关子查询 vs 非相关子查询

| 类型 | 执行次数 | 特点 |
|-----|---------|-----|
| 非相关子查询 | 只执行一次 | 先执行子查询，结果供外层使用 |
| 相关子查询 | 执行 N 次（N=外层行数） | 每行都要执行一次，效率可能低 |

```sql
-- 非相关子查询：只执行一次
SELECT * FROM products
WHERE price > (SELECT AVG(price) FROM products);

-- 相关子查询：每行执行一次
SELECT * FROM orders o
WHERE amount > (SELECT AVG(amount) FROM orders WHERE user_id = o.user_id);
```

---

## EXISTS 与 NOT EXISTS

EXISTS 检查子查询是否有返回行——不在乎返回什么，只在乎有没有。

```sql
-- 查有订单的用户（至少下过一个订单）
SELECT * FROM users u
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.user_id = u.id
);

-- EXISTS vs IN：功能等价但效率不同
SELECT * FROM users
WHERE id IN (SELECT user_id FROM orders);

SELECT * FROM users u
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);

-- NOT EXISTS：查从未下过订单的用户
SELECT * FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.user_id = u.id
);
```

### EXISTS 的优化原理

```
IN 的执行：子查询先执行得到全部结果集，再逐行匹配
EXISTS 的执行：找到第一条匹配就停止

对于有索引的连接条件，EXISTS 通常比 IN 更快
```

---

## 行子查询

返回**单行但多列**的子查询：

```sql
-- 查同时满足两个条件的员工（最贵的订单对应的员工）
SELECT *
FROM employees
WHERE (department, salary) = (
    SELECT department, MAX(salary)
    FROM employees
    GROUP BY department
    HAVING department = 'Engineering'
);

-- 多列比较（MySQL 特有）
SELECT * FROM employees
WHERE (dept_id, salary) = (5, 15000);
```

---

## 子查询优化技巧

### 相关子查询改写为 JOIN

```sql
-- 相关子查询（可能慢）
SELECT name, salary, department
FROM employees e
WHERE salary = (
    SELECT MAX(salary) FROM employees 
    WHERE department = e.department
);

-- 改写为 JOIN（通常更快）
SELECT e.name, e.salary, e.department
FROM employees e
JOIN (
    SELECT department, MAX(salary) AS max_sal
    FROM employees
    GROUP BY department
) m ON e.department = m.department AND e.salary = m.max_sal;
```

### 用窗口函数替代相关子查询

```sql
-- 相关子查询：查每个部门薪资最高的员工
SELECT name, department, salary
FROM employees e
WHERE salary = (
    SELECT MAX(salary) FROM employees 
    WHERE department = e.department
);

-- 窗口函数改写（更清晰、更快）
SELECT name, department, salary
FROM (
    SELECT name, department, salary,
           MAX(salary) OVER (PARTITION BY department) AS max_sal
    FROM employees
) ranked
WHERE salary = max_sal;
```

### 子查询位置优化

```sql
-- 子查询在 SELECT 后（每行都要计算）
SELECT 
    name,
    (SELECT SUM(amount) FROM orders WHERE user_id = u.id) AS total_spent
FROM users u;

-- 子查询在 FROM 后（只执行一次）
SELECT name, total_spent
FROM users u
JOIN (
    SELECT user_id, SUM(amount) AS total_spent
    FROM orders
    GROUP BY user_id
) o ON u.id = o.user_id;
```

---

## 常见错误

### 子查询返回多行

```sql
-- 错误：子查询返回多行，但用了等值比较
SELECT * FROM employees
WHERE department = (
    SELECT department FROM employees GROUP BY department HAVING COUNT(*) > 3
);
-- ERROR: Subquery returns more than 1 row

-- 解决方案：改用 IN
SELECT * FROM employees
WHERE department IN (
    SELECT department FROM employees GROUP BY department HAVING COUNT(*) > 3
);
```

### NULL 的陷阱

```sql
-- NOT IN 中包含 NULL 的结果永远是空
SELECT * FROM users
WHERE id NOT IN (SELECT user_id FROM orders);  -- 如果 orders.user_id 允许 NULL
-- 子查询结果：[1, 2, NULL]
-- id NOT IN (1, 2, NULL) 永远为 FALSE

-- 解决方案：用 NOT EXISTS
SELECT * FROM users u
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);
```

---

## 小结

| 子查询类型 | 返回 | 常用运算符 |
|---------|-----|---------|
| 标量子查询 | 单值 | =, >, <, >=, <= |
| 列子查询 | 单列多行 | IN, NOT IN, ANY, ALL |
| 行子查询 | 单行多列 | =, <>, IN |
| 表子查询 | 多行多列 | FROM 子句 |

| 优化策略 | 说明 |
|---------|-----|
| 相关子查询 → JOIN | 相关子查询执行 N 次，JOIN 只执行一次 |
| 子查询 → 窗口函数 | 窗口函数替代 GROUP BY + 相关子查询 |
| SELECT 子查询 → FROM 子查询 | FROM 后只执行一次 |

> 记住：**子查询的核心价值是"先过滤再关联"或"先聚合再关联"**。能用 JOIN 或窗口函数替代的子查询，通常性能更好。

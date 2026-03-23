# 多行子查询与相关子查询

这一节深入讲解多行子查询（IN/ANY/ALL）以及相关子查询的优化策略。

---

## 多行子查询

子查询返回**多行数据**时，需要使用特殊运算符：IN、NOT IN、ANY、ALL。

### IN 与 NOT IN

```sql
-- IN：值在子查询结果中
SELECT * FROM products
WHERE category_id IN (
    SELECT id FROM categories WHERE name IN ('Electronics', 'Books')
);

-- NOT IN：值不在子查询结果中
SELECT * FROM users
WHERE id NOT IN (
    SELECT user_id FROM orders WHERE status = 'pending'
);
```

### ANY（SOME）和 ALL

| 运算符 | 含义 |
|-------|------|
| `= ANY` | 等于子查询结果的任意一个（等价于 IN） |
| `> ANY` | 大于子查询结果的最小值 |
| `< ANY` | 小于子查询结果的最大值 |
| `> ALL` | 大于子查询结果的最大值 |
| `< ALL` | 小于子查询结果的最小值 |

```sql
-- = ANY 等价于 IN
SELECT * FROM employees
WHERE salary = ANY (
    SELECT salary FROM employees WHERE department = 'Sales'
);
-- 等价于：
SELECT * FROM employees
WHERE salary IN (
    SELECT salary FROM employees WHERE department = 'Sales'
);

-- > ANY：查薪资大于工程部任意一个员工的（非工程部）员工
SELECT name, salary, department
FROM employees
WHERE department != 'Engineering'
  AND salary > ANY (
      SELECT salary FROM employees WHERE department = 'Engineering'
  );

-- > ALL：查薪资大于工程部所有员工的（非工程部）员工（比工程部最高薪还高）
SELECT name, salary, department
FROM employees
WHERE department != 'Engineering'
  AND salary > ALL (
      SELECT salary FROM employees WHERE department = 'Engineering'
  );
```

---

## 相关子查询详解

相关子查询（Correlated Subquery）的特点是**子查询引用了外层查询的列**，每行都要重新执行一次。

### 典型场景

```sql
-- 场景一：查每个分类中价格高于该分类平均价的商品
SELECT p.name, p.category_id, p.price
FROM products p
WHERE price > (
    SELECT AVG(price) FROM products 
    WHERE category_id = p.category_id
);

-- 场景二：查每个用户的订单总额
SELECT u.name,
    (SELECT SUM(amount) FROM orders WHERE user_id = u.id) AS total_spent
FROM users u;

-- 场景三：查比同类商品销量高的商品
SELECT p1.name, p1.category_id, p1.sales_count
FROM products p1
WHERE sales_count > (
    SELECT AVG(sales_count) FROM products p2
    WHERE p2.category_id = p1.category_id
);
```

### 相关子查询的执行代价

相关子查询的执行次数 = 外层查询的行数。

| 场景 | 外层行数 | 子查询执行次数 |
|-----|---------|------------|
| 员工表（1000 行） | 1000 | 1000 次 |
| 订单表（100 万行） | 100 万 | 100 万次 |

**优化策略**：将相关子查询改写为 JOIN 或窗口函数。

---

## 相关子查询优化

### 策略一：改写为 JOIN

```sql
-- 相关子查询
SELECT name, department, salary
FROM employees e
WHERE salary > (
    SELECT AVG(salary) FROM employees WHERE department = e.department
);

-- JOIN 改写
SELECT e.name, e.department, e.salary
FROM employees e
JOIN (
    SELECT department, AVG(salary) AS avg_sal
    FROM employees
    GROUP BY department
) dept_avg ON e.department = dept_avg.department
WHERE e.salary > dept_avg.avg_sal;
```

### 策略二：用窗口函数（推荐）

```sql
-- 窗口函数替代 GROUP BY + 相关子查询
SELECT name, department, salary
FROM (
    SELECT name, department, salary,
           AVG(salary) OVER (PARTITION BY department) AS dept_avg_salary
    FROM employees
) ranked
WHERE salary > dept_avg_salary;
```

### 策略三：用 EXISTS 替代 IN

```sql
-- 优化前：IN 子查询可能返回大量数据
SELECT * FROM orders
WHERE user_id IN (
    SELECT user_id FROM users WHERE status = 'vip'
);

-- 优化后：EXISTS 找到一条就停止
SELECT * FROM orders o
WHERE EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = o.user_id AND u.status = 'vip'
);
```

---

## ALL 和 ANY 的效率问题

```sql
-- ALL 需要比较所有子查询结果，性能较差
SELECT * FROM products
WHERE price > ALL (
    SELECT price FROM products WHERE category = 'Electronics'
);
-- 等价于：price > MAX(子查询结果)

-- 优化：用聚合函数替代
SELECT * FROM products
WHERE price > (
    SELECT MAX(price) FROM products WHERE category = 'Electronics'
);
```

---

## 综合案例

### 案例一：查询购买过所有品类商品的用户

```sql
-- 经典难题：除以用户购买的品类数 = 总品类数
SELECT u.id, u.name
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM categories c
    WHERE NOT EXISTS (
        SELECT 1 FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.user_id = u.id AND oi.category_id = c.id
    )
);
```

### 案例二：查各部门薪资排名 Top 3

```sql
-- 相关子查询版本
SELECT name, department, salary
FROM employees e1
WHERE (
    SELECT COUNT(*) FROM employees e2
    WHERE e2.department = e1.department
      AND e2.salary > e1.salary
) < 3
ORDER BY department, salary DESC;

-- 窗口函数版本（更清晰、更快）
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

### 案例三：查没有下过任何"高价值订单"的用户

```sql
-- 什么是高价值订单：金额 > 5000
-- 没有下过高价值订单的用户

SELECT u.*
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM orders o
    WHERE o.user_id = u.id AND o.amount > 5000
);

-- 等价于 NOT IN（注意 NULL 陷阱）
SELECT u.*
FROM users u
WHERE u.id NOT IN (
    SELECT o.user_id FROM orders o WHERE o.amount > 5000
    -- 如果子查询可能返回 NULL，用 NOT EXISTS 更安全
);
```

---

## 子查询最佳实践

| 场景 | 推荐写法 |
|-----|---------|
| 子查询返回单值 | 直接比较：`<`, `>`, `=`, `<>` |
| 子查询返回多行 | IN / NOT IN（行数少时） |
| 子查询需判断有无 | EXISTS / NOT EXISTS（行数多时） |
| 相关子查询 | 改写为 JOIN 或窗口函数 |
| 子查询在 SELECT 后 | 尽量移到 FROM 后（只执行一次） |

> 记住：**能用 JOIN 或窗口函数替代的子查询，通常性能更好**。子查询的好处是逻辑清晰，但性能敏感场景优先考虑改写。

---

## 小结

多行子查询的关键运算符：

| 运算符 | 含义 | 性能 |
|-------|------|-----|
| `IN` | 值在结果集中 | 子查询结果集小时快 |
| `NOT IN` | 值不在结果集中 | 注意 NULL 陷阱 |
| `EXISTS` | 子查询有结果 | 找到一条就停止 |
| `ANY (= SOME)` | 等于任意一个 | 等价于 IN |
| `> ANY` | 大于最小值 | 等价于 > MIN() |
| `> ALL` | 大于最大值 | 等价于 > MAX() |

相关子查询优化优先级：**窗口函数 > JOIN > EXISTS > 相关子查询 > IN**。

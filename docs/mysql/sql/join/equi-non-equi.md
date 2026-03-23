# 笛卡尔积、等值连接与非等值连接

多表查询是 SQL 的核心技能之一。一切 JOIN 的基础，都是笛卡尔积。

---

## 笛卡尔积（Cartesian Product）

笛卡尔积 = 左表的每一行 × 右表的每一行。

```sql
-- 两张表做笛卡尔积
SELECT COUNT(*) FROM orders;      -- 1000 行
SELECT COUNT(*) FROM products;  -- 100 行

-- 笛卡尔积结果
SELECT COUNT(*) FROM orders, products;  -- 100000 行（1000 × 100）
```

**为什么是灾难**：

```
orders 表 1000 行 × products 表 100 行
= 100000 行
= 1000 次全表扫描 orders
= 100 次全表扫描 products
= 灾难性的性能
```

---

## 等值连接（Equi-Join）

在笛卡尔积基础上，用 ON 条件过滤，只保留匹配的行。

```sql
-- 订单表和用户表等值连接
SELECT 
    o.id AS order_id,
    o.amount,
    u.name AS customer_name,
    u.email
FROM orders o
JOIN users u ON o.user_id = u.id;
--                                        ↑
--                                    等值条件
```

执行过程：

```
orders 表：id, user_id, amount
users 表：id, name, email

笛卡尔积 → 按 o.user_id = u.id 过滤 → 只保留匹配的行
```

### 多表等值连接

```sql
-- 三表连接：订单 + 用户 + 商品
SELECT 
    o.id AS order_id,
    u.name AS customer,
    p.name AS product,
    oi.quantity,
    oi.price
FROM orders o
JOIN users u ON o.user_id = u.id
JOIN order_items oi ON o.id = oi.order_id
JOIN products p ON oi.product_id = p.id;
```

---

## 非等值连接（Non-Equi-Join）

连接条件不是等值，而是范围或其他比较。

```sql
-- 场景：根据消费金额划分会员等级
SELECT 
    u.name,
    u.total_consumption,
    v.level_name
FROM users u
JOIN vip_levels v ON u.total_consumption BETWEEN v.min_amount AND v.max_amount;
--                         ↑
--                    非等值条件（BETWEEN）
```

### 典型场景：区间匹配

```sql
-- 订单表和运费规则表
CREATE TABLE shipping_rules (
    id INT PRIMARY KEY,
    min_weight DECIMAL(10,2),
    max_weight DECIMAL(10,2),
    shipping_fee DECIMAL(10,2)
);

-- 根据订单总重量匹配运费
SELECT 
    o.order_id,
    o.total_weight,
    s.shipping_fee
FROM orders o
JOIN shipping_rules s 
    ON o.total_weight BETWEEN s.min_weight AND s.max_weight;
```

---

## 自连接（Self-Join）

表与自身连接，用于层级结构。

```sql
-- 员工表：每个员工有上级经理
SELECT 
    e.name AS employee,
    m.name AS manager
FROM employees e
JOIN employees m ON e.manager_id = m.id;
--                ↑              ↑
--            员工表           经理表（同一张表）
```

### 自连接的典型应用

```sql
-- 查找与 "Tom" 同部门的其他员工
SELECT DISTINCT e2.name
FROM employees e1
JOIN employees e2 ON e1.department_id = e2.department_id
WHERE e1.name = 'Tom' 
  AND e2.name != 'Tom';

-- 查找每个员工及其上级的上级（两级）
SELECT 
    e.name AS employee,
    m1.name AS manager,
    m2.name AS grand_manager
FROM employees e
LEFT JOIN employees m1 ON e.manager_id = m1.id
LEFT JOIN employees m2 ON m1.manager_id = m2.id;
```

---

## 连接条件的 ON vs WHERE

| 位置 | 作用 |
|-----|------|
| ON | 连接条件，在连接阶段过滤 |
| WHERE | 过滤条件，在连接后过滤 |

```sql
-- 两种写法的区别
-- 写法一：ON 条件过滤
SELECT o.*, u.name
FROM orders o
LEFT JOIN users u ON o.user_id = u.id AND u.status = 'active';

-- 写法二：WHERE 条件过滤
SELECT o.*, u.name
FROM orders o
LEFT JOIN users u ON o.user_id = u.id
WHERE u.status = 'active';
```

**关键区别**：

```
写法一（ON）：即使 users 没有匹配（u.status 不存在），也会返回左表全部行
写法二（WHERE）：LEFT JOIN 后再过滤，右表不匹配的行会被过滤掉
```

**总结**：

- 内连接（INNER JOIN）：ON 和 WHERE 效果相同
- 外连接（LEFT/RIGHT JOIN）：ON 决定连接结果，WHERE 决定最终过滤

---

## 小结

| 连接类型 | 特点 | 典型场景 |
|---------|------|---------|
| 笛卡尔积 | 无条件 ×，行数相乘 | 应该避免（除非有特定需求） |
| 等值连接 | ON 使用 = | 最常见（主外键关联） |
| 非等值连接 | ON 使用 > < BETWEEN | 区间匹配、分段统计 |
| 自连接 | 表与自身 | 层级结构（员工-经理） |

> 记住：JOIN 的本质是**笛卡尔积 + 过滤**。所有 JOIN 都是等值连接的特例（只有非等值连接的过滤条件不是 `=`）。

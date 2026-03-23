# 比较运算符

比较运算符用于条件判断，返回 TRUE/FALSE/UNKNOWN，是 WHERE 子句的核心。

---

## 比较运算符一览

| 运算符 | 说明 | 示例 |
|-------|------|-----|
| `=` | 等于 | `status = 'paid'` |
| `<>` 或 `!=` | 不等于 | `status <> 'cancelled'` |
| `>` | 大于 | `amount > 1000` |
| `<` | 小于 | `amount < 1000` |
| `>=` | 大于等于 | `amount >= 1000` |
| `<=` | 小于等于 | `amount <= 1000` |
| `<=>` | 安全等于（可比较 NULL） | `name <=> NULL` |

---

## 基本用法

```sql
-- 等于
SELECT * FROM orders WHERE status = 'paid';

-- 不等于
SELECT * FROM products WHERE category <> 'electronics';

-- 数值比较
SELECT * FROM employees WHERE salary >= 8000;

-- 日期比较
SELECT * FROM orders WHERE created_at >= '2024-01-01';
```

---

## 安全等于：`<=>`

这是 MySQL 特有的运算符，最大的特点是**可以比较 NULL**。

```sql
-- 普通等号：NULL = NULL 结果是 UNKNOWN（不返回）
SELECT * FROM users WHERE phone = NULL;   -- 不返回任何行！

-- 安全等于：NULL <=> NULL 结果是 TRUE
SELECT * FROM users WHERE phone <=> NULL;  -- 返回 phone 为 NULL 的行
```

| 比较 | `=` | `<=>` |
|-----|-----|-------|
| `NULL = NULL` | UNKNOWN | TRUE |
| `1 = NULL` | UNKNOWN | FALSE |
| `'Tom' = 'Tom'` | TRUE | TRUE |
| `'Tom' = 'Amy'` | FALSE | FALSE |

---

## 字符串比较

MySQL 的字符串比较默认**不区分大小写**（取决于字符集）：

```sql
-- 默认不区分大小写
SELECT 'ABC' = 'abc';  -- TRUE

-- 区分大小写：用 BINARY 关键字
SELECT BINARY 'ABC' = 'abc';  -- FALSE
SELECT 'ABC' = 'abc' COLLATE utf8mb4_bin;  -- FALSE
```

---

## 非数值比较

```sql
-- 日期比较
SELECT * FROM orders 
WHERE created_at > '2024-01-01';

-- DATETIME 比较
SELECT * FROM orders 
WHERE created_at > '2024-01-01 10:30:00';

-- 时间戳比较
SELECT * FROM orders 
WHERE UNIX_TIMESTAMP(created_at) > UNIX_TIMESTAMP('2024-01-01');
```

---

## BETWEEN ... AND

```sql
-- 查询 5000~10000 薪资的员工
SELECT * FROM employees WHERE salary BETWEEN 5000 AND 10000;
-- 等价于：
SELECT * FROM employees WHERE salary >= 5000 AND salary <= 10000;
```

**BETWEEN 是包含边界的**：`salary BETWEEN 5000 AND 10000` 等于 `5000 <= salary <= 10000`。

---

## IN 和 NOT IN

```sql
-- 查询指定状态的订单
SELECT * FROM orders 
WHERE status IN ('paid', 'shipped', 'completed');

-- NOT IN：排除指定值
SELECT * FROM products 
WHERE category NOT IN ('electronics', 'furniture');

-- 配合子查询
SELECT * FROM orders 
WHERE customer_id IN (
    SELECT id FROM customers WHERE vip_level >= 3
);
```

---

## IS NULL 和 IS NOT NULL

```sql
-- 查询没有邮箱的用户
SELECT * FROM users WHERE email IS NULL;

-- 查询有邮箱的用户
SELECT * FROM users WHERE email IS NOT NULL;
```

> **注意**：`email = NULL` 永远不会返回任何行！NULL 比较必须用 `IS NULL`。

---

## 典型应用

```sql
-- 查询超过 30 天未付款的订单
SELECT * FROM orders 
WHERE status = 'pending'
  AND DATEDIFF(NOW(), created_at) > 30;

-- 查询价格合理的商品（100~500 之间）
SELECT * FROM products 
WHERE price BETWEEN 100 AND 500
  AND status = 'active';

-- 查询活跃用户（最近 30 天有登录）
SELECT * FROM users 
WHERE last_login_at >= DATE_SUB(NOW(), INTERVAL 30 DAY);
```

---

## 小结

| 场景 | 推荐写法 |
|-----|---------|
| 普通等值 | `=` |
| NULL 比较 | `<=>` 或 `IS NULL` |
| 范围查询 | `BETWEEN AND` |
| 多值查询 | `IN` / `NOT IN` |
| 日期范围 | `>= date1 AND <= date2` 或 `BETWEEN` |

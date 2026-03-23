# 算术运算符

算术运算符是最基础的运算符，用于数值计算。

---

## 算术运算符一览

| 运算符 | 说明 | 示例 |
|-------|------|-----|
| `+` | 加 | `1 + 2 → 3` |
| `-` | 减 | `5 - 3 → 2` |
| `*` | 乘 | `2 * 3 → 6` |
| `/` | 除（返回浮点数） | `10 / 3 → 3.3333` |
| `DIV` | 整除 | `10 DIV 3 → 3` |
| `%` 或 `MOD` | 取模（余数） | `10 % 3 → 1` |

---

## 基本运算

```sql
-- 基础运算
SELECT 1 + 2, 5 - 3, 2 * 3, 10 / 3;
-- 结果：3, 2, 6, 3.3333

-- 整除用 DIV
SELECT 10 DIV 3, 10 % 3, 10 MOD 3;
-- 结果：3, 1, 1

-- 浮点除法
SELECT 10 / 3, 10 / 4;
-- 结果：3.3333, 2.5000
```

---

## 在列运算中的应用

```sql
-- 查询所有订单，显示折后价（打 9 折）
SELECT order_id, amount, amount * 0.9 AS discounted_amount
FROM orders;

-- 查询员工的年薪
SELECT name, salary * 12 AS annual_salary
FROM employees;

-- 查询订单总价 = 单价 × 数量
SELECT 
    order_id,
    product_id,
    price,
    quantity,
    price * quantity AS total_price
FROM order_items;
```

---

## 运算优先级

算术运算遵循标准优先级：

```
括号 > 乘除 > 加减
```

```sql
SELECT 2 + 3 * 4;        -- 14（先算乘法）
SELECT (2 + 3) * 4;       -- 20（括号优先）
SELECT 10 - 4 / 2;       -- 8（先算除法）
SELECT (10 - 4) / 2;      -- 3（先算减法）
```

---

## NULL 运算

任何与 NULL 的算术运算，结果都是 NULL：

```sql
SELECT 1 + NULL, 2 * NULL, 5 / NULL;
-- 结果：全部为 NULL

-- 实际数据中：
SELECT amount, amount * 1.1 AS with_tax
FROM orders;
-- 如果 amount 为 NULL，结果也是 NULL
```

**解决方案**：使用 `IFNULL` 或 `COALESCE` 处理 NULL：

```sql
SELECT 
    amount, 
    IFNULL(amount, 0) * 1.1 AS with_tax
FROM orders;
-- NULL 会被当作 0 处理
```

---

## 典型应用场景

### 场景一：折扣计算

```sql
-- 原价基础上打 8 折（满 100 减 20）
SELECT 
    product_name,
    original_price,
    original_price * 0.8 AS discounted_price,
    original_price * 0.8 - 20 AS final_price
FROM products
WHERE original_price >= 100;
```

### 场景二：时间差计算

```sql
-- 计算订单从创建到完成的时长（小时）
SELECT 
    order_id,
    created_at,
    finished_at,
    TIMESTAMPDIFF(HOUR, created_at, finished_at) AS duration_hours
FROM orders;

-- 计算用户注册至今的天数
SELECT 
    username,
    registered_at,
    DATEDIFF(NOW(), registered_at) AS days_since_registration
FROM users;
```

---

## 小结

算术运算符注意两点：

- `NULL` 与任何数运算都返回 `NULL`，记得用 `IFNULL` 包裹
- 整数除法默认返回浮点数，用 `DIV` 才能得到整数

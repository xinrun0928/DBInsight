# 排序与分页

ORDER BY 和 LIMIT 是 SQL 查询中最常用的两个子句——一个决定数据展示顺序，一个决定返回多少数据。

---

## ORDER BY：排序

### 单列排序

```sql
-- 按金额升序（默认）
SELECT * FROM orders ORDER BY amount;

-- 按金额降序
SELECT * FROM orders ORDER BY amount DESC;

-- ASC 升序（默认，可以省略）
SELECT * FROM orders ORDER BY amount ASC;
```

升序/降序规则：

| 类型 | ASC（升序） | DESC（降序） |
|-----|-----------|------------|
| 数值 | 1, 2, 3... | 100, 99, 98... |
| 字符串 | A, B, C... | Z, Y, X... |
| 日期 | 最早的先 | 最近的先 |
| NULL | 默认排在最前（ASC）或最后（DESC） | |

### 多列排序

```sql
-- 先按状态排序，状态相同则按金额排序
SELECT * FROM orders 
ORDER BY status, amount DESC;

-- 先按金额降序，金额相同则按创建时间升序
SELECT * FROM orders 
ORDER BY amount DESC, created_at ASC;
```

多列排序的执行顺序：**从左到右**，只有前一列值相同时才会使用后一列排序。

### 表达式排序

```sql
-- 按金额的绝对值排序
SELECT * FROM transactions ORDER BY ABS(amount) DESC;

-- 按日期排序（字符串日期）
SELECT * FROM orders 
ORDER BY STR_TO_DATE(date_str, '%Y-%m-%d') DESC;

-- 按计算结果排序
SELECT 
    product_name, 
    price, 
    stock,
    price / stock AS unit_cost
FROM products
ORDER BY unit_cost ASC;
```

### NULL 值的排序

```sql
-- NULL 值排在最前面（ASC 默认行为）
SELECT * FROM orders ORDER BY paid_at ASC;
-- 结果：NULL, NULL, 2024-01-01, 2024-01-02...

-- NULL 值排在最后面
SELECT * FROM orders ORDER BY paid_at ASC NULLS LAST;

-- MySQL 没有 NULLS LAST，用表达式实现
SELECT * FROM orders 
ORDER BY paid_at IS NULL, paid_at ASC;
-- 先按 IS NULL 排序（FALSE=0 在前，TRUE=1 在后），再按日期排序
```

---

## LIMIT：分页

### 基本用法

```sql
-- 返回前 10 条
SELECT * FROM orders ORDER BY created_at DESC LIMIT 10;

-- 分页：第 1 页（偏移 0）
SELECT * FROM orders ORDER BY id LIMIT 10 OFFSET 0;

-- 分页：第 2 页（偏移 10）
SELECT * FROM orders ORDER BY id LIMIT 10 OFFSET 10;

-- 分页：第 3 页（偏移 20）
SELECT * FROM orders ORDER BY id LIMIT 10 OFFSET 20;
```

### LIMIT 的变体语法

```sql
-- LIMIT offset, count（MySQL 特有，省写 OFFSET 关键字）
SELECT * FROM orders LIMIT 0, 10;   -- 第 1 页
SELECT * FROM orders LIMIT 10, 10;   -- 第 2 页
SELECT * FROM orders LIMIT 20, 10;   -- 第 3 页
```

> **通用标准语法**：`LIMIT count OFFSET offset`
> **MySQL 特有语法**：`LIMIT offset, count`

### TOP N 查询

```sql
-- 查询金额最高的 5 笔订单
SELECT * FROM orders 
ORDER BY amount DESC 
LIMIT 5;

-- 查询每个班级成绩最好的学生
SELECT * FROM students s1
WHERE score = (
    SELECT MAX(score) FROM students s2 
    WHERE s1.class_id = s2.class_id
)
ORDER BY class_id;

-- 查询最新上架的 3 个商品
SELECT * FROM products 
ORDER BY created_at DESC 
LIMIT 3;
```

---

## 综合案例

### 场景一：分页查询订单列表

```sql
-- 第 5 页，每页 20 条
-- 页码从 1 开始，偏移量 = (页码 - 1) × 每页数量
SELECT 
    o.id,
    o.order_no,
    u.name AS customer_name,
    o.amount,
    o.status,
    o.created_at
FROM orders o
JOIN users u ON o.user_id = u.id
WHERE o.status IN ('paid', 'shipped')
ORDER BY o.created_at DESC
LIMIT 20 OFFSET 80;
```

### 场景二：Top N 分析

```sql
-- 查询每种商品类别中销量最高的 3 个商品
SELECT 
    category,
    product_name,
    sales_count
FROM (
    SELECT 
        category,
        product_name,
        sales_count,
        ROW_NUMBER() OVER (
            PARTITION BY category 
            ORDER BY sales_count DESC
        ) AS rank_in_category
    FROM products
) ranked
WHERE rank_in_category <= 3
ORDER BY category, sales_count DESC;
```

### 场景三：随机抽样

```sql
-- 从表中随机抽取 10 条记录
SELECT * FROM orders 
ORDER BY RAND() 
LIMIT 10;
```

> **警告**：`ORDER BY RAND()` 在大表上性能极差（RAND() 对每行计算，然后全表排序）。生产环境避免对大表使用。

---

## ORDER BY 与索引

ORDER BY 的性能取决于是否使用索引：

```sql
-- EXPLAIN 分析
EXPLAIN SELECT * FROM orders ORDER BY created_at DESC LIMIT 10;

-- 好的情况：EXPLAIN 显示 Using index 或 Using filesort（数据量小）
-- 坏的情况：EXPLAIN 显示 Using filesort（大表全表排序）

-- 解决方案：建覆盖索引
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
```

> 如果查询同时有 WHERE 和 ORDER BY，索引需要包含 WHERE 字段作为前缀。

---

## 小结

| 子句 | 作用 | 注意 |
|-----|------|------|
| ORDER BY ASC | 升序（默认） | NULL 默认排在前 |
| ORDER BY DESC | 降序 | NULL 默认排在后 |
| LIMIT n | 返回前 n 条 | 最常用的 Top N |
| LIMIT offset, n | 分页查询 | offset 从 0 开始 |

> 记住：**ORDER BY 和 LIMIT 一起用时，MySQL 会先排序，再取前 n 条**。所以 ORDER BY 决定的是"排序后返回哪些"，不是"返回后怎么排"。

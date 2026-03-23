# 索引失效的 11 种情况

索引失效是 MySQL 性能问题的头号原因。你建了索引，但查询依然跑全表扫描——90% 的情况是踩了索引失效的坑。

---

## 情况一：OR 连接时，任意一边没有索引

```sql
-- 索引：idx_name(name), idx_email(email)
EXPLAIN SELECT * FROM users WHERE name = 'Tom' OR email = 'tom@example.com';
-- type: ALL ⚠️ 全表扫描！

-- 原因：OR 条件要求两边索引都存在才能用
-- 任何一边没有索引，都会导致全表扫描

-- ✅ 改写为 UNION（两个查询各用自己的索引）
EXPLAIN SELECT * FROM users WHERE name = 'Tom'
UNION
SELECT * FROM users WHERE email = 'tom@example.com';
-- type: ref + ref ✅

-- ✅ 或者：两边都建索引
CREATE INDEX idx_name_email ON users(name, email);
```

**原理**：MySQL OR 条件需要合并两个索引的结果集。如果只有一个索引有，另一个没有，优化器宁愿全表扫描，因为走索引反而要回表更多次。

---

## 情况二：WHERE 中对索引列使用了函数或计算

```sql
-- 索引：idx_created_at(created_at)
EXPLAIN SELECT * FROM orders WHERE YEAR(created_at) = 2024;
-- type: ALL ⚠️ 索引失效！

EXPLAIN SELECT * FROM orders WHERE created_at + INTERVAL 1 DAY = '2024-02-01';
-- type: ALL ⚠️ 索引失效！

EXPLAIN SELECT * FROM orders WHERE id + 1 = 100001;
-- type: const ⚠️ 主键索引也失效！

-- ✅ 正确做法：把计算移到常量一侧
EXPLAIN SELECT * FROM orders 
WHERE created_at >= '2024-01-01' 
  AND created_at < '2025-01-01';

-- ✅ YEAR 函数的替代：范围查询
EXPLAIN SELECT * FROM orders 
WHERE created_at >= '2024-01-01' 
  AND created_at < '2025-01-01';
```

**原理**：B+ 树按索引列的原始值排序。如果对列使用了函数，排序规则被破坏，索引无法使用。

---

## 情况三：WHERE 中索引列类型不匹配（隐式转换）

```sql
-- phone 是 VARCHAR(20)，但传入了数字
EXPLAIN SELECT * FROM users WHERE phone = 13800138000;
-- type: ALL ⚠️ 隐式类型转换，索引失效！

-- MySQL 实际执行的是：
-- WHERE CAST(phone AS SIGNED) = 13800138000
-- 函数导致索引不可用

-- ✅ 正确做法：使用字符串字面量
EXPLAIN SELECT * FROM users WHERE phone = '13800138000';
-- type: ref ✅
```

**原理**：MySQL 会把 VARCHAR 列 CAST 成数值类型来比较，这个函数操作破坏了索引。

---

## 情况四：LIKE 模糊查询以通配符开头

```sql
-- 索引：idx_name(name)
EXPLAIN SELECT * FROM users WHERE name LIKE '%om';     -- ❌ 前缀通配符
-- type: ALL ⚠️ 索引失效！

EXPLAIN SELECT * FROM users WHERE name LIKE 'To%';      -- ✅ 后缀可
-- type: range ✅

EXPLAIN SELECT * FROM users WHERE name LIKE 'Tom';      -- ✅ 精确匹配
-- type: ref ✅
```

**原理**：`%om` 意味着可以在"任意位置"匹配，MySQL 无法通过 B+ 树快速定位。

**优化方案**：

```sql
-- 方案一：使用全文索引
CREATE FULLTEXT INDEX ft_name ON users(name);
SELECT * FROM users WHERE MATCH(name) AGAINST('*om*');

-- 方案二：反转字符串存一份
ALTER TABLE users ADD COLUMN name_rev VARCHAR(50);
UPDATE users SET name_rev = REVERSE(name);
CREATE INDEX idx_name_rev ON users(name_rev);
-- 查询时：WHERE name_rev LIKE REVERSE('Tom')

-- 方案三：使用 Elasticsearch（大规模场景）
```

---

## 情况五：复合索引未遵循最左前缀原则

```sql
-- 索引：idx_dept_sal_age(department_id, salary, age)
EXPLAIN SELECT * FROM employees WHERE salary = 8000;       -- ❌ 跳过第一列
-- type: ALL ⚠️

EXPLAIN SELECT * FROM employees WHERE department_id = 5;  -- ✅ 第一列
-- type: ref ✅

EXPLAIN SELECT * FROM employees 
WHERE department_id = 5 AND salary = 8000;                -- ✅ 前两列
-- type: ref ✅

EXPLAIN SELECT * FROM employees 
WHERE department_id = 5 AND salary = 8000 AND age = 30;     -- ✅ 三列全用
-- type: ref ✅

EXPLAIN SELECT * FROM employees 
WHERE department_id = 5 AND age = 30;                       -- ⚠️ 跳过中间列
-- 只用了 department_id，salary 跳过了
```

**原理**：B+ 树的排序是 `(A, B, C)` 三列的字典序。如果跳过 B 直接查 A 和 C，MySQL 可以用 A 的有序性，但 C 的有序性无法利用。

---

## 情况六：WHERE 中使用了 NOT、!=、<>、NOT EXISTS、NOT IN

```sql
-- 索引：idx_status(status)
EXPLAIN SELECT * FROM orders WHERE status != 'paid';       -- ❌ NOT 等值
-- type: range ✅ (技术上 range，但性能很差)
-- rows: 950000 ⚠️ 扫描95%的数据

EXPLAIN SELECT * FROM orders WHERE status <> 'paid';       -- ❌ 同上
-- type: range ⚠️

EXPLAIN SELECT * FROM orders WHERE status NOT IN ('paid');  -- ❌ NOT IN
-- type: range ⚠️

EXPLAIN SELECT * FROM orders WHERE NOT EXISTS (子查询);     -- ❌ NOT EXISTS
-- 性能取决于子查询写法
```

**原理**：NOT 类操作需要找到"不等于"的所有值，B+ 树的优化空间有限。`!=` 和 `<>` 通常走 range 扫描，但扫描范围极大。

**优化方案**：

```sql
-- 方案一：尽量用 IN 替代 NOT IN（已知要排除的值）
EXPLAIN SELECT * FROM orders WHERE status IN ('pending', 'cancelled');

-- 方案二：改写为范围查询
-- 如果 status 只有几个固定值，可以枚举正面值
EXPLAIN SELECT * FROM orders WHERE status = 'pending' OR status = 'cancelled';

-- 方案三：反范式设计，用状态标志位替代 NOT
```

---

## 情况七：IS NULL / IS NOT NULL

```sql
-- 索引：idx_email(email) - 允许 NULL
EXPLAIN SELECT * FROM users WHERE email IS NULL;       -- ⚠️ 不一定用索引
-- type: ref or ALL（取决于 NULL 值比例）

EXPLAIN SELECT * FROM users WHERE email IS NOT NULL;   -- ⚠️ 通常不用索引
-- type: range ⚠️
```

**优化方案**：

```sql
-- 方案一：用 NOT NULL + 默认空字符串替代 NULL
-- 这样查询改为 email = '' 而不是 IS NOT NULL

-- 方案二：给 NOT NULL 查询建独立索引
CREATE INDEX idx_email_not_null ON users((email IS NOT NULL), email);
-- MySQL 8.0+ 支持表达式索引
```

---

## 情况八：范围查询（> < BETWEEN）断链

```sql
-- 索引：idx_dept_sal(department_id, salary)
EXPLAIN SELECT * FROM employees 
WHERE department_id = 5 
  AND salary BETWEEN 5000 AND 8000;
-- type: range ✅ 前缀可正常用

EXPLAIN SELECT * FROM employees 
WHERE department_id IN (5, 6, 7)   -- IN 是多个等值，等同于范围
  AND salary BETWEEN 5000 AND 8000;
-- type: range ✅

EXPLAIN SELECT * FROM employees 
WHERE department_id > 5            -- ⚠️ 范围查询断链
  AND salary BETWEEN 5000 AND 8000;
-- salary 的索引用不上了 ⚠️
```

**原理**：联合索引中，范围条件右边的列无法使用索引。

---

## 情况九：数据量太小（优化器选择全表扫描）

```sql
-- 100 行的小表
EXPLAIN SELECT * FROM config WHERE key = 'max_connections';
-- type: ALL ✅（优化器判断：全表扫描比索引快）
```

**这是正常的**，不是索引失效——MySQL 优化器做出了正确选择。

> **判断方法**：如果大表的 EXPLAIN 也显示 ALL，那才是真正的问题。

---

## 情况十：统计信息不准确

```sql
-- 表数据量很大，但 EXPLAIN rows 预估只有几十行
EXPLAIN SELECT * FROM orders WHERE status = 'paid';
-- rows: 52 ⚠️ 预估严重不准（实际可能是 50 万）

-- 原因：统计信息过期
-- 解决：
ANALYZE TABLE orders;
-- 或：
OPTIMIZE TABLE orders;
```

---

## 情况十一：字符串比较时字符集/排序规则不一致

```sql
-- 表：utf8mb4_general_ci，查询用了 utf8mb4_bin
EXPLAIN SELECT * FROM users WHERE name = 'Tom' COLLATE utf8mb4_bin;
-- 可能无法使用索引（取决于 MySQL 版本）
```

**优化**：保持字符集和排序规则一致。

---

## 索引失效检查清单

写完 SQL 后，逐条检查：

```
□ WHERE 中有没有 OR（检查两边都有索引或改 UNION）
□ WHERE 中有没有对索引列使用函数（改写为范围查询）
□ VARCHAR/INT 类型是否匹配（字符串用引号）
□ LIKE 是否以 % 开头（改用全文索引）
□ 复合索引是否跳过最左列（补全列或建新索引）
□ 是否有 NOT/!= /NOT IN /NOT EXISTS（尽量正向枚举）
□ 是否有 IS NOT NULL（改用 NOT NULL 列设计）
□ 范围查询是否在联合索引中间（拆分为多个查询或复合查询）
□ 数据量是否太小（优化器正常行为）
□ 统计信息是否准确（ANALYZE TABLE）
□ 字符集/排序规则是否一致
```

---

## 小结

11 种索引失效情况，最常踩的是前 5 种：

| 排名 | 场景 | 踩坑频率 |
|-----|------|---------|
| 1 | OR 有一边无索引 | ★★★ |
| 2 | 索引列用函数 | ★★★ |
| 3 | LIKE 前缀通配符 | ★★★ |
| 4 | 不遵循最左前缀 | ★★★ |
| 5 | 隐式类型转换 | ★★ |
| 6~11 | NOT 类、范围断链等 | ★ |

> 记忆口诀：**OR 要两边，函数要避免，LIKE 别前导，最左不能忘。**

---

## 下一步

索引失效是最常见的慢 SQL 原因。接下来看 JOIN、子查询、排序分组有哪些优化技巧。

从 [JOIN 与子查询优化](/database/mysql/optimize/sql/join-subquery) 继续。

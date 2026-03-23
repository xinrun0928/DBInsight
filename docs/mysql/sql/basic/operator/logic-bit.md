# 逻辑运算符与位运算符

逻辑运算符连接多个条件，构建复杂查询逻辑；位运算符在底层操作二进制位，适合权限管理等场景。

---

## 逻辑运算符

MySQL 支持四种逻辑运算符：

| 运算符 | 别名 | 说明 |
|-------|------|------|
| `AND` | `&&` | 逻辑与：两边都为 TRUE 才返回 TRUE |
| `OR` | `\|\|` | 逻辑或：任意一边为 TRUE 就返回 TRUE |
| `NOT` | `!` | 逻辑非：取反 |
| `XOR` | | 逻辑异或：两边不同时返回 TRUE |

---

## AND：逻辑与

```sql
-- 两个条件都必须满足
SELECT * FROM orders 
WHERE status = 'paid' 
  AND amount > 1000;

-- 三个条件都满足
SELECT * FROM employees 
WHERE department = 'Engineering' 
  AND salary >= 8000 
  AND status = 'active';
```

**优先级**：`AND` 的优先级高于 `OR`。

```sql
-- 优先级导致的不同结果
SELECT * FROM orders 
WHERE status = 'paid' AND amount > 1000 OR status = 'cancelled';
-- 解析为：(status='paid' AND amount>1000) OR status='cancelled'

SELECT * FROM orders 
WHERE status = 'paid' AND (amount > 1000 OR status = 'cancelled');
-- 加括号后：status='paid' AND (amount>1000 OR status='cancelled')
```

---

## OR：逻辑或

```sql
-- 任意一个条件满足即可
SELECT * FROM orders 
WHERE status = 'paid' OR status = 'shipped';

-- 配合 AND 使用时注意优先级
SELECT * FROM products 
WHERE category = 'electronics' 
   OR category = 'books' 
   AND price < 50;
-- AND 优先级更高！等价于：
-- category = 'electronics' OR (category = 'books' AND price < 50)

-- 正确写法：
SELECT * FROM products 
WHERE (category = 'electronics' OR category = 'books') 
  AND price < 50;
```

---

## NOT：逻辑非

```sql
-- 取反：排除匹配的行
SELECT * FROM orders WHERE NOT status = 'cancelled';
-- 等价于：
SELECT * FROM orders WHERE status <> 'cancelled';

-- 复杂取反
SELECT * FROM users 
WHERE NOT (status = 'inactive' AND email IS NULL);

-- NOT 与 IN / BETWEEN / NULL
SELECT * FROM orders WHERE status NOT IN ('cancelled', 'refunded');
SELECT * FROM employees WHERE salary NOT BETWEEN 5000 AND 10000;
```

---

## XOR：逻辑异或

```sql
-- 两边不同时返回 TRUE，相同时返回 FALSE
SELECT * FROM orders 
WHERE status = 'paid' XOR amount > 1000;

-- XOR 真值表：
-- TRUE XOR TRUE   → FALSE
-- FALSE XOR FALSE  → FALSE
-- TRUE XOR FALSE  → TRUE
-- FALSE XOR TRUE  → TRUE
```

---

## 短路求值

MySQL 的逻辑运算符支持**短路求值**——如果前半部分已经能确定结果，后半部分不执行。

```sql
-- 实际应用：避免除零
SELECT * FROM orders 
WHERE amount > 0 AND 100 / amount > 10;
-- 如果 amount = 0，第一部分为 FALSE，短路后不计算 100/0，避免除零错误

-- 实际应用：安全地使用可能为 NULL 的值
SELECT * FROM users 
WHERE id = 100 AND (email IS NOT NULL AND email LIKE '%@example.com');
```

---

## 位运算符

位运算符在二进制位级别进行操作，适合权限管理、标志位存储等场景。

| 运算符 | 说明 |
|-------|------|
| `&` | 按位与 |
| `|` | 按位或 |
| `^` | 按位异或 |
| `~` | 按位取反 |
| `<<` | 左移 |
| `>>` | 右移 |

---

## 按位与、或、异或

```sql
-- 十进制数字
-- 5 = 0101（二进制）
-- 3 = 0011（二进制）

SELECT 5 & 3, 5 | 3, 5 ^ 3;
-- 5 & 3 = 0101 & 0011 = 0001 = 1
-- 5 | 3 = 0101 | 0011 = 0111 = 7
-- 5 ^ 3 = 0101 ^ 0011 = 0110 = 6
```

---

## 按位取反与移位

```sql
-- 按位取反
SELECT ~5;
-- 5 = 0000000000000101
-- ~5 = 1111111111111010 = -6（补码表示）

-- 左移：乘以 2^n
SELECT 1 << 3;   -- 1 * 2^3 = 8
SELECT 3 << 2;   -- 3 * 2^2 = 12

-- 右移：除以 2^n（向下取整）
SELECT 8 >> 2;   -- 8 / 2^2 = 2
SELECT 15 >> 3;  -- 15 / 2^3 = 1
```

---

## 典型应用：权限管理

位运算在权限管理中非常高效：

```sql
-- 定义权限标志（用二进制位）
-- 1 = READ, 2 = WRITE, 4 = DELETE, 8 = ADMIN
SET @READ = 1;      -- 0001
SET @WRITE = 2;     -- 0010
SET @DELETE = 4;    -- 0100
SET @ADMIN = 8;     -- 1000

-- 创建一个管理员用户（拥有所有权限）
SET @admin_perms = @READ | @WRITE | @DELETE | @ADMIN;  -- 1111 = 15

-- 检查用户是否有 READ 权限
SELECT @admin_perms & @READ;   -- 1111 & 0001 = 0001 = 1 (TRUE)

-- 检查用户是否有 DELETE 权限
SELECT @admin_perms & @DELETE;  -- 1111 & 0100 = 0100 = 4 (TRUE)

-- 创建一个只读用户
SET @readonly_perms = @READ;  -- 0001

-- 只读用户能 DELETE 吗？
SELECT @readonly_perms & @DELETE;  -- 0001 & 0100 = 0 (FALSE)
```

```sql
-- 实际表设计：权限字段
CREATE TABLE users (
    id INT PRIMARY KEY,
    username VARCHAR(50),
    permissions INT DEFAULT 0  -- 用整数存储权限位
);

-- 插入拥有所有权限的管理员
INSERT INTO users VALUES (1, 'admin', 15);  -- 1|2|4|8=15

-- 插入只读用户
INSERT INTO users VALUES (2, 'viewer', 1);  -- 1

-- 查询所有管理员（拥有 ADMIN 权限）
SELECT * FROM users WHERE permissions & 8 = 8;

-- 查询有删除权限的用户
SELECT * FROM users WHERE permissions & 4 = 4;
```

---

## 小结

逻辑运算符的优先级：

```
NOT > AND > OR
```

位运算符适合权限管理、状态标志等场景，用整数存储多个开关状态，比建多个布尔字段更紧凑。

```sql
-- 实用口诀：
-- AND：两边都要 → 用 BETWEEN / 多条件
-- OR：任意都行 → 用 IN / 并列条件
-- NOT：反着来 → 排除某个值或范围
-- XOR：不一样才行 → 两边条件不能同时满足
```

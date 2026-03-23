# 流程控制函数、加密函数与信息函数

这一节介绍三类在复杂查询中非常有用的函数：流程控制函数改变查询逻辑，加密函数保护数据，信息函数提供元数据。

---

## 流程控制函数

### CASE 表达式

CASE 是 SQL 中最强大的流程控制结构，可以实现 if-else 逻辑。

#### 简单 CASE

```sql
CASE expression
    WHEN value1 THEN result1
    WHEN value2 THEN result2
    ...
    ELSE default_result
END
```

```sql
SELECT 
    name,
    department,
    CASE department
        WHEN 'Engineering' THEN '技术部'
        WHEN 'Sales' THEN '销售部'
        WHEN 'HR' THEN '人力资源部'
        ELSE '其他部门'
    END AS department_cn
FROM employees;
```

#### 搜索 CASE

```sql
CASE 
    WHEN condition1 THEN result1
    WHEN condition2 THEN result2
    ...
    ELSE default_result
END
```

```sql
SELECT 
    name,
    salary,
    CASE 
        WHEN salary >= 20000 THEN '高薪'
        WHEN salary >= 10000 THEN '中薪'
        WHEN salary >= 5000 THEN '普通'
        ELSE '低薪'
    END AS salary_level
FROM employees;
```

#### CASE 在聚合中的应用

这是 CASE 最强大的用法——实现条件聚合（相当于 Excel 的 COUNTIF/SUMIF）。

```sql
-- 统计各部门男女员工数（在一行中同时统计）
SELECT 
    department,
    SUM(CASE WHEN gender = 'M' THEN 1 ELSE 0 END) AS male_count,
    SUM(CASE WHEN gender = 'F' THEN 1 ELSE 0 END) AS female_count,
    COUNT(*) AS total
FROM employees
GROUP BY department;

-- 统计订单状态分布
SELECT 
    SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid_count,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count,
    COUNT(*) AS total_count
FROM orders;

-- 统计复购率（购买>=2次的用户占比）
SELECT 
    COUNT(DISTINCT user_id) AS total_users,
    SUM(CASE WHEN order_count >= 2 THEN 1 ELSE 0 END) AS repeat_users,
    SUM(CASE WHEN order_count >= 2 THEN 1 ELSE 0 END) / COUNT(*) AS repeat_rate
FROM (
    SELECT user_id, COUNT(*) AS order_count
    FROM orders
    GROUP BY user_id
) user_stats;
```

---

## 加密与哈希函数

### 不可逆加密（哈希）

哈希函数将数据转换为固定长度的字符串，**无法反向解密**。

| 函数 | 说明 | 输出长度 |
|-----|------|---------|
| `MD5(str)` | MD5 哈希 | 32 字符 |
| `SHA1(str)` | SHA-1 哈希 | 40 字符 |
| `SHA2(str, hash_length)` | SHA-2 哈希 | 32/64 字符 |
| `PASSWORD(str)` | MySQL 密码哈希（废弃） | |

```sql
-- MD5：常用但已不安全
SELECT MD5('hello');  -- 5d41402abc4b2a76b9719d911017c592

-- SHA-256：推荐使用
SELECT SHA2('hello', 256);  -- 2cf24dba5fb0a30e26e83b2ac5b9e854e9b76a1f0e...
SELECT SHA2('hello', 384);  -- SHA-384
SELECT SHA2('hello', 512);  -- SHA-512

-- 实际应用：密码存储
-- 注意：生产环境不要只用 MD5/SHA，要加盐（salt）
SELECT 
    username,
    MD5(CONCAT(salt, password)) AS hashed_password
FROM users;
```

### 可逆加密

| 函数 | 说明 |
|-----|------|
| `ENCODE(str, password)` | 加密（可解密，弱加密） |
| `DECODE(str, password)` | 解密 |
| `AES_ENCRYPT(str, key)` | AES 加密（推荐） |
| `AES_DECRYPT(str, key)` | AES 解密（推荐） |

```sql
-- AES 加密（推荐用于敏感数据）
SELECT AES_ENCRYPT('secret data', 'encryption_key');
SELECT AES_DECRYPT(encrypted_data, 'encryption_key');
```

> **警告**：`ENCODE/DECODE` 是可逆的弱加密，仅适合不真正敏感的数据。AES 是生产环境推荐。

---

## 信息函数

### 连接与进程信息

```sql
-- 当前 MySQL 版本
SELECT VERSION();

-- 当前数据库
SELECT DATABASE();
SELECT SCHEMA();

-- 当前用户
SELECT USER();          -- 连接用户
SELECT CURRENT_USER();   -- 认证用户
SELECT SYSTEM_USER();

-- 连接 ID（每个 MySQL 连接的唯一标识）
SELECT CONNECTION_ID();

-- 最后插入的自增 ID
INSERT INTO orders (...) VALUES (...);
SELECT LAST_INSERT_ID();  -- 获取刚插入的订单 ID
```

### 查询影响行数

```sql
-- ROW_COUNT()：返回上一条 DML 语句影响的行数
UPDATE orders SET status = 'cancelled' WHERE id = 100;
SELECT ROW_COUNT();  -- 返回 1（影响了1行）或 0（没找到）

-- 在存储过程中判断是否更新成功
DELIMITER $$
CREATE PROCEDURE cancel_order(IN order_id INT)
BEGIN
    UPDATE orders SET status = 'cancelled' WHERE id = order_id;
    IF ROW_COUNT() > 0 THEN
        SELECT '订单已取消' AS message;
    ELSE
        SELECT '订单不存在' AS message;
    END IF;
END$$
DELIMITER ;
```

### 格式化与显示

```sql
-- 格式化数字
SELECT FORMAT(1234567.89, 2);  -- '1,234,567.89'

-- 格式化文件大小（字节转人类可读）
SELECT FORMAT(bytes, 0) AS size_bytes FROM files;

-- IP 地址转换
SELECT INET_ATON('192.168.1.100');    -- 字符串 → 整数
SELECT INET_NTOA(3232235876);          -- 整数 → 字符串

-- 查询客户端 IP（在连接层）
SELECT USER(), CURRENT_USER();
```

### 注释函数

```sql
-- VERSION COMMENT（MySQL 特有）
SELECT 1 AS one;  -- one 为列别名
SELECT 1 AS `column-name`;  -- 用反引号包裹带空格的别名
```

---

## 组合查询函数

### EXISTS：检查子查询是否有结果

```sql
-- 查有订单的用户
SELECT * FROM users u
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.user_id = u.id
);

-- EXISTS vs IN：EXISTS 通常更快（子查询找到一条就停止）
-- IN 需要扫描子查询全部结果
```

### GREATEST / LEAST：取最大/最小值

```sql
SELECT GREATEST(3, 1, 5, 2);  -- 5
SELECT LEAST(3, 1, 5, 2);     -- 1

-- 实际应用：计算超额扣款
SELECT 
    order_no,
    actual_price,
    payment_amount,
    LEAST(actual_price - payment_amount, 0) AS overpayment
FROM orders;
```

### INTERVAL：查找插入位置

```sql
-- INTERVAL(N, N1, N2, N3, ...)：返回 N 在序列中的位置（0-based）
SELECT INTERVAL(5, 1, 3, 5, 7);  -- 2（N=5 在 [1,3,5,7] 中排在第3位）
SELECT INTERVAL(5, 1, 3, 7, 10);  -- 2（N=5 在 [1,3,7,10] 中排在第3位）
SELECT INTERVAL(5, 1, 3, 4);       -- 2（N=5 大于所有值，返回末尾位置）
```

---

## 小结

| 函数类型 | 常用函数 | 使用场景 |
|---------|---------|---------|
| 流程控制 | CASE, IF, IFNULL | 条件映射、条件聚合 |
| 加密哈希 | MD5, SHA2, AES_ENCRYPT | 密码存储、数据加密 |
| 信息函数 | VERSION, DATABASE, USER | 诊断、审计 |
| 进程控制 | ROW_COUNT, LAST_INSERT_ID | 存储过程、批量操作 |
| 辅助函数 | GREATEST, LEAST, INTERVAL | 极值计算、位置查找 |

> 记住：**CASE 是 SQL 中的 if-else**，用它可以实现任何条件逻辑，尤其是在 GROUP BY 中实现条件聚合——这是数据分析中最常用的技巧之一。

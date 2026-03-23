# 单行函数

单行函数是 SQL 中最常用的函数类型——每输入一行，返回一行结果。它们在 SELECT、WHERE、ORDER BY 中无处不在。

---

## 数值函数

### 常用数值函数

| 函数 | 说明 | 示例 |
|-----|------|-----|
| `ABS(x)` | 绝对值 | `ABS(-10) → 10` |
| `CEIL(x)` | 向上取整 | `CEIL(3.14) → 4` |
| `FLOOR(x)` | 向下取整 | `FLOOR(3.14) → 3` |
| `ROUND(x, d)` | 四舍五入 | `ROUND(3.14159, 2) → 3.14` |
| `TRUNCATE(x, d)` | 截断 | `TRUNCATE(3.14159, 2) → 3.14` |
| `MOD(a, b)` | 取模 | `MOD(10, 3) → 1` |
| `POW(x, y)` / `POWER(x, y)` | 幂运算 | `POW(2, 3) → 8` |
| `SQRT(x)` | 平方根 | `SQRT(16) → 4` |
| `RAND()` | 0~1 随机数 | `RAND() → 0.718...` |

### 实际应用

```sql
-- 查询折扣后价格，保留2位小数
SELECT 
    product_name,
    original_price,
    TRUNCATE(original_price * 0.85, 2) AS discounted_price
FROM products;

-- 查询金额的绝对值（处理可能的负数）
SELECT ABS(amount) AS abs_amount FROM transactions;

-- 查询四舍五入到整数
SELECT CEIL(avg_rating) AS rating FROM products;
```

---

## 字符串函数

### 常用字符串函数

| 函数 | 说明 | 示例 |
|-----|------|-----|
| `CONCAT(s1, s2, ...)` | 拼接字符串 | `CONCAT('Tom', ' ', 'Jerry') → 'Tom Jerry'` |
| `CONCAT_WS(sep, s1, ...)` | 用分隔符拼接 | `CONCAT_WS('-', '2024', '01', '15') → '2024-01-15'` |
| `LENGTH(s)` | 字节长度 | `LENGTH('中文') → 6` |
| `CHAR_LENGTH(s)` / `LENGTH(s)` (字符) | 字符长度 | `CHAR_LENGTH('中文') → 2` |
| `UPPER(s)` | 转大写 | `UPPER('tom') → 'TOM'` |
| `LOWER(s)` | 转小写 | `LOWER('TOM') → 'tom'` |
| `TRIM(s)` | 去除首尾空格 | `TRIM('  hello  ') → 'hello'` |
| `LTRIM(s)` / `RTRIM(s)` | 去除左/右空格 | |
| `SUBSTRING(s, pos, len)` | 截取子串 | `SUBSTRING('Hello', 2, 3) → 'ell'` |
| `LEFT(s, n)` / `RIGHT(s, n)` | 取左/右 n 个字符 | `LEFT('Hello', 2) → 'He'` |
| `LPAD(s, n, pad)` / `RPAD(s, n, pad)` | 填充 | `LPAD('5', 3, '0') → '005'` |
| `REPLACE(s, old, new)` | 替换 | `REPLACE('Hello', 'l', 'x') → 'Hexxo'` |
| `REVERSE(s)` | 反转 | `REVERSE('abc') → 'cba'` |
| `LOCATE(sub, s)` / `INSTR(s, sub)` | 查找子串位置 | `LOCATE('ell', 'Hello') → 2` |
| `ELT(n, s1, s2, ...)` | 返回第 n 个字符串 | `ELT(2, 'a', 'b', 'c') → 'b'` |

### 实际应用

```sql
-- 拼接姓名
SELECT CONCAT(first_name, ' ', last_name) AS full_name FROM users;

-- 隐藏手机号中间4位
SELECT CONCAT(
    LEFT(phone, 3), 
    '****', 
    RIGHT(phone, 4)
) AS masked_phone FROM users;

-- 日期格式化（拼接年月日）
SELECT CONCAT_WS('-', year, LPAD(month, 2, '0'), LPAD(day, 2, '0')) AS date_str
FROM calendar;

-- 提取邮箱域名
SELECT SUBSTRING_INDEX(email, '@', -1) AS email_domain FROM users;

-- 统一大小写后去重
SELECT DISTINCT LOWER(email) AS normalized_email FROM users;
```

---

## 日期时间函数

### 获取日期时间

| 函数 | 说明 | 示例 |
|-----|------|-----|
| `NOW()` | 当前日期时间 | `2024-01-15 10:30:00` |
| `CURDATE()` / `CURRENT_DATE()` | 当前日期 | `2024-01-15` |
| `CURTIME()` / `CURRENT_TIME()` | 当前时间 | `10:30:00` |
| `UTC_DATE()` | UTC 日期 | |
| `UTC_TIME()` | UTC 时间 | |
| `YEAR(date)` | 年 | `YEAR(NOW()) → 2024` |
| `MONTH(date)` | 月 | `MONTH(NOW()) → 1` |
| `DAY(date)` / `DAYOFMONTH(date)` | 日 | `DAY(NOW()) → 15` |
| `HOUR(time)` | 时 | `HOUR(NOW()) → 10` |
| `MINUTE(time)` | 分 | `MINUTE(NOW()) → 30` |
| `SECOND(time)` | 秒 | `SECOND(NOW()) → 45` |
| `DAYNAME(date)` | 星期几名称 | `DAYNAME(NOW()) → 'Monday'` |
| `DAYOFWEEK(date)` | 星期几（1=周日） | `DAYOFWEEK(NOW()) → 2` |
| `DAYOFYEAR(date)` | 一年中第几天 | `DAYOFYEAR(NOW()) → 15` |

### 日期计算

| 函数 | 说明 | 示例 |
|-----|------|-----|
| `DATE_ADD(date, INTERVAL expr type)` | 日期加 | `DATE_ADD(NOW(), INTERVAL 1 DAY)` |
| `DATE_SUB(date, INTERVAL expr type)` | 日期减 | `DATE_SUB(NOW(), INTERVAL 30 DAY)` |
| `DATEDIFF(date1, date2)` | 日期差（天） | `DATEDIFF(NOW(), created_at)` |
| `TIMEDIFF(time1, time2)` | 时间差 | `TIMEDIFF(NOW(), login_at)` |
| `TIMESTAMPDIFF(unit, date1, date2)` | 时间差（指定单位） | `TIMESTAMPDIFF(HOUR, t1, t2)` |
| `DATE_FORMAT(date, format)` | 格式化 | `DATE_FORMAT(NOW(), '%Y-%m-%d')` |
| `STR_TO_DATE(str, format)` | 字符串转日期 | `STR_TO_DATE('2024-01-15', '%Y-%m-%d')` |
| `DATE(date)` | 提取日期部分 | `DATE(NOW())` |
| `TIME(date)` | 提取时间部分 | `TIME(NOW())` |
| `ADDDATE()` / `SUBDATE()` | 同 DATE_ADD/DATE_SUB | |

### 常用日期格式化符号

| 符号 | 说明 |
|-----|------|
| `%Y` | 四位年份（如 2024） |
| `%y` | 两位年份（如 24） |
| `%m` | 月（01~12） |
| `%c` | 月（1~12） |
| `%d` | 日（01~31） |
| `%e` | 日（1~31） |
| `%H` | 小时（00~23） |
| `%i` | 分钟（00~59） |
| `%s` | 秒（00~59） |
| `%W` | 星期名称（Sunday...） |
| `%p` | AM/PM |

### 实际应用

```sql
-- 查询最近7天登录的用户
SELECT * FROM users 
WHERE last_login >= DATE_SUB(CURDATE(), INTERVAL 7 DAY);

-- 查询订单创建至今的天数
SELECT 
    order_no,
    DATEDIFF(CURDATE(), created_at) AS days_since_creation
FROM orders;

-- 格式化日期为中文格式
SELECT DATE_FORMAT(created_at, '%Y年%m月%d日 %H:%i:%s') AS cn_date
FROM orders;

-- 查询每个月的新增用户数
SELECT 
    DATE_FORMAT(created_at, '%Y-%m') AS month,
    COUNT(*) AS new_users
FROM users
GROUP BY month
ORDER BY month;
```

---

## 条件函数

### IF 函数

```sql
-- IF(condition, value_if_true, value_if_false)
SELECT 
    name,
    salary,
    IF(salary > 8000, '高薪', '普通') AS salary_level
FROM employees;

-- 嵌套 IF
SELECT 
    score,
    IF(score >= 90, 'A',
       IF(score >= 80, 'B',
          IF(score >= 60, 'C', 'D'))) AS grade
FROM exam_results;
```

### IFNULL 函数

```sql
-- IFNULL(value, default_value)：如果为 NULL，返回默认值
SELECT 
    name,
    IFNULL(nickname, name) AS display_name  -- nickname 为 NULL 时显示 name
FROM users;
```

### NULLIF 函数

```sql
-- NULLIF(expr1, expr2)：如果相等返回 NULL，否则返回 expr1
SELECT NULLIF(1, 1);   -- NULL
SELECT NULLIF(1, 2);   -- 1
-- 实际应用：避免除零
SELECT amount / NULLIF(count, 0) FROM stats;
-- count=0 时，NULLIF(0,0)=NULL，整个表达式返回 NULL 而非 ERROR
```

### COALESCE 函数

```sql
-- COALESCE(v1, v2, v3, ...)：返回第一个非 NULL 值
SELECT 
    name,
    COALESCE(nickname, alias, email, '未知') AS display_name
FROM users;
-- 依次检查 nickname、alias、email，返回第一个非 NULL 的值

-- 实际应用：计算总分，缺失分数当 0 处理
SELECT 
    student_name,
    COALESCE(math_score, 0) + COALESCE(english_score, 0) AS total_score
FROM exam_results;
```

---

## 类型转换函数

| 函数 | 说明 | 示例 |
|-----|------|-----|
| `CAST(expr AS type)` | 类型转换 | `CAST('123' AS SIGNED)` |
| `CONVERT(expr, type)` | 类型转换 | `CONVERT(123.456, CHAR)` |
| `BINARY(s)` | 转二进制字符串 | `BINARY 'abc'` |
| `HEX(s)` | 转十六进制 | `HEX('abc') → 616263` |
| `INET_ATON(ip)` | IP 转整数 | `INET_ATON('192.168.1.1')` |
| `INET_NTOA(n)` | 整数转 IP | `INET_NTOA(3232235777)` |

### 实际应用

```sql
-- 将字符串转整数
SELECT CAST('100' AS SIGNED) + 50;  -- 150

-- 将数字转字符串（用于拼接）
SELECT CONCAT('Order #', CAST(order_id AS CHAR)) FROM orders;

-- IP 地址比较（转为整数后比较）
SELECT * FROM access_logs
WHERE INET_ATON(ip) BETWEEN INET_ATON('192.168.1.0') AND INET_ATON('192.168.1.255');
```

---

## 信息函数

| 函数 | 说明 | 示例 |
|-----|------|-----|
| `VERSION()` | MySQL 版本 | `8.0.35` |
| `DATABASE()` | 当前数据库 | `shop` |
| `SCHEMA()` | 同 DATABASE | |
| `USER()` | 当前用户 | `root@localhost` |
| `CURRENT_USER()` | 认证用户 | |
| `CHARSET(str)` | 字符串字符集 | `CHARSET('你好') → utf8mb4` |
| `COLLATION(str)` | 字符串排序规则 | |
| `LAST_INSERT_ID()` | 最后插入的自增 ID | |
| `ROW_COUNT()` | 影响行数 | 用于判断 UPDATE/DELETE 影响的行数 |

### 实际应用

```sql
-- 获取最后插入的 ID
INSERT INTO orders (...) VALUES (...);
SELECT LAST_INSERT_ID();  -- 获取刚插入订单的 ID

-- 检查用户输入的数据类型
SELECT CHARSET(user_input) FROM dual;

-- 在存储过程中判断影响行数
UPDATE users SET last_login = NOW() WHERE id = 100;
SELECT ROW_COUNT();  -- 返回 1（影响1行）或 0（没找到）
```

---

## 小结

单行函数的核心应用场景：

| 场景 | 函数 |
|-----|------|
| 四舍五入/截断 | `ROUND`, `TRUNCATE`, `CEIL`, `FLOOR` |
| 字符串拼接/截取 | `CONCAT`, `SUBSTRING`, `LEFT/RIGHT` |
| 日期计算/格式化 | `DATE_ADD`, `DATEDIFF`, `DATE_FORMAT` |
| 空值处理 | `IFNULL`, `COALESCE`, `NULLIF` |
| 条件判断 | `IF` |
| 类型转换 | `CAST`, `CONVERT` |

> 记住：**单行函数不改变行数**——输入 n 行，输出 n 行（除非 WHERE 过滤）。

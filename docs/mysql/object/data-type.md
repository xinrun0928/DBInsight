# 数据类型（整型 / 浮点 / 日期 / 字符串 / JSON）

## 为什么数据类型很重要

选错数据类型，代价很大：
- **空间浪费**：本来 1 字节能存的数字用了 8 字节
- **精度丢失**：`FLOAT` 存金额，3 毛钱对不上账
- **索引失效**：类型不匹配导致索引无法使用
- **范围溢出**：超出范围直接报错或数据截断

## 整型

### 整型一览

| 类型 | 占用空间 | 有符号范围 | 无符号范围 |
|------|---------|-----------|-----------|
| `TINYINT` | 1 字节 | -128 ~ 127 | 0 ~ 255 |
| `SMALLINT` | 2 字节 | -32768 ~ 32767 | 0 ~ 65535 |
| `MEDIUMINT` | 3 字节 | -8388608 ~ 8388607 | 0 ~ 16777215 |
| `INT` | 4 字节 | -21亿 ~ 21亿 | 0 ~ 42亿 |
| `BIGINT` | 8 字节 | 极大 | 0 ~ 极大 |

### 有符号 vs 无符号

```sql
CREATE TABLE demo_int (
    -- 有符号（默认）
    signed_col INT,
    -- 无符号（只有正数）
    unsigned_col INT UNSIGNED
);
```

### INT(M) 的坑

`INT(4)` **不是只能存 4 位数**！

```sql
CREATE TABLE demo (
    col1 INT,           -- 显示宽度4，但范围不变
    col2 INT(4) ZEROFILL  -- 不足4位时前导零填充：显示为 0001
);
```

> `INT(4) ZEROFILL` 只影响**显示**，不改变存储范围。存 100000 进去，照样存得下。

## 浮点型

### 浮点型一览

| 类型 | 占用空间 | 精度 | 用途 |
|------|---------|------|------|
| `FLOAT` | 4 字节 | 单精度（7位） | 坐标等近似计算 |
| `DOUBLE` | 8 字节 | 双精度（16位） | 科学计算 |
| `DECIMAL(M,N)` | 变长 | 精确 | **金额**（必选） |

### FLOAT / DOUBLE 的坑

```sql
-- FLOAT 和 DOUBLE 是近似值，不精确
CREATE TABLE demo_float (
    f FLOAT,
    d DOUBLE
);
INSERT INTO demo_float VALUES (0.1, 0.1);
SELECT * FROM demo_float WHERE f = 0.1;  -- 可能查不到！
-- 因为 0.1 在二进制中是无限循环的近似值
```

### DECIMAL（货币计算必选）

```sql
CREATE TABLE demo_decimal (
    price DECIMAL(10, 2)  -- 总共10位，小数2位
);
-- 范围：-9999999.99 ~ 9999999.99

INSERT INTO demo_decimal VALUES (1234567.89);  -- OK
INSERT INTO demo_decimal VALUES (12345678.90); -- ERROR: out of range
```

> **金额必须用 DECIMAL**。银行、电商、财务系统无一例外。

## 字符串类型

### 字符串类型对比

| 类型 | 最大长度 | 存储方式 | 适用场景 |
|------|---------|---------|---------|
| `CHAR(M)` | 255 字节 | 固定长度 | 长度固定（性别、状态码） |
| `VARCHAR(M)` | 65535 字节 | 可变长度 | 长度不固定的文本 |
| `TEXT` | 65535 字节 | 可变 | 文章正文、评论 |
| `MEDIUMTEXT` | 16MB | 可变 | 长文章 |
| `LONGTEXT` | 4GB | 可变 | 超长文本 |

### CHAR vs VARCHAR

```sql
CREATE TABLE demo_string (
    -- CHAR(10)：固定占用10字节，不足部分用空格填充
    -- 查询时自动去掉尾部空格
    code CHAR(10),          -- 适合：邮政编码、手机号（长度固定）
    -- VARCHAR(255)：实际占 n+1~2 字节（1~2字节存长度）
    name VARCHAR(255)       -- 适合：用户名、地址（长度不固定）
);
```

**选 CHAR 还是 VARCHAR？**

| 场景 | 推荐 |
|------|------|
| 长度固定（如身份证号 18 位） | `CHAR(18)` |
| 长度变化大（如用户名 2~20 位） | `VARCHAR(50)` |
| 超过 255 字符 | `TEXT` |
| 存 UUID | `CHAR(36)` 或 `VARCHAR(36)` |

### VARCHAR 的长度限制

VARCHAR 的实际最大长度受字符集和行大小限制：

```sql
-- utf8mb4 下，VARCHAR 最大长度约 16383 字符
-- 但实际行大小限制约 65535 字节
-- 所以 VARCHAR(20000) 在 utf8mb4 下会报错
CREATE TABLE t (
    col VARCHAR(20000)  -- 在 utf8mb4 下可能超出单行限制
);
```

### ENUM 和 SET（字符串约束）

```sql
CREATE TABLE demo_enum (
    -- ENUM：单选，从列表中选一个值
    gender ENUM('M', 'F', 'Unknown'),
    -- SET：多选，从列表中选多个值（用逗号分隔存）
    role SET('admin', 'editor', 'viewer')
);

INSERT INTO demo_enum VALUES ('M', 'admin,editor');
```

## 日期时间类型

### 日期时间类型一览

| 类型 | 格式 | 范围 |
|------|------|------|
| `DATE` | `YYYY-MM-DD` | 1000-01-01 ~ 9999-12-31 |
| `TIME` | `HH:MM:SS` | -838:59:59 ~ 838:59:59 |
| `YEAR` | `YYYY` | 1901 ~ 2155 |
| `DATETIME` | `YYYY-MM-DD HH:MM:SS` | 1000-01-01 ~ 9999-12-31 23:59:59 |
| `TIMESTAMP` | `YYYY-MM-DD HH:MM:SS` | 1970-01-01 00:00:01 UTC ~ 2038-01-19 03:14:07 UTC |

### DATETIME vs TIMESTAMP

| 特性 | DATETIME | TIMESTAMP |
|------|---------|---------|
| 占用空间 | 8 字节 | 4 字节 |
| 时区敏感 | ❌ 不敏感 | ✅ 敏感（自动转换） |
| 范围 | 1000~9999 年 | 1970~2038 年 |
| 自动更新 | ❌ 不能 | ✅ 可以（ON UPDATE CURRENT_TIMESTAMP） |
| NOT NULL 默认 | CURRENT_TIMESTAMP | CURRENT_TIMESTAMP |

```sql
CREATE TABLE demo_time (
    -- DATETIME：存什么是什么，不受时区影响
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    -- TIMESTAMP：存 UTC 时间，显示时自动转当前时区
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    -- 时区敏感场景：跨时区系统用 TIMESTAMP
    -- 固定时间展示场景：用 DATETIME
    event_time DATETIME  -- 活动开始时间，全世界同一个时间
);
```

### 日期函数

```sql
SELECT NOW();                    -- 当前日期时间
SELECT CURDATE();               -- 当前日期
SELECT CURTIME();               -- 当前时间
SELECT DATE('2024-01-15 10:30:00');  -- 提取日期
SELECT TIME('2024-01-15 10:30:00');  -- 提取时间
SELECT YEAR(NOW());             -- 年
SELECT MONTH(NOW());            -- 月
SELECT DAY(NOW());              -- 日
```

## JSON 类型

MySQL 5.7.8+ 支持 JSON 类型，提供文档存储能力。

### 基本使用

```sql
CREATE TABLE demo_json (
    id INT PRIMARY KEY,
    info JSON
);

INSERT INTO demo_json VALUES (1, '{"name": "张三", "age": 25, "skills": ["Java", "MySQL"]}');
```

### JSON 函数

```sql
-- 提取字段
SELECT JSON_EXTRACT(info, '$.name') FROM demo_json;  -- "张三"
SELECT info->>'$.name' FROM demo_json;              -- 张三（去掉引号）

-- 提取数组元素
SELECT JSON_EXTRACT(info, '$.skills[0]') FROM demo_json;  -- "Java"

-- 设置值
UPDATE demo_json
SET info = JSON_SET(info, '$.age', 26)
WHERE id = 1;

-- 追加数组元素
UPDATE demo_json
SET info = JSON_ARRAY_APPEND(info, '$.skills', 'Redis')
WHERE id = 1;

-- 搜索 JSON 中的值
SELECT * FROM demo_json
WHERE JSON_EXTRACT(info, '$.age') > 25;
```

### JSON vs 关系型的取舍

| 适合用 JSON | 不适合用 JSON |
|------------|--------------|
| 属性不固定、经常变化 | 需要关联查询 |
| 不需要按字段索引 | 需要对每个属性做精确查询 |
| 结构深嵌套 | 需要做聚合统计 |
| 单个对象的存取 | 需要事务保证一致性 |

> **原则**：能用关系型的不要用 JSON。JSON 类型适合存「不常查询的附加属性」。

## 布尔类型

```sql
CREATE TABLE demo_bool (
    -- MySQL 中 BOOL = TINYINT(1)
    is_active BOOLEAN,   -- 等价于 TINYINT(1)
    is_deleted TINYINT(1)
);

INSERT INTO demo_bool VALUES (TRUE, FALSE);
SELECT * FROM demo_bool WHERE is_active = TRUE;
```

## 二进制类型

| 类型 | 最大长度 |
|------|---------|
| `BINARY(M)` | 255 字节 |
| `VARBINARY(M)` | 65535 字节 |
| `TINYBLOB` | 255 字节 |
| `BLOB` | 65535 字节 |
| `MEDIUMBLOB` | 16MB |
| `LONGBLOB` | 4GB |

```sql
-- 存文件（不推荐，数据库会变大）
CREATE TABLE demo_file (
    id INT PRIMARY KEY,
    content MEDIUMBLOB
);
```

> 生产环境中，文件通常存对象存储（OSS/S3），数据库只存文件 URL。

## 类型选择建议

| 场景 | 推荐类型 |
|------|---------|
| ID、主键 | `BIGINT` 自增 |
| 状态、性别 | `TINYINT` 或 `ENUM` |
| 金额、价格 | `DECIMAL(10,2)` |
| 姓名、标题 | `VARCHAR(100~255)` |
| 正文、评论 | `TEXT` |
| 日期时间 | `DATETIME` |
| 精确时间戳 | `TIMESTAMP` |
| 布尔标志 | `TINYINT(1)` |
| IP 地址 | `VARCHAR(45)` 或 `INT UNSIGNED` |
| JSON 数据 | `JSON` |

## 下一步

理解了数据类型，下一章看 [表（创建/修改/重命名/删除/清空）](/database/mysql/object/table)——怎么用这些类型建表。

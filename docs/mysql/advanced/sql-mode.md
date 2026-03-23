# SQL 大小写 / sql_mode 设置

## sql_mode 是什么

`sql_mode` 是 MySQL 的一套运行时行为配置，决定了 SQL 语句如何被解析和执行。

同一个 SQL，在不同的 `sql_mode` 下，可能有完全不同的结果——有的报错，有的警告，有的默默接受错误行为。

## 查看和设置 sql_mode

```sql
-- 查看当前 sql_mode
SELECT @@sql_mode;

-- 设置会话级（临时）
SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ONLY_FULL_GROUP_BY,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- 设置全局级（需要 SUPER 权限，对新连接生效）
SET GLOBAL sql_mode = '...';
```

永久生效需要修改 `my.cnf`：

```ini
[mysqld]
sql_mode=STRICT_TRANS_TABLES,ONLY_FULL_GROUP_BY,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION
```

## MySQL 5.7 和 8.0 的默认 sql_mode

| 版本 | 默认 sql_mode | 主要变化 |
|------|-------------|---------|
| MySQL 5.5 | 空 | 无限制 |
| MySQL 5.7 | `NO_ENGINE_SUBSTITUTION` | 开始有部分限制 |
| MySQL 8.0 | `ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION` | 严格模式默认开启 |

## 常用 sql_mode 详解

### ONLY_FULL_GROUP_BY

**最常见的影响**：GROUP BY 必须包含所有 SELECT 中的非聚合列。

```sql
-- 违反 ONLY_FULL_GROUP_BY（5.7 默认开启）
SELECT name, class_id, MAX(score)
FROM student
GROUP BY class_id;
-- ERROR 1055: Expression #1 of SELECT list is not in GROUP BY clause
-- name 没有在 GROUP BY 中，且不是聚合函数
```

**正确写法**：

```sql
-- 方式一：name 也加到 GROUP BY
SELECT name, class_id, MAX(score)
FROM student
GROUP BY name, class_id;

-- 方式二：用聚合函数
SELECT class_id, MAX(score), GROUP_CONCAT(name) AS names
FROM student
GROUP BY class_id;
```

### STRICT_TRANS_TABLES

**严格模式**：数据校验更严格。

```sql
-- 插入超出范围的值
INSERT INTO t (id) VALUES (1);
ALTER TABLE t MODIFY id TINYINT;

INSERT INTO t (id) VALUES (9999);  -- 超出 TINYINT 范围
-- 严格模式下：ERROR 1264
-- 非严格模式：WARNING，值被截断
```

### NO_ZERO_DATE

**禁止 '0000-00-00' 日期**。

```sql
INSERT INTO t (created_at) VALUES ('0000-00-00');
-- 严格模式下：ERROR
-- 非严格模式：WARNING，存入 '0000-00-00'
```

### ERROR_FOR_DIVISION_BY_ZERO

**除以零报错**。

```sql
SELECT 10 / 0;
-- 严格模式下：ERROR 1365
-- 非严格模式：返回 NULL，WARNING
```

### NO_ENGINE_SUBSTITUTION

**指定存储引擎不可用时报错**。

```sql
CREATE TABLE t (id INT) ENGINE=Inno99;
-- 严格模式下：ERROR
-- 非严格模式：WARNING，用默认引擎替代
```

### ANSI_QUOTES

**双引号只能用于标识符，不能用于字符串**。

```sql
SET SESSION sql_mode='ANSI_QUOTES';

SELECT "hello";  -- ERROR，双引号现在是标识符
SELECT 'hello';  -- OK，单引号表示字符串
SELECT `column`; -- OK，反引号表示标识符
```

## 大小写敏感性

MySQL 的大小写敏感性有三个层次：

### 1. 服务器层面（os）

Linux 服务器默认大小写敏感，Windows 和 macOS 默认不敏感。

### 2. 数据库层面

```ini
# my.cnf 中设置
lower_case_table_names = 1  # 0=大小写敏感，1=大小写不敏感
```

### 3. 字符集层面

```sql
-- 大小写不敏感（ci）
SELECT * FROM student WHERE name = 'ZHANG';
SELECT * FROM student WHERE name = 'zhang';  -- 都能查到

-- 大小写敏感（bin）
SELECT * FROM student WHERE name COLLATE utf8mb4_bin = 'zhang';
```

### 表名和列名的大小写

| 操作系统 | lower_case_table_names | 表名大小写 | 列名大小写 |
|---------|----------------------|-----------|-----------|
| Linux | 0 | 敏感 | 敏感 |
| Windows | 1 | 不敏感 | 不敏感 |
| macOS | 2（挂载大小写不敏感） | 不敏感 | 不敏感 |

> **Linux 上生产环境必须用 `lower_case_table_names = 1`**，否则切换大小写后找不到表。但设置 `lower_case_table_names = 1` **必须在安装 MySQL 时设置**，事后修改会导致已有表名大小写混乱。

## 推荐的 sql_mode

### MySQL 8.0（推荐）

```ini
sql_mode=ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO
```

### MySQL 5.7（推荐）

```ini
sql_mode=ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION
```

## 常见报错与解决

### ERROR 1055: ONLY_FULL_GROUP_BY

```sql
-- 错误写法
SELECT name, class_id, MAX(score) FROM student GROUP BY class_id;

-- 正确写法：把所有 SELECT 中的非聚合列加到 GROUP BY
SELECT name, class_id, MAX(score) FROM student GROUP BY name, class_id;

-- 或者：用 ANY_VALUE() 明确表示取任意值
SELECT ANY_VALUE(name), class_id, MAX(score) FROM student GROUP BY class_id;
```

### ERROR 1366: Incorrect string value

字符集问题，参考字符集章节。

### ERROR 1062: Duplicate entry

唯一键冲突，检查数据。

## 下一步

sql_mode 和大小写敏感性搞清楚了，接下来看 [MySQL 目录结构 / 表的文件存储](/database/mysql/advanced/file-storage)，或者直接跳到 [用户与权限](/database/mysql/advanced/user)。

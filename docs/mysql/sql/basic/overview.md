# SQL 概述 / 分类 / 使用规范

## SQL 是什么

**SQL（Structured Query Language）** —— 结构化查询语言，是操作关系型数据库的标准语言。

不管你用的是 MySQL、Oracle 还是 PostgreSQL，SQL 语法大体相通。学会一套，触类旁通。

不过，SQL 远不只是 "SELECT * FROM table" 那么简单。它是数据库里的「全能工具」——能定义数据结构、能操作数据、能控制权限、能管理事务。

## SQL 的四大分类

很多人以为 SQL 就等于 SELECT，这是不对的。SQL 按功能分成四类：

| 分类 | 全称 | 作用 | 关键字 |
|------|------|------|--------|
| **DML** | Data Manipulation Language | 增删改查数据 | `INSERT` `UPDATE` `DELETE` `SELECT` |
| **DDL** | Data Definition Language | 定义数据库对象 | `CREATE` `DROP` `ALTER` `RENAME` `TRUNCATE` |
| **DCL** | Data Control Language | 权限和安全 | `GRANT` `REVOKE` |
| **TCL** | Transaction Control Language | 事务控制 | `COMMIT` `ROLLBACK` `SAVEPOINT` |

### DML（最常用）

```sql
-- 查询
SELECT * FROM user WHERE age > 18;

-- 插入
INSERT INTO user (name, age) VALUES ('张三', 20);

-- 更新
UPDATE user SET age = 21 WHERE name = '张三';

-- 删除
DELETE FROM user WHERE name = '张三';
```

### DDL（定义结构）

```sql
-- 创建表
CREATE TABLE student (
    id INT PRIMARY KEY,
    name VARCHAR(50),
    age INT
);

-- 删除表
DROP TABLE student;

-- 修改表结构
ALTER TABLE student ADD COLUMN email VARCHAR(100);

-- 清空表（DDL，不是 DML）
TRUNCATE TABLE student;
```

### TCL（事务控制）

```sql
-- 开启事务
START TRANSACTION;

UPDATE account SET balance = balance - 1000 WHERE id = 1;
UPDATE account SET balance = balance + 1000 WHERE id = 2;

-- 提交（两部分操作要么同时成功，要么同时失败）
COMMIT;
-- 或者回滚（撤销所有操作）
-- ROLLBACK;
```

### DCL（权限控制）

```sql
-- 授权
GRANT SELECT, INSERT ON school_db.* TO 'dev'@'%';

-- 撤销权限
REVOKE INSERT ON school_db.* FROM 'dev'@'%';
```

## MySQL 中的 SQL 语法规范

写 SQL 要遵守一定的规范，否则轻则报错，重则产生不可预期的结果。

### 基本书写规范

```sql
-- 关键字大写（约定俗成，便于阅读）
-- SELECT * FROM user;  -- 不推荐

SELECT * FROM user;  -- 推荐

-- 列名和表名
-- 可以用反引号包裹，避免和 MySQL 保留字冲突
SELECT `name`, `desc` FROM `order` WHERE `id` = 1;

-- 字符串用单引号
SELECT * FROM user WHERE name = '张三';  -- 对
SELECT * FROM user WHERE name = "张三";   -- 不推荐（MySQL 允许但不规范）

-- 数值不加分隔符
SELECT * FROM product WHERE price > 1000;  -- 对
SELECT * FROM product WHERE price > 1,000; -- 错
```

### 命名规范

```sql
-- 表名和列名：小写下划线命名
CREATE TABLE user_order (
    id BIGINT,
    user_id BIGINT,           -- 外键字段用 _id 后缀
    total_amount DECIMAL(10,2), -- 金额用 DECIMAL
    created_at DATETIME
);

-- 不要用 MySQL 保留字做表名或列名
-- 保留字列表：https://dev.mysql.com/doc/refman/8.0/en/keywords.html
```

### 注释规范

```sql
-- 单行注释（两个减号后加空格）
SELECT * FROM user;

# 单行注释（井号风格，MySQL 独有）
SELECT * FROM user;

-- 多行注释
/*
  这是一段
  多行注释
  通常用于文件头部说明
*/

-- SQL 语句内的注释（常用于解释复杂逻辑）
SELECT
    name,                            -- 用户名
    CASE                            -- 判断逻辑
        WHEN age < 18 THEN '未成年'
        ELSE '成年'
    END AS age_desc
FROM user;
```

### 语句终结

```sql
-- MySQL 中分号是语句终结符
SELECT * FROM user;

-- 可以连续写多条语句
SELECT 1; SELECT 2; SELECT 3;
```

### 大小写规范

```sql
-- MySQL 中，关键字大小写不敏感
SELECT * FROM user;
select * from user;
sElEcT * FrOm UsEr;  -- 能跑，但别这么写

-- 但表名和列名在 Linux 服务器上大小写敏感
-- （Windows 和 macOS 默认不敏感）
-- 建议：始终用小写定义表名和列名
CREATE TABLE UserInfo (...);  -- 不推荐
CREATE TABLE user_info (...);  -- 推荐
```

## SQL 执行顺序

理解 SQL 的执行顺序，对写复杂查询至关重要。

```sql
SELECT DISTINCT column, aggregate_function(col)
FROM table1
JOIN table2 ON condition
WHERE condition
GROUP BY column
HAVING aggregate_condition
ORDER BY column ASC/DESC
LIMIT n;
```

实际执行顺序（数据库内部）：

```
1. FROM        → 确定数据来源
2. JOIN        → 关联表
3. WHERE       → 先过滤（减少后续处理的数据量）
4. GROUP BY    → 分组
5. HAVING      → 对分组结果再过滤
6. SELECT      → 选择列（计算聚合、DISTINCT）
7. ORDER BY    → 排序
8. LIMIT       → 限制数量
```

> **为什么 WHERE 要放在 GROUP BY 前面？** 因为 GROUP BY 会把数据聚合，一旦聚合就无法再逐行过滤。所以 WHERE 先过滤掉不需要的行，减少 GROUP BY 的工作量。

## 快速验证 SQL

在学习 SQL 之前，先准备一个测试数据库：

```sql
-- 创建测试库
CREATE DATABASE sql_demo;
USE sql_demo;

-- 创建学生表
CREATE TABLE student (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(30) NOT NULL,
    age INT,
    gender CHAR(1),
    class_id INT,
    score DECIMAL(5,2)
);

-- 插入测试数据
INSERT INTO student (name, age, gender, class_id, score) VALUES
('张三', 18, 'M', 1, 85.5),
('李四', 19, 'F', 1, 92.0),
('王五', 18, 'M', 2, 78.0),
('赵六', 20, 'F', 2, 88.5),
('钱七', 19, 'M', 3, 95.0);
```

接下来的章节都会在这个表上演示。准备好开始了吗？

## 下一步

- 想从最简单的查询开始 → [基本 SELECT...FROM 结构](/database/mysql/sql/basic/select-from)
- 想学怎么过滤数据 → [WHERE 过滤数据](/database/mysql/sql/basic/where)
- 想快速过一遍所有 SQL 关键字 → 本章内容足够，直接进入下一部分

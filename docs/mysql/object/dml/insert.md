# 添加数据（INSERT）

## 基本语法

### 插入单行

```sql
INSERT INTO student (name, age, score)
VALUES ('张三', 18, 85.5);
```

### 插入多行

```sql
INSERT INTO student (name, age, score) VALUES
('张三', 18, 85.5),
('李四', 19, 92.0),
('王五', 18, 78.0);
```

多行插入比多条单行 INSERT 快得多——因为只执行一次 SQL 语句、一次网络往返、一次事务提交。

### 省略列名（按建表顺序插入所有列）

```sql
INSERT INTO student VALUES
(1, '张三', 18, 'M', 1, 85.5, NOW(), NOW());
```

> 不推荐省略列名，一旦表结构变化就会出错。

### 设置默认值

列有默认值时，可以省略该列：

```sql
-- 假设 score 有 DEFAULT 0
INSERT INTO student (name, age) VALUES ('赵六', 20);
-- score 会自动填 0
```

## 插入查询结果

把 SELECT 的结果批量插入：

```sql
INSERT INTO top_students (id, name, score)
SELECT id, name, score FROM student WHERE score >= 90;
```

### 插入并更新（ON DUPLICATE KEY UPDATE）

如果主键或唯一索引冲突，就更新：

```sql
INSERT INTO user (id, name, email)
VALUES (1, '张三', 'zhangsan@example.com')
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    email = VALUES(email);
```

### 插入并忽略（IGNORE）

如果主键或唯一索引冲突，就忽略（不报错）：

```sql
INSERT IGNORE INTO user (id, name)
VALUES (1, '张三');
-- 如果 id=1 已存在，忽略这条插入
```

## REPLACE（替换插入）

如果主键或唯一索引冲突，**先删除旧行，再插入新行**：

```sql
REPLACE INTO user (id, name, email)
VALUES (1, '张三', 'zhangsan@example.com');
-- 如果 id=1 已存在：先删旧行，再插新行（注意：旧行的自增ID会变化）
```

> `REPLACE` 不是 UPDATE，是 DELETE + INSERT。会影响 `AUTO_INCREMENT`。

## SET 语法

```sql
INSERT INTO student
SET name = '赵六', age = 20, score = 88.0;
```

## 子查询插入

```sql
INSERT INTO student_backup (name, score)
SELECT name, score FROM student WHERE score >= 80;
```

## LAST_INSERT_ID()

获取最近一次插入的自增 ID：

```sql
INSERT INTO student (name, age) VALUES ('赵六', 20);
SELECT LAST_INSERT_ID();  -- 返回刚才插入的 id
```

注意：在批量插入多行时，`LAST_INSERT_ID()` 返回**第一行**的 ID。

## 插入性能优化

### 批量插入（一次插入大量数据）

```sql
-- 好：多行 VALUES
INSERT INTO student (name, score) VALUES
('学生1', 80), ('学生2', 81), ..., ('学生1000', 90);

-- 不好：循环执行多条 INSERT
-- (执行 1000 次，1000 次网络往返，1000 次事务提交)
```

### 事务包裹

```sql
START TRANSACTION;
INSERT INTO student (name, score) VALUES (...);  -- 重复 1000 次
COMMIT;
```

### 关闭自动提交（大批量导入）

```sql
SET autocommit = 0;
-- 执行大量 INSERT
SET autocommit = 1;
```

### LOAD DATA（最快的导入方式）

```sql
-- 从 CSV 文件导入，比 INSERT 快 10~20 倍
LOAD DATA INFILE '/tmp/student.csv'
INTO TABLE student
FIELDS TERMINATED BY ','
LINES TERMINATED BY '\n'
(name, age, score);
```

## 常见错误

### 主键冲突

```sql
-- ERROR 1062: Duplicate entry '1' for key 'PRIMARY'
INSERT INTO student (id, name) VALUES (1, '张三');
-- id=1 已存在，违反主键唯一约束
```

解决方法：用 `ON DUPLICATE KEY UPDATE` 或 `REPLACE`。

### 非空约束违反

```sql
-- ERROR 1364: Field 'name' doesn't have a default value
INSERT INTO student (age) VALUES (18);
-- name 列设为 NOT NULL，但没有提供值
```

### 外键约束违反

```sql
-- ERROR 1452: Cannot add or update a child row
INSERT INTO student (name, class_id) VALUES ('张三', 999);
-- class_id=999 在 class 表中不存在
```

## 下一步

INSERT 学完了，接下来看 [更新 / 删除（UPDATE/DELETE）/ 计算列](/database/mysql/object/dml/update-delete)。

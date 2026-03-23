# 视图（创建 / 查看 / 更新 / 删除）

## 什么是视图

**视图（View）** 是一张「虚拟表」，它的内容由 SQL 查询定义。视图不存储数据，每次查询视图时，MySQL 实时执行底层查询。

```sql
-- 创建视图：年龄大于等于 18 岁的学生
CREATE VIEW adult_student AS
SELECT id, name, age, score
FROM student
WHERE age >= 18;

-- 查询视图：和普通表一样使用
SELECT * FROM adult_student WHERE score >= 90;
```

## 创建视图

### 基本语法

```sql
CREATE VIEW view_name AS
SELECT ...
```

### 视图的列别名

```sql
CREATE VIEW student_score_view AS
SELECT
    s.id,
    s.name,
    c.name    AS class_name,
    s.score,
    CASE
        WHEN s.score >= 90 THEN 'A'
        WHEN s.score >= 80 THEN 'B'
        WHEN s.score >= 60 THEN 'C'
        ELSE 'D'
    END       AS grade
FROM student s
JOIN class c ON s.class_id = c.id;
```

### 检查视图结构

```sql
DESC view_name;
SHOW CREATE VIEW view_name;
```

### OR REPLACE（替换已有视图）

```sql
CREATE OR REPLACE VIEW adult_student AS
SELECT * FROM student WHERE age >= 20;
```

### ALGORITHM 选项

| 选项 | 说明 |
|------|------|
| `MERGE` | 视图和查询合并执行（默认，推荐） |
| `TEMPTABLE` | 先把视图结果存入临时表，再查询 |
| `UNDEFINED` | 由 MySQL 决定（通常是 MERGE） |

```sql
CREATE ALGORITHM = MERGE VIEW view_name AS
SELECT ...;
```

## 查看视图

```sql
-- 查看所有视图
SHOW TABLES;  -- 视图也会显示在这里，区分方式：
SHOW TABLE STATUS WHERE Comment = 'VIEW';

-- 查看视图定义
SHOW CREATE VIEW adult_student;
```

## 删除视图

```sql
DROP VIEW adult_student;
DROP VIEW IF EXISTS adult_student;
```

## 更新视图数据

视图是否可以更新，取决于底层查询的复杂度。

### 可更新的视图

简单视图（不包含聚合函数、DISTINCT、GROUP BY、UNION 等）可以直接 INSERT/UPDATE/DELETE：

```sql
CREATE VIEW v1 AS
SELECT id, name, score FROM student WHERE score >= 60;

-- ✅ 可以更新
INSERT INTO v1 (id, name, score) VALUES (10, '赵六', 75);

-- ✅ 可以修改
UPDATE v1 SET score = 80 WHERE id = 10;

-- ✅ 可以删除
DELETE FROM v1 WHERE id = 10;
```

### 不能更新的视图

以下视图**不可更新**：

```sql
-- ❌ 包含聚合函数
CREATE VIEW avg_score AS SELECT AVG(score) AS avg FROM student;

-- ❌ 包含 GROUP BY
CREATE VIEW class_avg AS
SELECT class_id, AVG(score) AS avg_score
FROM student GROUP BY class_id;

-- ❌ 包含 DISTINCT
CREATE VIEW distinct_student AS
SELECT DISTINCT name FROM student;

-- ❌ 包含 UNION
CREATE VIEW union_view AS
SELECT name FROM student WHERE class_id = 1
UNION
SELECT name FROM student WHERE class_id = 2;

-- ❌ 包含子查询（在 SELECT 中）
CREATE VIEW subquery_view AS
SELECT *, (SELECT COUNT(*) FROM class) AS class_count FROM student;

-- ❌ 包含常量、表达式
CREATE VIEW calc_view AS
SELECT id, name, score, score * 1.1 AS adjusted FROM student;
```

### WITH CHECK OPTION

防止更新视图后，该行从视图中「消失」：

```sql
CREATE VIEW adult_student AS
SELECT * FROM student WHERE age >= 18
WITH CHECK OPTION;

-- 现在这条 INSERT 会失败（因为新插入的记录 age=17，不在视图范围内）
INSERT INTO adult_student (name, age, score) VALUES ('王五', 17, 80);
-- ERROR: CHECK OPTION failed

-- 这条可以成功（age=18 满足视图条件）
INSERT INTO adult_student (name, age, score) VALUES ('王五', 18, 80);
```

## 视图的作用与场景

### 场景一：简化复杂查询

```sql
-- 每次查这个都需要 JOIN 三张表，很麻烦
CREATE VIEW order_user_view AS
SELECT
    o.id          AS order_id,
    o.order_no,
    u.username,
    u.email,
    o.total_amount,
    o.created_at
FROM `order` o
JOIN user u ON o.user_id = u.id;

-- 后续查询简单多了
SELECT * FROM order_user_view WHERE created_at >= '2024-01-01';
```

### 场景二：数据安全（列级权限控制）

```sql
-- 普通员工只能看到部分信息
CREATE VIEW employee_public AS
SELECT
    id,
    name,
    department,
    email
FROM employee;

-- 只有管理员能看全部字段
SELECT * FROM employee;  -- 含 salary 等敏感字段
```

### 场景三：业务抽象

```sql
-- 把常用查询条件封装成视图
CREATE VIEW active_order AS
SELECT * FROM `order`
WHERE status IN (1, 2) AND is_deleted = 0;

-- 业务代码中始终查这个视图，不需要每次都写 WHERE 条件
SELECT * FROM active_order WHERE user_id = 1;
```

## 视图的性能问题

视图本身不存储数据，但每次查询视图时都会执行底层查询。

### 物化视图 vs 普通视图

MySQL 没有内置的「物化视图」（提前计算好结果存起来）。如果需要类似功能，可以用：

```sql
-- 定时刷新物化视图（模拟方案）
CREATE TABLE mv_class_avg AS
SELECT class_id, AVG(score) AS avg_score
FROM student GROUP BY class_id;

-- 定时任务刷新
REPLACE INTO mv_class_avg
SELECT class_id, AVG(score) AS avg_score
FROM student GROUP BY class_id;
```

## 下一步

视图学完了，接下来学习 [存储过程（创建/调用/修改/删除）](/database/mysql/object/procedure)。

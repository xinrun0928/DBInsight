# 更新 / 删除（UPDATE/DELETE）/ 计算列

## UPDATE 更新数据

### 基本语法

```sql
UPDATE student
SET score = 90
WHERE name = '张三';
```

> **危险**：没有 WHERE 的 UPDATE 会更新所有行！

```sql
UPDATE student SET score = 0;  -- 所有学生的成绩都变成 0！
```

### 批量更新多列

```sql
UPDATE student
SET age = age + 1,
    score = score + 5
WHERE class_id = 1;
```

### UPDATE + 子查询

```sql
-- 把班级平均分以下的同学成绩加 10 分
UPDATE student
SET score = score + 10
WHERE score < (
    SELECT avg_score FROM (
        SELECT AVG(score) AS avg_score FROM student
    ) AS t
);
```

> 这里用了派生表绕开「不能更新同一张表的子查询」限制。

### UPDATE + ORDER BY + LIMIT

```sql
-- 按成绩从低到高更新，取最低的 10 个人加 5 分
UPDATE student
SET score = score + 5
ORDER BY score ASC
LIMIT 10;
```

### UPDATE 多表

```sql
-- 一次更新两张表
UPDATE student s
JOIN class c ON s.class_id = c.id
SET s.score = s.score + 10
WHERE c.name = '一班';
```

## DELETE 删除数据

### 基本语法

```sql
DELETE FROM student
WHERE name = '张三';
```

> **危险**：没有 WHERE 的 DELETE 会删除所有行！

```sql
DELETE FROM student;  -- 所有数据都没了！
```

### DELETE + ORDER BY + LIMIT

```sql
-- 删除成绩最低的 3 名学生
DELETE FROM student
ORDER BY score ASC
LIMIT 3;
```

### DELETE 多表

```sql
-- 从两个表中删除满足条件的数据
DELETE s, e
FROM student s
JOIN enrollment e ON s.id = e.student_id
WHERE s.score < 30;
```

### DELETE 与 TRUNCATE 的区别

| 特性 | DELETE | TRUNCATE |
|------|--------|---------|
| 类型 | DML | DDL |
| WHERE 条件 | ✅ 支持 | ❌ 不支持 |
| 速度 | 慢（逐行删除） | 快（重建表） |
| 回滚 | ✅ 可回滚 | ❌ 不可回滚 |
| AUTO_INCREMENT | ❌ 不重置 | ✅ 重置 |
| 触发器 | ✅ 触发 | ❌ 不触发 |

## 计算列（Generated Column）

计算列是 MySQL 5.7.7+ 引入的特性——由其他列计算得出，存储时自动计算。

### 语法

```sql
CREATE TABLE order_info (
    price     DECIMAL(10,2),
    quantity  INT,
    -- 计算列：总价 = 单价 × 数量
    total_price DECIMAL(10,2) AS (price * quantity) STORED,
    -- AS (表达式)：定义计算列
    -- STORED：计算后存储（物理占用空间，可建索引）
    -- VIRTUAL：不存储，查询时实时计算（不占空间）
    discount_rate DECIMAL(3,2) DEFAULT 0.10,
    final_price DECIMAL(10,2) AS ((price * quantity) * (1 - discount_rate)) STORED
);
```

### STORED vs VIRTUAL

| 特性 | STORED | VIRTUAL |
|------|--------|--------|
| 存储空间 | 占磁盘空间 | 不占空间 |
| 索引 | ✅ 可以建索引 | ❌ 不可以 |
| 查询性能 | 快（直接读） | 稍慢（实时算） |
| 适用场景 | 需要排序/索引 | 简单表达式 |

### 计算列建索引

```sql
-- 用计算列建索引（只有 STORED 支持）
CREATE TABLE t (
    a INT,
    b INT,
    c INT AS (a + b) STORED,
    INDEX idx_c (c)
);

-- 这个查询可以使用索引
SELECT * FROM t WHERE c > 100;
```

### 实战：用户年龄计算

```sql
CREATE TABLE user (
    id BIGINT PRIMARY KEY,
    name VARCHAR(50),
    birth_date DATE,
    -- 每年自动更新，不用手动维护
    age INT AS (TIMESTAMPDIFF(YEAR, birth_date, CURDATE())) VIRTUAL
);
```

## 事务中的 UPDATE / DELETE

在事务包裹下的 UPDATE 和 DELETE 可以回滚：

```sql
START TRANSACTION;
UPDATE account SET balance = balance - 1000 WHERE id = 1;
UPDATE account SET balance = balance + 1000 WHERE id = 2;
-- 检查结果
SELECT * FROM account WHERE id IN (1, 2);
-- 确认无误后提交
COMMIT;
-- 或者发现问题后回滚
-- ROLLBACK;
```

## 下一步

数据操作学完了，接下来看 [事务控制（COMMIT/ROLLBACK）](/database/mysql/object/dml/transaction)。

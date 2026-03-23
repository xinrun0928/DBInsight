# WHERE 过滤数据

## WHERE 的作用

WHERE 子句用来**筛选行**——不是把所有数据都查出来，而是只返回满足条件的行。

没有 WHERE：

```sql
SELECT * FROM student;
-- 返回 5 行（全部学生）
```

有 WHERE：

```sql
SELECT * FROM student WHERE score >= 90;
-- 只返回 2 行（成绩 90 分以上的学生）
```

WHERE 的执行时机：在 SELECT 之前执行，在 FROM 之后执行。所以 WHERE 只能过滤**原始数据的行**，不能使用 SELECT 中定义的别名（因为 SELECT 还没执行）。

## WHERE 的基本语法

```sql
SELECT 列 FROM 表 WHERE 条件;
```

WHERE 条件由三部分组成：**列名 + 运算符 + 值/表达式**。

## 比较运算符

| 运算符 | 说明 | 示例 |
|--------|------|------|
| `=` | 等于 | `WHERE score = 90` |
| `<>` 或 `!=` | 不等于 | `WHERE gender <> 'M'` |
| `>` | 大于 | `WHERE score > 60` |
| `>=` | 大于等于 | `WHERE score >= 60` |
| `<` | 小于 | `WHERE age < 20` |
| `<=` | 小于等于 | `WHERE age <= 20` |

```sql
-- 成绩及格的学生
SELECT * FROM student WHERE score >= 60;

-- 年龄不等于 18 的学生
SELECT * FROM student WHERE age <> 18;

-- 查询班级编号为 1 的学生
SELECT * FROM student WHERE class_id = 1;
```

> 注意：WHERE 子句中，字符串和日期要用单引号包起来，数字不需要。

## 逻辑运算符

多个条件组合使用，用 `AND`、`OR`、`NOT`。

### AND（且）

所有条件都满足才返回。

```sql
-- 班级 1 中，成绩在 80 到 90 之间的学生
SELECT * FROM student WHERE class_id = 1 AND score >= 80 AND score <= 90;
```

### OR（或）

任一条件满足就返回。

```sql
-- 班级 1 或 班级 2 的学生
SELECT * FROM student WHERE class_id = 1 OR class_id = 2;
```

### NOT（非）

取反，不满足条件的行。

```sql
-- 不及格的学生
SELECT * FROM student WHERE NOT score >= 60;

-- 性别不是 M 的学生
SELECT * FROM student WHERE gender <> 'M';
```

### 组合使用

```sql
-- AND 和 OR 混用：注意优先级
-- 班级 1 中，成绩 >= 90 或 年龄 > 19 的学生
SELECT * FROM student
WHERE class_id = 1 AND (score >= 90 OR age > 19);
```

> **括号很重要！** `AND` 的优先级高于 `OR`，不加括号可能导致逻辑完全相反。

## BETWEEN...AND（范围）

连续区间查询用 `BETWEEN...AND`，比 `>= AND <=` 更简洁。

```sql
-- 成绩在 80 到 90 之间的学生（包括端点）
SELECT * FROM student WHERE score BETWEEN 80 AND 90;

-- 等价于
SELECT * FROM student WHERE score >= 80 AND score <= 90;
```

> 注意：`BETWEEN...AND` 是**闭区间**（两端都包含）。

## IN（多值匹配）

查询某个字段在多个值中的任意一个：

```sql
-- 班级编号为 1 或 3 的学生
SELECT * FROM student WHERE class_id IN (1, 3);

-- 等价于
SELECT * FROM student WHERE class_id = 1 OR class_id = 3;
```

`IN` 后面可以是子查询：

```sql
-- 查询成绩高于班级平均分的同学
SELECT * FROM student
WHERE score > (
    SELECT AVG(score) FROM student WHERE class_id = class_id
);
```

## LIKE（模糊匹配）

字符串模式匹配，用通配符：

| 通配符 | 说明 | 示例 |
|--------|------|------|
| `%` | 任意多个字符 | `'张%'` 匹配「张三」「张无忌」 |
| `_` | 任意单个字符 | `'_三'` 匹配「张三」「李三」 |

```sql
-- 名字以「张」开头的学生
SELECT * FROM student WHERE name LIKE '张%';

-- 名字以「三」结尾的学生
SELECT * FROM student WHERE name LIKE '%三';

-- 名字中间有「小」的学生
SELECT * FROM student WHERE name LIKE '%小%';

-- 名字是两个字，且第二个字是「三」的学生
SELECT * FROM student WHERE name LIKE '_三';
```

### LIKE 的性能问题

`LIKE '%xxx'` 开头是通配符，**无法使用索引**，会导致全表扫描。数据量大时要谨慎使用。

### 转义

如果要查询包含 `%` 或 `_` 本身，需要用 `ESCAPE` 转义：

```sql
-- 查找商品名称中含有「10%」折扣的商品
SELECT * FROM product WHERE name LIKE '%10\%%' ESCAPE '\\';
```

## IS NULL / IS NOT NULL

空值判断不能用 `=` 或 `<>`，必须用 `IS NULL` / `IS NOT NULL`：

```sql
-- 查找成绩为空的记录（漏录的情况）
SELECT * FROM student WHERE score IS NULL;

-- 查找成绩不为空的学生
SELECT * FROM student WHERE score IS NOT NULL;
```

> 注意：空字符串 `''` 不等于 NULL，两者是不同的东西。

## WHERE 的执行顺序与别名陷阱

前面说过，SQL 的执行顺序是：FROM → WHERE → SELECT → ORDER BY。

这意味着你在 WHERE 中**不能使用 SELECT 的别名**：

```sql
-- 错：不能在 WHERE 中使用别名
SELECT name, score + 10 AS adjusted_score
FROM student
WHERE adjusted_score > 90;
-- ERROR: Unknown column 'adjusted_score' in 'where clause'

-- 对：直接写表达式
SELECT name, score + 10 AS adjusted_score
FROM student
WHERE score + 10 > 90;
```

如果想用别名过滤，应该用子查询或 HAVING：

```sql
-- 方式一：子查询
SELECT * FROM (
    SELECT name, score + 10 AS adj FROM student
) AS t WHERE adj > 90;

-- 方式二：HAVING（配合 GROUP BY 使用）
SELECT name, AVG(score) AS avg_score
FROM student
GROUP BY name
HAVING AVG(score) > 80;
```

## 综合示例

```sql
-- 查询条件组合：
-- 班级 1 或 2，年龄 18~20 岁，成绩 >= 80，姓名包含「张」
SELECT name, age, score, class_id
FROM student
WHERE (class_id = 1 OR class_id = 2)
    AND age BETWEEN 18 AND 20
    AND score >= 80
    AND name LIKE '%张%';
```

## 下一步

WHERE 能过滤数据，但没法做计算和转换。下一章学习 [运算符](/database/mysql/sql/basic/operator/arithmetic)——算术运算符、比较运算符、逻辑运算符、位运算符——让 WHERE 条件和 SELECT 投影都有更多表达能力。

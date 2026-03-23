# 基本 SELECT...FROM 结构

## 最简单的查询

SQL 的起点，就是这两个关键字：

```sql
SELECT * FROM student;
```

这行代码的意思是：从 `student` 表里查出所有列的所有数据。

`*` 是通配符，代表「所有列」。`FROM` 指定数据来源。

这条查询会返回 student 表的完整内容。但实际工作中，**很少直接用 `SELECT *`**，原因：
- 返回数据量大，影响性能
- 不需要的列浪费网络带宽
- 表结构变更时，`*` 的结果也会变，不可控

## 选择特定列

```sql
-- 查询单列
SELECT name FROM student;

-- 查询多列（用逗号分隔）
SELECT name, age, score FROM student;

-- 查询并起别名（AS 关键字）
SELECT name AS '姓名', age AS '年龄', score AS '成绩' FROM student;
```

别名的好处是让结果集的列名更友好。注意：别名中的中文或空格要用单引号包裹。

## FROM 子句

### 查询单表

```sql
SELECT name, score FROM student;
```

### FROM 多个表（笛卡尔积）

```sql
SELECT * FROM student, teacher;
```

如果 student 表有 5 行，teacher 表有 3 行，结果会是 `5 × 3 = 15` 行。这就是**笛卡尔积**——把所有可能的两两组合都列出来。

实际使用中几乎不会直接查笛卡尔积，而是通过 JOIN 条件来过滤。

### FROM 子查询（派生表）

```sql
SELECT *
FROM (SELECT * FROM student WHERE score > 80) AS high_scorers;
```

把一个查询的结果当成临时表再用。这个临时表有个名字叫 `high_scorers`（必须有 AS 给它起名）。

## 基本的 SELECT 表达式

### 算数运算

```sql
-- 直接算（不查任何表）
SELECT 1 + 1;          -- 结果：2
SELECT 3 * 4;          -- 结果：12
SELECT 'Hello' AS greeting;  -- 结果：Hello
```

### 列的算术运算

```sql
-- 给成绩加 10 分
SELECT name, score, score + 10 AS adjusted_score FROM student;

-- 计算总分（假设有多个成绩列）
SELECT name, (score + homework + exam) AS total FROM student;
```

### 连接字符串

```sql
-- CONCAT 函数：拼接多个字符串
SELECT CONCAT(name, '的成绩是', score) AS info FROM student;

-- 结果：
-- 张三的成绩是85.5
-- 李四的成绩是92.0
```

## 去掉重复行

```sql
-- 原始数据：score 列有重复值
SELECT score FROM student;
-- 结果：85.5, 92.0, 78.0, 88.5, 95.0, 92.0

-- DISTINCT：去掉重复行
SELECT DISTINCT score FROM student;
-- 结果：85.5, 92.0, 78.0, 88.5, 95.0
```

`DISTINCT` 作用于它后面所有的列，只有所有列都相同才算重复：

```sql
-- 多列去重：只有当 name + gender 都相同才去掉
SELECT DISTINCT name, gender FROM student;
```

> 注意：DISTINCT 必须写在所有列前面，不能写成 `name DISTINCT, gender`。

## 常量列

常量列是指每一行都显示同一个值。常用于标记、分组等场景：

```sql
SELECT name, score, '及格' AS status FROM student WHERE score >= 60;
SELECT name, 'MySQL' AS source FROM student;
```

## 执行顺序

`SELECT` 和 `FROM` 的执行顺序是：**先 FROM，后 SELECT**。

```sql
SELECT name, age + 1 AS next_year_age FROM student;
```

执行过程：
1. FROM student → 找到 student 表
2. SELECT name, age + 1 → 从表中取出 name 列，并计算 age + 1
3. 包装成结果集返回

## 综合示例

```sql
-- 查询所有学生的姓名和调整后的成绩，去掉重复值
SELECT DISTINCT
    name AS 姓名,
    (score + 10) AS 调整后成绩,
    '2024级' AS 年级
FROM student
WHERE class_id = 1;
```

## 常见错误

### 拼写错误

```sql
-- 错：列名拼错了
SELECT naem FROM student;

-- ERROR 1054: Unknown column 'naem' in 'field list'
```

### 遗漏 FROM

```sql
-- 对：查常量
SELECT 1 + 1;

-- 错：查列名但没写 FROM
SELECT name;
-- ERROR 1046: No database selected
```

## 下一步

现在你知道了怎么从表中取数据。但实际查询时，通常需要**只取满足条件的行**——这就要靠 WHERE 子句了。

```sql
SELECT * FROM student WHERE score >= 60;
```
下一章我们专门讲 WHERE 的用法。
# 逻辑 / 位运算符

## 逻辑运算符

| 运算符 | 说明 |
|--------|------|
| `NOT` 或 `!` | 非 |
| `AND` 或 `&&` | 且 |
| `OR` 或 `||` | 或 |
| `XOR` | 异或 |

### AND（且）

所有条件都为 TRUE 时结果为 TRUE：

```sql
SELECT * FROM student WHERE class_id = 1 AND score >= 80;
```

### OR（或）

任一条件为 TRUE 时结果为 TRUE：

```sql
SELECT * FROM student WHERE class_id = 1 OR class_id = 2;
```

### XOR（异或）

两个条件**不同**时返回 TRUE：

```sql
SELECT * FROM student WHERE class_id = 1 XOR score >= 80;
```

### 短路求值

MySQL 的 AND/OR 会**短路求值**——如果前半部分已经能确定结果，后半部分不执行。

## 位运算符

| 运算符 | 说明 | 示例 |
|--------|------|------|
| `&` | 按位与 | `5 & 3 → 1` |
| `|` | 按位或 | `5 | 3 → 7` |
| `^` | 按位异或 | `5 ^ 3 → 6` |
| `~` | 按位取反 | `~5` |
| `<<` | 左移 | `5 << 1 → 10` |
| `>>` | 右移 | `5 >> 1 → 2` |

### 按位与（&）

```sql
SELECT 5 & 3;  -- 结果：1
```

**应用：权限判断**

```sql
-- 权限常量：读=1, 写=2, 删=4, 管=8
-- 用户权限 = 7 (0111 = 读+写+删)
SELECT IF(7 & 1, '有读权限', '无读权限');  -- 有读权限
SELECT IF(7 & 8, '有管权限', '无管权限');  -- 无管权限
```

### 按位或（|）

```sql
SELECT 5 | 3;  -- 结果：7
```

### 左移右移

```sql
SELECT 1 << 3;  -- 结果：8（2的3次方）
SELECT 8 >> 1;  -- 结果：4
```

## 下一步

运算符学完了，接下来看 [ORDER BY 排序 / LIMIT 分页](/database/mysql/sql/basic/sort-pagination)。
# 7种JOIN操作 / NATURAL JOIN / USING

## 七种 JOIN 图解

用韦恩图来表示七种 JOIN 的区别：

```
student (左表, 4行)       class (右表, 3行)

A = student表全部行       B = class表全部行
A∩B = 有关联的行
```

| 类型 | 结果 |
|------|------|
| **INNER JOIN** | A ∩ B（有关联的记录） |
| **LEFT JOIN** | A 全部 + A∩B（没关联的右表填 NULL） |
| **RIGHT JOIN** | B 全部 + A∩B（没关联的左表填 NULL） |
| **LEFT EXCLUSIVE JOIN** | A - A∩B（左表独有，没有右表关联的） |
| **RIGHT EXCLUSIVE JOIN** | B - A∩B（右表独有，没有左表关联的） |
| **FULL OUTER JOIN** | A ∪ B（MySQL 不直接支持） |
| **FULL EXCLUSIVE JOIN** | (A - A∩B) ∪ (B - A∩B)（两边都独有） |

## 七种 JOIN 的 SQL

用两张示例表来演示：

```sql
-- student: id, name, class_id
-- class:   id, name
```

```sql
-- 1. INNER JOIN：两边都有关联
SELECT s.name, c.name
FROM student s
INNER JOIN class c ON s.class_id = c.id;

-- 2. LEFT JOIN：左表全部
SELECT s.name, c.name
FROM student s
LEFT JOIN class c ON s.class_id = c.id;

-- 3. RIGHT JOIN：右表全部
SELECT s.name, c.name
FROM student s
RIGHT JOIN class c ON s.class_id = c.id;

-- 4. LEFT EXCLUSIVE JOIN：左表独有（没关联右表）
SELECT s.name
FROM student s
LEFT JOIN class c ON s.class_id = c.id
WHERE c.id IS NULL;

-- 5. RIGHT EXCLUSIVE JOIN：右表独有（没关联左表）
SELECT c.name
FROM student s
RIGHT JOIN class c ON s.class_id = c.id
WHERE s.id IS NULL;

-- 6. FULL OUTER JOIN：两边全部（MySQL 模拟）
SELECT s.name, c.name
FROM student s
LEFT JOIN class c ON s.class_id = c.id
UNION
SELECT s.name, c.name
FROM student s
RIGHT JOIN class c ON s.class_id = c.id;

-- 7. FULL EXCLUSIVE JOIN：两边独有（MySQL 模拟）
SELECT s.name
FROM student s
LEFT JOIN class c ON s.class_id = c.id
WHERE c.id IS NULL
UNION
SELECT s.name
FROM student s
RIGHT JOIN class c ON s.class_id = c.id
WHERE s.id IS NULL;
```

## NATURAL JOIN（自然连接）

自动按**同名列**进行等值连接：

```sql
SELECT * FROM student NATURAL JOIN class;
```

相当于：

```sql
SELECT *
FROM student s
JOIN class c ON s.class_id = c.id;
```

> **使用需谨慎**。如果两张表有多个同名列，自然连接会把它们全部关联，可能产生意外结果。

## USING 子句

如果连接列**名称相同**，可以用 USING 简化：

```sql
SELECT * FROM student
JOIN class USING (class_id);
```

相当于：

```sql
SELECT * FROM student s
JOIN class c ON s.class_id = c.id;
```

但 USING 更简洁，而且 SELECT * 时不会重复显示连接列。

## USING vs ON 对比

```sql
-- ON：灵活，可以指定任意连接条件
SELECT * FROM student s
JOIN class c ON s.class_id = c.id AND s.name = '张三';

-- USING：简洁，但只能用于列名相同的情况
SELECT * FROM student s
JOIN class c USING (class_id);
```

## 实战：谁没有选修课

```sql
-- 查出没有选修任何课程的学生
SELECT s.* FROM student s
LEFT JOIN enrollment e ON s.id = e.student_id
WHERE e.student_id IS NULL;
```

## 下一步

接下来学习 [函数](/database/mysql/sql/function/single-row)——单行函数和聚合函数。
# 子查询分类 / 单行子查询

## 子查询是什么

子查询就是「查询里的查询」——在一个 SELECT 语句中嵌套另一个 SELECT 语句。

```sql
-- 查成绩大于平均分的学生
SELECT * FROM student
WHERE score > (
    SELECT AVG(score) FROM student
);
```

子查询可以出现在：SELECT、FROM、WHERE、HAVING 几乎任何位置。

## 子查询分类（按返回结果分）

| 类型 | 返回结果 | 使用场景 |
|------|---------|---------|
| 标量子查询 | 单个值（1行1列） | WHERE/HAVING 条件 |
| 列子查询 | 单列多行 | WHERE IN/ALL/ANY |
| 行子查询 | 1行多列 | 比较整行 |
| 表子查询 | 多行多列 | FROM 子句 |

## 标量子查询

返回单个值，最常用的子查询类型。

### 基本用法

```sql
-- 查比平均分高的学生
SELECT name, score
FROM student
WHERE score > (SELECT AVG(score) FROM student);

-- 查成绩最高的学生
SELECT name, score
FROM student
WHERE score = (SELECT MAX(score) FROM student);

-- 查班级名称（通过班级 id 子查询）
SELECT name FROM class
WHERE id = (SELECT class_id FROM student WHERE name = '张三');
```

### 标量子查询的坑

子查询返回多行会报错：

```sql
-- ERROR: Subquery returns more than 1 row
SELECT name, score
FROM student
WHERE score = (SELECT score FROM student WHERE class_id = 1);
-- 如果 class_id=1 的学生有多个成绩，这里会报错
```

## 列子查询

返回一列多行，配合 IN / NOT IN / ALL / ANY 使用。

### IN / NOT IN

```sql
-- 查选修课程编号为 1 或 3 的学生
SELECT * FROM student
WHERE id IN (
    SELECT student_id FROM enrollment
    WHERE course_id IN (1, 3)
);
```

### ALL

`ALL` 表示「所有」，常与比较运算符组合：

```sql
-- 查成绩比班级 1 所有学生都高的学生
SELECT * FROM student
WHERE score > ALL (
    SELECT score FROM student WHERE class_id = 1
);
```

`> ALL(子查询)` = 比子查询结果中的所有值都大 = 比最大值还大

### ANY / SOME

`ANY`（别名 SOME）表示「任意一个」：

```sql
-- 查成绩比班级 1 任一学生高的学生
SELECT * FROM student
WHERE score > ANY (
    SELECT score FROM student WHERE class_id = 1
);
```

`> ANY(子查询)` = 比子查询结果中的任意一个值大 = 比最小值大

### ALL/ANY 速查表

| 表达式 | 等价于 |
|--------|--------|
| `> ALL (子查询)` | 比最大值更大 |
| `> ANY (子查询)` | 比最小值更大 |
| `< ALL (子查询)` | 比最小值更小 |
| `< ANY (子查询)` | 比最大值更小 |
| `= ANY (子查询)` | 等价于 IN |

## EXISTS / NOT EXISTS

判断子查询是否有返回结果，不关心具体内容：

```sql
-- 查有选修课程的学生（方式一：IN）
SELECT * FROM student s
WHERE s.id IN (SELECT student_id FROM enrollment);

-- 查有选修课程的学生（方式二：EXISTS）
SELECT * FROM student s
WHERE EXISTS (
    SELECT 1 FROM enrollment e WHERE e.student_id = s.id
);
```

**IN vs EXISTS 的区别**：
- `IN` 先执行子查询，再查主表
- `EXISTS` 先查主表，对每行执行子查询（可用索引时更高效）
- 当子查询结果集小、主表大时用 IN
- 当主表小、子查询结果集大时用 EXISTS

## 行子查询

返回一行多列，可以和行构造器比较：

```sql
-- 查出成绩和班级都与张三相同的学生
SELECT * FROM student
WHERE (score, class_id) = (
    SELECT score, class_id FROM student WHERE name = '张三'
);
```

## FROM 子句中的子查询（派生表）

子查询结果当成一张临时表：

```sql
-- 查询每个班级高于平均分的学生
SELECT s.*
FROM student s
JOIN (
    SELECT class_id, AVG(score) AS avg_score
    FROM student GROUP BY class_id
) AS t ON s.class_id = t.class_id
WHERE s.score > t.avg_score;
```

派生表必须取别名。

## 综合实战

### 查询每门课成绩最高的学生

```sql
SELECT s.name, e.course_id, e.score
FROM student s
JOIN enrollment e ON s.id = e.student_id
WHERE e.score = (
    SELECT MAX(score) FROM enrollment WHERE course_id = e.course_id
);
```

### 查询选修了所有课程的学生

```sql
-- 选修了全部 3 门课的学生
SELECT s.*
FROM student s
WHERE NOT EXISTS (
    SELECT course_id FROM course c
    WHERE NOT EXISTS (
        SELECT 1 FROM enrollment e
        WHERE e.student_id = s.id AND e.course_id = c.id
    )
);
```

这道题用到了「双重否定」技巧——如果不存在「一门课没被选修」，那说明全部课都选了。

## 下一步

接下来看 [多行子查询 / 相关子查询](/database/mysql/sql/subquery/multi-row-correlated)。
  contents="# MySQL 8.0 新特性（窗口函数 / 公用表表达式）

## 窗口函数（Window Functions）

窗口函数是 MySQL 8.0 引入的最重要的新特性。它在**不分组**的情况下，对一组行进行计算，同时**保留所有原始行**。

### 聚合函数 vs 窗口函数

```sql
-- 聚合查询：每组返回一行，原来的行消失了
SELECT class_id, AVG(score) AS avg_score
FROM student GROUP BY class_id;

-- 窗口查询：每行都保留，同时看到班级平均分
SELECT
    name,
    class_id,
    score,
    AVG(score) OVER (PARTITION BY class_id) AS class_avg
FROM student;
```

### 基本语法

```sql
函数名() OVER (
    PARTITION BY 列        -- 分组（类似 GROUP BY，但不合并行）
    ORDER BY 列            -- 排序
    ROWS/RANGE BETWEEN ... -- 窗口范围
)
```

### 常用窗口函数

#### 排名函数

```sql
SELECT
    name,
    score,
    ROW_NUMBER() OVER (ORDER BY score DESC) AS row_num,    -- 1,2,3,4...（无并列）
    RANK()       OVER (ORDER BY score DESC) AS rank_num,   -- 1,1,3,4...（有并列，跳过）
    DENSE_RANK() OVER (ORDER BY score DESC) AS dense_rank  -- 1,1,2,3...（有并列，不跳过）
FROM student;
```

#### 聚合窗口函数

SUM、AVG、COUNT、MAX、MIN 都可以作为窗口函数使用：

```sql
SELECT
    name,
    score,
    SUM(score)   OVER (PARTITION BY class_id) AS class_sum,
    AVG(score)   OVER (PARTITION BY class_id) AS class_avg,
    COUNT(*)     OVER (PARTITION BY class_id) AS class_cnt,
    MAX(score)   OVER (PARTITION BY class_id) AS class_max,
    MIN(score)   OVER (PARTITION BY class_id) AS class_min
FROM student;
```

#### LAG / LEAD（前后行）

```sql
SELECT
    name,
    score,
    LAG(score)  OVER (ORDER BY score DESC) AS prev_score,  -- 上一行的值
    LEAD(score) OVER (ORDER BY score DESC) AS next_score   -- 下一行的值
FROM student;
```

#### FIRST_VALUE / LAST_VALUE / NTH_VALUE

```sql
SELECT
    name,
    score,
    FIRST_VALUE(score) OVER (PARTITION BY class_id ORDER BY score) AS first_score,
    LAST_VALUE(score)  OVER (PARTITION BY class_id ORDER BY score) AS last_score,
    NTH_VALUE(score, 2) OVER (PARTITION BY class_id ORDER BY score) AS second_score
FROM student;
```

### 窗口范围（ROWS / RANGE）

默认窗口是当前分区内的所有行：

```sql
-- ROWS BETWEEN：按物理行数计算
SELECT
    name,
    score,
    AVG(score) OVER (
        ORDER BY score
        ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING  -- 当前行 ± 1 行
    ) AS moving_avg_3
FROM student;

-- RANGE BETWEEN：按值范围计算
SELECT
    name,
    score,
    SUM(score) OVER (
        ORDER BY score
        RANGE BETWEEN 10 PRECEDING AND CURRENT ROW  -- 值在当前值-10 到当前值之间
    ) AS running_sum
FROM student;
```

常用范围关键字：
- `UNBOUNDED PRECEDING`：从分区开头开始
- `CURRENT ROW`：当前行
- `n PRECEDING`：`n` 行之前
- `n FOLLOWING`：`n` 行之后
- `UNBOUNDED FOLLOWING`：到分区结尾

### 窗口函数 vs 分组

| 特性 | GROUP BY | 窗口函数 |
|------|---------|---------|
| 返回行数 | 减少 | 保持不变 |
| 原行保留 | ❌ 不保留 | ✅ 保留 |
| 去重 | ✅ 可以 | ❌ 不去重 |
| 灵活性 | 低 | 高 |

## 公用表表达式（CTE）

CTE（Common Table Expression）是一个**命名临时结果集**，可以在查询中重复引用。

### 普通 CTE（WITH 子句）

```sql
WITH
    class_avg AS (
        SELECT class_id, AVG(score) AS avg_score
        FROM student GROUP BY class_id
    ),
    class_max AS (
        SELECT class_id, MAX(score) AS max_score
        FROM student GROUP BY class_id
    )
SELECT
    s.*,
    c.avg_score,
    c.max_score,
    s.score - c.avg_score AS diff_from_avg
FROM student s
JOIN class_avg c ON s.class_id = c.class_id
JOIN class_max m ON s.class_id = m.class_id;
```

### 递归 CTE

递归 CTE 可以生成序列或遍历层级数据：

```sql
-- 生成 1~10 的数列
WITH RECURSIVE seq (n) AS (
    SELECT 1
    UNION ALL
    SELECT n + 1 FROM seq WHERE n < 10
)
SELECT * FROM seq;

-- 遍历员工层级（从根节点向下）
WITH RECURSIVE org_tree AS (
    -- 根节点
    SELECT id, name, manager_id, 1 AS level
    FROM employee WHERE manager_id IS NULL

    UNION ALL

    -- 递归：找下级
    SELECT e.id, e.name, e.manager_id, ot.level + 1
    FROM employee e
    JOIN org_tree ot ON e.manager_id = ot.id
)
SELECT * FROM org_tree ORDER BY level, id;
```

递归 CTE 的结构：
1. **锚点（Anchor）**：起点查询
2. **UNION ALL**：连接递归查询
3. **递归部分**：引用 CTE 自身

### CTE vs 子查询

| 方面 | CTE | 子查询 |
|------|-----|--------|
| 可读性 | 高（有名字，可重复引用） | 较低（嵌套深） |
| 性能 | 相同（MySQL 内部优化相同） | 相同 |
| 递归支持 | ✅ 支持 | ❌ 不支持 |
| 适用场景 | 复杂查询、可复用逻辑 | 简单一次性查询 |

## MySQL 8.0 其他新特性（SQL 相关）

### 跳跃窗口函数支持

```sql
-- 计算百分比排名
SELECT
    name,
    score,
    PERCENT_RANK() OVER (ORDER BY score) AS pct_rank,
    CUME_DIST()    OVER (ORDER BY score) AS cum_dist
FROM student;
```

### 更多窗口函数

```sql
SELECT
    name,
    score,
    -- 窗口内占比
    score / SUM(score) OVER () AS pct_of_total,
    -- 是否为窗口内第一行/最后一行
    CASE
        WHEN ROW_NUMBER() OVER (PARTITION BY class_id ORDER BY score DESC) = 1
        THEN '班级第一'
        ELSE ''
    END AS top_in_class
FROM student;
```

## 下一步

SQL 核心语法部分到此结束。接下来进入 [数据库对象管理](/database/mysql/object/db)——建表、管理数据、约束、视图、存储过程。
 />

# 列别名 / 去重 / NULL / 排序（DESC）

## 列别名（AS）

给列起一个更友好的名字，让查询结果更容易理解：

```sql
SELECT
    name AS '姓名',
    age  AS '年龄',
    score AS '成绩'
FROM student;
```

`AS` 关键字可以省略，效果一样：

```sql
SELECT
    name '姓名',
    age  '年龄'
FROM student;
```

别名在 ORDER BY 中可以使用（因为 ORDER BY 在 SELECT 之后执行），但在 WHERE 中不能使用。

```sql
-- 在 ORDER BY 中使用别名：正确
SELECT name, score AS s FROM student ORDER BY s DESC;

-- 在 WHERE 中使用别名：错误
SELECT name, score AS s FROM student WHERE s > 80;  -- ERROR
```

## 去重（DISTINCT）

去掉重复的行：

```sql
SELECT DISTINCT class_id FROM student;
-- 返回：1, 2, 3（去掉重复值）
```

DISTINCT 作用于所有 SELECT 后的列组合，只有所有列都相同才算重复：

```sql
SELECT DISTINCT class_id, gender FROM student;
```

## NULL 的处理

NULL 表示「未知」或「缺失」，它不是 0，也不是空字符串。

### NULL 的特点

```sql
-- NULL 与任何值比较，结果都是 UNKNOWN（不是 TRUE）
SELECT * FROM student WHERE NULL = NULL;       -- 无结果
SELECT * FROM student WHERE NULL IS NULL;      -- 有结果
```

### IFNULL / COALESCE（NULL 替换）

```sql
-- IFNULL：两个参数，NULL 时替换成第一个参数
SELECT name, IFNULL(score, 0) AS score FROM student;

-- COALESCE：多个参数，返回第一个非 NULL 值
SELECT name, COALESCE(score, exam, homework, 0) AS final_score FROM student;
```

### NULL 在聚合函数中的行为

| 函数 | 行为 |
|------|------|
| `COUNT(*)` | 计入 NULL 行 |
| `COUNT(col)` | 忽略 NULL 行 |
| `SUM(col)` | 忽略 NULL 行 |
| `AVG(col)` | 忽略 NULL 行 |

## 排序（ORDER BY）

### ASC 升序（默认）

```sql
SELECT * FROM student ORDER BY score ASC;
```

### DESC 降序

```sql
SELECT * FROM student ORDER BY score DESC;
```

### 多列排序

```sql
-- 先按班级排序（升序），同班级内按成绩排序（降序）
SELECT * FROM student ORDER BY class_id ASC, score DESC;
```

### 排序中使用表达式和别名

```sql
-- 按计算结果排序
SELECT name, score, (score + 10) AS adjusted
FROM student
ORDER BY adjusted DESC;
```

### NULL 值的排序顺序

默认 NULL 排在最前面（升序）或最后面（降序）：

```sql
-- 强制把 NULL 排到最后
SELECT * FROM student ORDER BY ISNULL(score), score ASC;
```

## 下一步

接下来学习 [运算符](/database/mysql/sql/basic/operator/arithmetic)。

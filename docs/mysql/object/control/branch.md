# 分支结构（IF / CASE）

## IF 条件判断

### 基本语法

```sql
IF 条件 THEN
    语句块;
[ELSEIF 条件 THEN
    语句块;]
[ELSE
    语句块;]
END IF;
```

### 示例：评分函数

```sql
DELIMITER //
CREATE FUNCTION get_grade(score DECIMAL(5,2))
RETURNS VARCHAR(10)
BEGIN
    IF score >= 90 THEN
        RETURN 'A';
    ELSEIF score >= 80 THEN
        RETURN 'B';
    ELSEIF score >= 60 THEN
        RETURN 'C';
    ELSE
        RETURN 'D';
    END IF;
END//
DELIMITER ;
```

### 示例：存储过程中的 IF

```sql
DELIMITER //
CREATE PROCEDURE update_student_status(
    IN p_id BIGINT,
    IN p_score DECIMAL(5,2)
)
BEGIN
    IF p_score >= 60 THEN
        UPDATE student SET is_passed = 1 WHERE id = p_id;
    ELSE
        UPDATE student SET is_passed = 0 WHERE id = p_id;
    END IF;
END//
DELIMITER ;
```

### IFNULL 和 IF 的区别

```sql
-- IFNULL：处理 NULL 值
IFNULL(expr1, expr2)
-- 等价于：
IF(expr1 IS NOT NULL, expr1, expr2)

-- IF：处理布尔条件
IF(条件, 为TRUE, 为FALSE)
```

```sql
-- 用 IFNULL 处理可能的 NULL
SELECT IFNULL(score, 0) + 10 FROM student;

-- 用 IF 处理布尔条件
SELECT IF(score >= 60, '及格', '不及格') FROM student;
```

## CASE 表达式

### 语法一：简单 CASE（等值匹配）

```sql
CASE 表达式
    WHEN 值1 THEN 结果1
    WHEN 值2 THEN 结果2
    [WHEN ...]
    [ELSE 结果n]
END
```

```sql
SELECT
    name,
    score,
    CASE status
        WHEN 1 THEN '待支付'
        WHEN 2 THEN '已支付'
        WHEN 3 THEN '已取消'
        ELSE '未知状态'
    END AS status_name
FROM `order`;
```

### 语法二：搜索 CASE（条件匹配）

```sql
CASE
    WHEN 条件1 THEN 结果1
    WHEN 条件2 THEN 结果2
    [WHEN ...]
    [ELSE 结果n]
END
```

```sql
SELECT
    name,
    score,
    CASE
        WHEN score >= 90 THEN 'A'
        WHEN score >= 80 THEN 'B'
        WHEN score >= 60 THEN 'C'
        ELSE 'D'
    END AS grade
FROM student;
```

### CASE 嵌套

```sql
CASE
    WHEN score >= 90 THEN
        CASE
            WHEN age < 18 THEN 'A-青少年'
            ELSE 'A-成年'
        END
    WHEN score >= 60 THEN 'B'
    ELSE 'C'
END
```

## CASE vs IF 对比

| 方面 | IF | CASE |
|------|----|------|
| 语法 | `IF(cond, t, f)` 或 `IF...THEN...END IF` | `CASE...WHEN...END` |
| 等值匹配 | 较繁琐 | 简洁直观 |
| 范围匹配 | 适合 | 适合 |
| 可读性 | 简单条件更清晰 | 多条件更清晰 |
| 性能 | 无差异 | 无差异 |

## 流程控制的完整示例

```sql
DELIMITER //
CREATE PROCEDURE evaluate_student(
    IN p_id BIGINT,
    OUT p_result VARCHAR(100)
)
BEGIN
    DECLARE v_score DECIMAL(5,2);
    DECLARE v_age   INT;
    DECLARE v_grade CHAR(1);

    -- 取数据
    SELECT score, age INTO v_score, v_age
    FROM student WHERE id = p_id;

    -- 计算等级
    IF v_score >= 90 THEN
        SET v_grade = 'A';
    ELSEIF v_score >= 80 THEN
        SET v_grade = 'B';
    ELSEIF v_score >= 60 THEN
        SET v_grade = 'C';
    ELSE
        SET v_grade = 'D';
    END IF;

    -- 综合评价
    IF v_grade IN ('A', 'B') AND v_age >= 18 THEN
        SET p_result = CONCAT('优秀成年学生，等级: ', v_grade);
    ELSEIF v_grade = 'C' THEN
        SET p_result = CONCAT('成绩中等，等级: ', v_grade);
    ELSE
        SET p_result = CONCAT('需要努力，等级: ', v_grade);
    END IF;
END//
DELIMITER ;
```

## 下一步

分支结构学完了，接下来学习 [循环结构（LOOP/WHILE/REPEAT）](/database/mysql/object/control/loop)——循环处理批量数据。

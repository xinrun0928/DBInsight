# 存储函数（创建 / 调用 / 区别于存储过程）

## 存储函数是什么

**存储函数（Stored Function）** 是 MySQL 预编译的 SQL 代码片段，可以像内置函数一样在 SQL 表达式中使用。

```sql
-- 定义一个计算等级的函数
DELIMITER //
CREATE FUNCTION get_grade(score DECIMAL(5,2))
RETURNS VARCHAR(10)
BEGIN
    IF score >= 90 THEN RETURN 'A';
    ELSEIF score >= 80 THEN RETURN 'B';
    ELSEIF score >= 60 THEN RETURN 'C';
    ELSE RETURN 'D';
    END IF;
END//
DELIMITER ;

-- 在查询中使用（像内置函数一样）
SELECT name, score, get_grade(score) AS grade FROM student;
```

## 创建存储函数

### 基本语法

```sql
CREATE FUNCTION function_name([参数列表])
RETURNS 返回类型
BEGIN
    -- 函数体，必须有 RETURN 语句
    RETURN 值;
END
```

### 无参函数

```sql
DELIMITER //
CREATE FUNCTION get_total_students()
RETURNS INT
BEGIN
    DECLARE total INT;
    SELECT COUNT(*) INTO total FROM student;
    RETURN total;
END//
DELIMITER ;

-- 调用
SELECT get_total_students() AS 学生总数;
```

### 带参函数

```sql
DELIMITER //
CREATE FUNCTION get_student_rank(s_id BIGINT)
RETURNS INT
BEGIN
    DECLARE rank_val INT;
    SELECT COUNT(*) + 1 INTO rank_val
    FROM student
    WHERE score > (SELECT score FROM student WHERE id = s_id);
    RETURN rank_val;
END//
DELIMITER ;
```

## 存储函数 vs 存储过程

| 方面 | 存储函数 | 存储过程 |
|------|---------|---------|
| 返回值 | ✅ 必须有 `RETURNS` 和 `RETURN` | ❌ 没有返回值 |
| 调用方式 | 在 SQL 表达式中调用 | 用 `CALL` 调用 |
| 参数模式 | 只能是 `IN` | `IN`/`OUT`/`INOUT` |
| 事务控制 | 不能有 `START TRANSACTION` | 可以有 |
| 使用场景 | 计算、转换 | 复杂业务操作 |
| DML 语句 | 不能包含修改数据的语句 | 可以 |

## 存储函数的使用限制

MySQL 的存储函数有较多限制：

```sql
-- ❌ 不能调用存储过程
CREATE FUNCTION f1() RETURNS INT
BEGIN
    CALL some_procedure();  -- ERROR
    RETURN 0;
END;

-- ❌ 不能有 OUT 参数
CREATE FUNCTION f2(OUT x INT) RETURNS INT  -- ERROR
BEGIN
    SET x = 10;
    RETURN x;
END;

-- ❌ 不能修改数据（MySQL 5.7 严格模式）
CREATE FUNCTION f3() RETURNS INT
BEGIN
    UPDATE student SET score = 0;  -- ERROR in MySQL 5.7
    RETURN 0;
END;
```

## 查看和删除

```sql
-- 查看所有存储函数
SHOW FUNCTION STATUS LIKE 'get_%';

-- 查看函数定义
SHOW CREATE FUNCTION get_total_students;

-- 删除函数
DROP FUNCTION IF EXISTS get_total_students;
```

## 实际应用场景

### 场景一：数据格式化

```sql
DELIMITER //
CREATE FUNCTION format_phone(p VARCHAR(20))
RETURNS VARCHAR(20)
BEGIN
    IF p IS NULL OR LENGTH(p) < 11 THEN
        RETURN p;
    END IF;
    RETURN CONCAT(LEFT(p, 3), '****', RIGHT(p, 4));
END//
DELIMITER ;

-- 手机号脱敏
SELECT name, format_phone(phone) AS phone FROM user;
```

### 场景二：业务计算

```sql
DELIMITER //
CREATE FUNCTION calc_bonus(salary DECIMAL(10,2), rating INT)
RETURNS DECIMAL(10,2)
BEGIN
    CASE rating
        WHEN 1 THEN RETURN salary * 0.5;
        WHEN 2 THEN RETURN salary * 0.3;
        WHEN 3 THEN RETURN salary * 0.1;
        ELSE RETURN 0;
    END CASE;
END//
DELIMITER ;
```

### 场景三：条件检查

```sql
DELIMITER //
CREATE FUNCTION is_valid_score(s DECIMAL(5,2))
RETURNS TINYINT(1)
BEGIN
    RETURN s >= 0 AND s <= 100;
END//
DELIMITER ;

-- 在 INSERT 触发器中使用
CREATE TRIGGER check_score_insert
BEFORE INSERT ON student
FOR EACH ROW
BEGIN
    IF NOT is_valid_score(NEW.score) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Score must be between 0 and 100';
    END IF;
END;
```

## 下一步

存储函数学完了，接下来学习 [变量与流程控制](/database/mysql/object/variable)——系统变量、用户变量、局部变量，以及 IF、CASE、LOOP、WHILE、REPEAT 等流程控制结构。

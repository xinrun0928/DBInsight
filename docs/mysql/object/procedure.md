# 存储过程（创建 / 调用 / 修改 / 删除）

## 什么是存储过程

**存储过程（Stored Procedure）** 是保存在数据库中的一组预编译的 SQL 语句，类似于编程语言中的「函数」。

```sql
-- 调用存储过程
CALL add_student('张三', 18, 85.5);
```

与普通 SQL 的区别：

| 方面 | 普通 SQL | 存储过程 |
|------|---------|---------|
| 存储位置 | 应用代码中 | 数据库中 |
| 编译 | 每次执行都要解析 | 预编译，缓存复用 |
| 网络开销 | 每条 SQL 一次网络往返 | 一次调用，多条 SQL |
| 事务控制 | 应用层管理 | 可以在过程内管理 |

## 创建存储过程

### 基本语法

```sql
DELIMITER //
CREATE PROCEDURE procedure_name([参数列表])
BEGIN
    -- SQL 语句
END//
DELIMITER ;
```

> `DELIMITER` 用于改变语句分隔符，因为在过程体内部要用 `;` 作为 SQL 语句的分隔符，避免和 `CREATE PROCEDURE` 冲突。

### 无参数存储过程

```sql
DELIMITER //
CREATE PROCEDURE get_all_students()
BEGIN
    SELECT * FROM student;
END//
DELIMITER ;
```

### 调用存储过程

```sql
CALL get_all_students();
```

## 参数类型

存储过程的参数有三种模式：

| 模式 | 说明 | 效果 |
|------|------|------|
| `IN`（默认） | 输入参数 | 传入值给过程 |
| `OUT` | 输出参数 | 过程返回值 |
| `INOUT` | 输入输出参数 | 既传入又传出 |

### IN 参数

```sql
DELIMITER //
CREATE PROCEDURE get_student_by_id(IN sid BIGINT)
BEGIN
    SELECT * FROM student WHERE id = sid;
END//
DELIMITER ;

CALL get_student_by_id(1);
```

### OUT 参数

```sql
DELIMITER //
CREATE PROCEDURE get_student_count(OUT cnt INT)
BEGIN
    SELECT COUNT(*) INTO cnt FROM student;
END//
DELIMITER ;

-- 调用并接收返回值
CALL get_student_count(@total);
SELECT @total;  -- 查看返回值
```

### INOUT 参数

```sql
DELIMITER //
CREATE PROCEDURE increment_score(INOUT score DECIMAL(5,2), IN delta DECIMAL(5,2))
BEGIN
    SET score = score + delta;
END//
DELIMITER ;

SET @s = 80.0;
CALL increment_score(@s, 5.0);
SELECT @s;  -- 85.0
```

## 局部变量

```sql
DELIMITER //
CREATE PROCEDURE calculate_stats()
BEGIN
    DECLARE avg_score_val DECIMAL(5,2);
    DECLARE max_score_val DECIMAL(5,2);

    SELECT AVG(score), MAX(score) INTO avg_score_val, max_score_val
    FROM student;

    SELECT avg_score_val AS 平均分, max_score_val AS 最高分;
END//
DELIMITER ;
```

## 条件判断

```sql
DELIMITER //
CREATE PROCEDURE get_grade(IN s DECIMAL(5,2), OUT grade VARCHAR(10))
BEGIN
    IF s >= 90 THEN
        SET grade = 'A';
    ELSEIF s >= 80 THEN
        SET grade = 'B';
    ELSEIF s >= 60 THEN
        SET grade = 'C';
    ELSE
        SET grade = 'D';
    END IF;
END//
DELIMITER ;

-- 调用
CALL get_grade(85.5, @g);
SELECT @g;  -- B
```

## 循环

```sql
-- 循环插入 100 条数据
DELIMITER //
CREATE PROCEDURE batch_insert()
BEGIN
    DECLARE i INT DEFAULT 1;
    WHILE i <= 100 DO
        INSERT INTO student (name, score) VALUES (CONCAT('学生', i), 80 + i);
        SET i = i + 1;
    END WHILE;
END//
DELIMITER ;
```

## 事务中的存储过程

```sql
DELIMITER //
CREATE PROCEDURE transfer_money(
    IN from_id BIGINT,
    IN to_id BIGINT,
    IN amount DECIMAL(12,2)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SELECT 'Transaction rolled back' AS result;
    END;

    START TRANSACTION;
    UPDATE account SET balance = balance - amount WHERE id = from_id;
    UPDATE account SET balance = balance + amount WHERE id = to_id;
    COMMIT;
    SELECT 'Transfer completed' AS result;
END//
DELIMITER ;
```

> `DECLARE EXIT HANDLER` 捕获异常，确保事务在任何错误发生时都能回滚。

## 查看存储过程

```sql
-- 查看所有存储过程
SHOW PROCEDURE STATUS LIKE 'add_%';

-- 查看存储过程定义
SHOW CREATE PROCEDURE get_student_count;
```

## 删除存储过程

```sql
DROP PROCEDURE IF EXISTS get_student_count;
```

## 修改存储过程

MySQL 不支持直接修改存储过程，只能 `DROP + CREATE`：

```sql
DROP PROCEDURE IF EXISTS procedure_name;
-- 然后重新写 CREATE PROCEDURE
```

## 存储过程的争议

| 场景 | 是否使用存储过程 |
|------|---------------|
| 简单 CRUD | ❌ 不需要，应用层更灵活 |
| 批量数据处理 | ✅ 可以，减少网络往返 |
| 复杂业务逻辑 | ✅ 可以，保证事务一致性 |
| 高并发 API | ❌ 不推荐，难以扩展和维护 |
| 跨多个应用调用 | ✅ 可以，一处编写多处调用 |

> **阿里规范**：禁止在存储过程中写复杂业务逻辑，禁止在存储过程中调用其他存储过程。

## 下一步

存储过程学完了，接下来学习 [存储函数（创建/调用/区别于存储过程）](/database/mysql/object/function)。

# LEAVE / ITERATE / 游标 / 错误处理

## LEAVE 和 ITERATE

这两个语句在上一章「循环结构」中已经介绍过，这里做一个小结。

```sql
-- LEAVE：退出标签指定的代码块（类似 break）
outer_block: BEGIN
    IF done THEN
        LEAVE outer_block;
    END IF;
END

-- ITERATE：跳过本次迭代，继续下一次（类似 continue）
my_loop: LOOP
    SET i = i + 1;
    IF i % 2 = 0 THEN
        ITERATE my_loop;  -- 偶数跳过，只处理奇数
    END IF;
    -- 处理 i 的逻辑
END LOOP;
```

## 游标（CURSOR）

游标是**逐行处理查询结果集**的机制。MySQL 的存储过程和函数本身返回的是结果集，如果要逐行处理结果，需要用游标。

### 游标的使用步骤

```sql
1. 声明游标：DECLARE cursor_name CURSOR FOR SELECT ...
2. 打开游标：OPEN cursor_name
3. 获取数据：FETCH cursor_name INTO var_list
4. 关闭游标：CLOSE cursor_name
5. 释放游标：DEALLOCATE PREPARE cursor_name
```

### 游标示例：遍历学生表

```sql
DELIMITER //
CREATE PROCEDURE process_students()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_id   BIGINT;
    DECLARE v_name VARCHAR(50);
    DECLARE v_score DECIMAL(5,2);

    -- 1. 声明游标
    DECLARE student_cursor CURSOR FOR
        SELECT id, name, score FROM student;

    -- 2. 声明继续处理器
    -- 当没有更多行时，将 done 设为 TRUE
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    -- 3. 打开游标
    OPEN student_cursor;

    -- 4. 逐行获取
    read_loop: LOOP
        FETCH student_cursor INTO v_id, v_name, v_score;
        IF done THEN
            LEAVE read_loop;
        END IF;
        -- 处理每一行数据
        -- 例如：给成绩 >= 90 的学生发证书
        IF v_score >= 90 THEN
            INSERT INTO certificate (student_id, issued_at)
            VALUES (v_id, NOW());
        END IF;
    END LOOP read_loop;

    -- 5. 关闭游标
    CLOSE student_cursor;
END//
DELIMITER ;
```

### 游标与 CONTINUE HANDLER

HANDLER 有两种类型：

```sql
-- CONTINUE：继续执行（常用）
DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

-- EXIT：退出当前 BEGIN...END 块
DECLARE EXIT HANDLER FOR NOT FOUND BEGIN
    -- 清理资源
    CLOSE cursor_name;
END;
```

### 游标的性能注意

游标是**逐行处理**，大结果集上性能很差。如果能用 SQL 批量操作（如 INSERT...SELECT），就不要用游标。

## 错误处理（HANDLER）

MySQL 的错误处理通过 DECLARE HANDLER 实现。

### HANDLER 条件

```sql
DECLARE handler_type HANDLER FOR 条件值
    处理语句;
```

| 条件值 | 说明 |
|--------|------|
| `SQLSTATE '错误码'` | 标准 SQL 错误码，如 `'02000'`（NOT FOUND） |
| `MySQL 错误码` | MySQL 特定错误码，如 `1329` |
| `condition_name` | 之前 DECLARE 的条件名 |
| `SQLWARNING` | 所有 01xxx 警告 |
| `NOT FOUND` | 所有 02xxx 未找到数据 |
| `SQLEXCEPTION` | 所有其他错误 |

### 常见 HANDLER 写法

```sql
-- 当没找到数据时，退出存储过程
DECLARE EXIT HANDLER FOR NOT FOUND
BEGIN
    SELECT 'No data found' AS message;
END;

-- 当出现 SQL 异常时，回滚并返回错误
DECLARE EXIT HANDLER FOR SQLEXCEPTION
BEGIN
    ROLLBACK;
    SELECT 'An error occurred' AS message;
END;

-- 当出现特定错误时自定义处理
DECLARE EXIT HANDLER FOR 1062  -- Duplicate entry
BEGIN
    SELECT 'Duplicate key error' AS message;
END;
```

### 自定义条件名

```sql
DECLARE custom_condition CONDITION FOR SQLSTATE '23000';
DECLARE EXIT HANDLER FOR custom_condition
BEGIN
    ROLLBACK;
    SELECT 'Data integrity error' AS message;
END;
```

### 事务回滚中的 HANDLER

```sql
DELIMITER //
CREATE PROCEDURE safe_transfer(
    IN from_id BIGINT,
    IN to_id BIGINT,
    IN amount DECIMAL(12,2)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SELECT 'Transfer failed and rolled back' AS result;
    END;

    START TRANSACTION;
    UPDATE account SET balance = balance - amount WHERE id = from_id;
    UPDATE account SET balance = balance + amount WHERE id = to_id;
    COMMIT;
    SELECT 'Transfer successful' AS result;
END//
DELIMITER ;
```

## 综合示例：用游标、HANDLER 和事务处理批量数据

```sql
DELIMITER //
CREATE PROCEDURE adjust_scores()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_id    BIGINT;
    DECLARE v_score DECIMAL(5,2);

    DECLARE student_cursor CURSOR FOR
        SELECT id, score FROM student WHERE score < 60;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    START TRANSACTION;

    OPEN student_cursor;
    read_loop: LOOP
        FETCH student_cursor INTO v_id, v_score;
        IF done THEN
            LEAVE read_loop;
        END IF;
        -- 给不及格学生加 10 分（最多加到 60）
        IF v_score + 10 >= 60 THEN
            UPDATE student SET score = 60.0 WHERE id = v_id;
        ELSE
            UPDATE student SET score = score + 10 WHERE id = v_id;
        END IF;
    END LOOP read_loop;
    CLOSE student_cursor;

    COMMIT;
END//
DELIMITER ;
```

## 下一步

游标和错误处理学完了，接下来学习 [触发器（创建/查看/删除）](/database/mysql/object/trigger)。

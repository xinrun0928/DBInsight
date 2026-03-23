# 循环结构（LOOP / WHILE / REPEAT）

## LOOP 循环

LOOP 是最基础的循环结构，需要配合 LEAVE 退出。

```sql
-- 标签
[标签名:] LOOP
    -- 循环体
    IF 条件 THEN
        LEAVE 标签名;  -- 退出循环
    END IF;
END LOOP;
```

### 示例：用 LOOP 实现 1~100 求和

```sql
DELIMITER //
CREATE FUNCTION sum_to_100()
RETURNS BIGINT
BEGIN
    DECLARE total BIGINT DEFAULT 0;
    DECLARE i     INT DEFAULT 1;

    my_loop: LOOP
        SET total = total + i;
        SET i = i + 1;
        IF i > 100 THEN
            LEAVE my_loop;
        END IF;
    END LOOP my_loop;

    RETURN total;
END//
DELIMITER ;

SELECT sum_to_100();  -- 5050
```

## WHILE 循环

WHILE 在**每次迭代前**判断条件，条件为真才执行循环体。

```sql
WHILE 条件 DO
    -- 循环体
END WHILE;
```

### 示例：批量插入数据

```sql
DELIMITER //
CREATE PROCEDURE batch_insert_students(IN count INT)
BEGIN
    DECLARE i INT DEFAULT 1;

    WHILE i <= count DO
        INSERT INTO student (name, score) VALUES (CONCAT('学生', i), 80 + i);
        SET i = i + 1;
    END WHILE;
END//
DELIMITER ;

CALL batch_insert_students(100);
```

## REPEAT 循环

REPEAT 在**每次迭代后**判断条件，条件为真时**退出**。

```sql
REPEAT
    -- 循环体
UNTIL 条件 END REPEAT;
```

### 示例：用 REPEAT 实现 1~100 求和

```sql
DELIMITER //
CREATE FUNCTION sum_to_100_repeat()
RETURNS BIGINT
BEGIN
    DECLARE total BIGINT DEFAULT 0;
    DECLARE i     INT DEFAULT 1;

    REPEAT
        SET total = total + i;
        SET i = i + 1;
    UNTIL i > 100 END REPEAT;

    RETURN total;
END//
DELIMITER ;
```

## 三种循环对比

| 特性 | LOOP | WHILE | REPEAT |
|------|------|-------|--------|
| 循环条件位置 | 中间（LEAVE 退出） | 开头 | 结尾 |
| 适用场景 | 需要手动控制退出 | 已知循环次数 | 至少执行一次 |
| 语法复杂度 | 较高（需要 LEAVE） | 中等 | 较低 |

## ITERATE（跳过本次迭代）

ITERATE 类似编程语言中的 `continue`，跳过当前迭代，继续下一次循环。

```sql
-- 跳过偶数，只处理奇数
my_loop: LOOP
    SET i = i + 1;
    IF i > 100 THEN
        LEAVE my_loop;
    END IF;
    IF i % 2 = 0 THEN
        ITERATE my_loop;  -- 跳过偶数，继续下一次
    END IF;
    -- 这里只处理奇数
    SET odd_sum = odd_sum + i;
END LOOP;
```

## LEAVE（退出循环）

```sql
outer_loop: LOOP
    -- 外层循环
    inner_loop: LOOP
        -- 内层循环
        IF 条件 THEN
            LEAVE inner_loop;  -- 只退出内层循环
        END IF;
    END LOOP inner_loop;

    IF 退出条件 THEN
        LEAVE outer_loop;  -- 退出外层循环
    END IF;
END LOOP outer_loop;
```

## 综合示例：斐波那契数列

```sql
DELIMITER //
CREATE PROCEDURE fibonacci(IN n INT)
BEGIN
    DECLARE i INT DEFAULT 3;
    DECLARE a BIGINT DEFAULT 0;
    DECLARE b BIGINT DEFAULT 1;
    DECLARE c BIGINT;

    -- 临时表存放结果
    DROP TEMPORARY TABLE IF EXISTS fib_result;
    CREATE TEMPORARY TABLE fib_result (seq INT, value BIGINT);
    INSERT INTO fib_result VALUES (1, 0);
    INSERT INTO fib_result VALUES (2, 1);

    IF n <= 2 THEN
        SELECT * FROM fib_result;
    ELSE
        WHILE i <= n DO
            SET c = a + b;
            INSERT INTO fib_result VALUES (i, c);
            SET a = b;
            SET b = c;
            SET i = i + 1;
        END WHILE;
        SELECT * FROM fib_result;
    END IF;
END//
DELIMITER ;

CALL fibonacci(10);
-- 输出：0, 1, 1, 2, 3, 5, 8, 13, 21, 34
```

## 下一步

循环结构学完了，接下来学习 [LEAVE / ITERATE / 游标 / 错误处理](/database/mysql/object/control/cursor-error)——游标遍历结果集和错误处理机制。

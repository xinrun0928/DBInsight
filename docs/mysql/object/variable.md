# 系统变量 / 用户变量 / 局部变量

## 三种变量的区别

| 类型 | 作用域 | 生命周期 | 语法 |
|------|--------|---------|------|
| **系统变量** | 全局或会话 | 持久或会话 | `@@global.var` / `@@session.var` |
| **用户变量** | 当前连接 | 连接断开前 | `@var_name` |
| **局部变量** | 存储过程/函数内部 | 语句块内 | `DECLARE var_name TYPE` |

## 系统变量

系统变量是 MySQL 服务器的配置参数。

### 全局 vs 会话

```sql
-- 全局变量：对所有连接生效（需要 SUPER 权限）
SET GLOBAL max_connections = 2000;

-- 会话变量：只对当前连接生效
SET SESSION sort_buffer_size = 1048576;

-- 默认是会话级别（不写 SESSION 关键字时）
SET sort_buffer_size = 1048576;
```

### 查看系统变量

```sql
-- 查看所有
SHOW VARIABLES;

-- 查看特定变量
SHOW VARIABLES LIKE 'max_connections';
SHOW VARIABLES LIKE '%size%';

-- 查看全局变量
SHOW GLOBAL VARIABLES LIKE 'max_connections';
```

### 常用系统变量

```sql
SELECT @@version;                 -- MySQL 版本
SELECT @@character_set_database;  -- 数据库默认字符集
SELECT @@autocommit;              -- 是否自动提交
SELECT @@tx_isolation;            -- 当前隔离级别
SELECT @@wait_timeout;            -- 空闲连接超时（秒）
SELECT @@max_allowed_packet;       -- 最大数据包大小
```

### 修改配置文件（永久生效）

`my.cnf` 或 `my.ini` 中配置：

```ini
[mysqld]
max_connections = 2000
wait_timeout = 28800
character-set-server = utf8mb4
```

## 用户变量

用户变量是当前连接的私有变量，不需要声明。

### 基本使用

```sql
-- 赋值（两种方式）
SET @name = '张三';
SET @age := 18;
SELECT @score := 85.5;  -- SELECT 赋值用 :=

-- 使用
SELECT @name, @age, @score;
```

### 在 SQL 中使用

```sql
SET @base_score = 60;
SELECT name, score FROM student WHERE score > @base_score;
```

### 用户变量的陷阱

```sql
-- 用户变量不预先声明类型，类型由最后一次赋值决定
SET @x = 1;      -- INT
SET @x = 'hello'; -- 现在是 VARCHAR

-- 用户变量在会话断开后自动销毁
-- 不同连接的用户变量互不影响

-- 用户变量的默认值是 NULL
SELECT @never_declared;  -- NULL
```

### 实战：排名计算

```sql
SET @prev_score = NULL;
SET @rank = 0;
SELECT
    name,
    score,
    @rank := IF(@prev_score = score, @rank, @rank + 1) AS rank,
    @prev_score := score
FROM student
ORDER BY score DESC;
```

## 局部变量

局部变量用在存储过程、函数、触发器内部。

### 声明和使用

```sql
DELIMITER //
CREATE PROCEDURE demo()
BEGIN
    -- 声明：DECLARE var_name TYPE [DEFAULT value]
    DECLARE v_name VARCHAR(50) DEFAULT 'unknown';
    DECLARE v_count INT;

    -- 赋值方式一：SET
    SET v_count = 10;

    -- 赋值方式二：SELECT INTO
    SELECT name INTO v_name FROM student WHERE id = 1;

    -- 使用
    SELECT v_name, v_count;
END//
DELIMITER ;
```

### DEFAULT 默认值

```sql
DECLARE v_status TINYINT DEFAULT 1;
DECLARE v_created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
```

### 变量与 SQL 参数

```sql
DELIMITER //
CREATE PROCEDURE find_student(IN s_name VARCHAR(50), OUT s_score DECIMAL(5,2))
BEGIN
    SELECT score INTO s_score FROM student WHERE name = s_name;
END//
DELIMITER ;

CALL find_student('张三', @s);
SELECT @s;
```

## 变量类型对比

```sql
-- 系统变量：MySQL 行为控制
SET @@autocommit = 0;

-- 用户变量：连接级状态
SET @counter = 0;
SET @counter = @counter + 1;  -- 可以自增（因为是字符串表达式）

-- 局部变量：过程级状态
DECLARE local_var INT;
SET local_var = 100;
```

## 下一步

变量学完了，接下来学习 [分支结构（IF/CASE）](/database/mysql/object/control/branch)——存储过程和函数中的条件判断。

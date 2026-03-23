# 约束分类 / 非空 / 唯一 / 主键 / AUTO_INCREMENT

## 什么是约束

**约束（Constraint）** 是 MySQL 强制数据正确性的机制。违反约束的操作会被直接拒绝。

约束在表定义时声明，可以是列级约束或表级约束：

```sql
-- 列级约束（写在列定义后）
CREATE TABLE demo1 (
    id INT PRIMARY KEY
);

-- 表级约束（所有列定义之后）
CREATE TABLE demo2 (
    id INT,
    name VARCHAR(50),
    PRIMARY KEY (id)
);
```

## NOT NULL（非空约束）

最基础的约束：列值不能为 NULL。

```sql
CREATE TABLE student (
    id   INT NOT NULL,          -- 主键不能为空
    name VARCHAR(50) NOT NULL, -- 姓名不能为空
    age  INT NULL              -- 年龄允许为空
);

INSERT INTO student (name) VALUES ('张三');  -- OK
INSERT INTO student (id) VALUES (NULL);     -- ERROR: Column 'id' cannot be null
```

> **注意**：NULL 不等于空字符串 `''`，也不等于 0。

## UNIQUE（唯一约束）

唯一约束：列值在整个表中**不能重复**，但可以有多个 NULL。

```sql
CREATE TABLE user (
    id       BIGINT PRIMARY KEY,
    username VARCHAR(50) UNIQUE,       -- 列级约束
    email    VARCHAR(100),
    phone    VARCHAR(20)
);

-- 表级约束（多个列组合唯一）
CREATE TABLE user (
    id BIGINT PRIMARY KEY,
    email VARCHAR(100),
    phone VARCHAR(20),
    UNIQUE (email),                    -- 单列唯一
    UNIQUE (phone),                    -- 单列唯一
    UNIQUE (email, phone)              -- 组合唯一：email+phone 组合不能重复
);
```

### 唯一约束与 NULL

```sql
-- 唯一约束允许多个 NULL
INSERT INTO user (email) VALUES (NULL);  -- OK
INSERT INTO user (email) VALUES (NULL);  -- OK（第二个 NULL 也被允许）
INSERT INTO user (email) VALUES ('a@b.com');
INSERT INTO user (email) VALUES ('a@b.com');  -- ERROR: Duplicate entry
```

### 查看唯一约束名称

```sql
SHOW INDEX FROM user;
```

## PRIMARY KEY（主键约束）

主键 = 非空 + 唯一。**每张表必须有且只有一个主键**。

```sql
CREATE TABLE student (
    id   BIGINT PRIMARY KEY,  -- 主键约束
    name VARCHAR(50)
);

-- 表级写法（多列主键，即复合主键）
CREATE TABLE score (
    student_id BIGINT,
    course_id  INT,
    score      DECIMAL(5,2),
    PRIMARY KEY (student_id, course_id)  -- 复合主键：两个字段组合唯一
);
```

### 自然主键 vs 代理主键

| 类型 | 说明 | 例子 |
|------|------|------|
| 自然主键 | 有业务含义的主键 | 学号、身份证号 |
| 代理主键 | 无业务含义的主键 | `BIGINT AUTO_INCREMENT` |

> **推荐**：大多数场景用代理主键。业务数据可能变化，用有意义的字段做主键一旦变化，所有外键都要跟着改。

## AUTO_INCREMENT（自增）

自增列必须是主键或唯一索引，且类型为整数类型。

```sql
CREATE TABLE student (
    id   BIGINT PRIMARY KEY AUTO_INCREMENT,  -- 从 1 开始，每次 +1
    name VARCHAR(50)
);

INSERT INTO student (name) VALUES ('张三');  -- id = 1
INSERT INTO student (name) VALUES ('李四');  -- id = 2
INSERT INTO student (name) VALUES ('王五');  -- id = 3
```

### 自增配置

```sql
-- 查看当前自增值
SHOW CREATE TABLE student;
-- AUTO_INCREMENT = 4

-- 手动设置下一个自增值
ALTER TABLE student AUTO_INCREMENT = 1000;

-- 设置自增步长（全局）
SET @@auto_increment_increment = 10;  -- 每次 +10

-- 设置自增偏移量
SET @@auto_increment_offset = 5;      -- 从 5 开始
-- 配合步长 10：生成序列 5, 15, 25, 35...
```

### LAST_INSERT_ID()

```sql
INSERT INTO student (name) VALUES ('张三');
SELECT LAST_INSERT_ID();  -- 返回刚才插入行的自增 ID
```

### TRUNCATE 会重置 AUTO_INCREMENT

```sql
TRUNCATE TABLE student;  -- AUTO_INCREMENT 重置为 1
DELETE FROM student;      -- AUTO_INCREMENT 不变
```

## CHECK 约束（MySQL 8.0.16+）

CHECK 约束限制列值必须满足条件：

```sql
CREATE TABLE student (
    id     BIGINT PRIMARY KEY AUTO_INCREMENT,
    name   VARCHAR(50) NOT NULL,
    age    INT,
    score  DECIMAL(5,2),
    CHECK (age >= 0 AND age <= 150),           -- 列级 CHECK
    CHECK (score >= 0 AND score <= 100)        -- 列级 CHECK
);

-- 或表级 CHECK
CREATE TABLE student (
    id    BIGINT PRIMARY KEY AUTO_INCREMENT,
    name  VARCHAR(50) NOT NULL,
    age   INT,
    score DECIMAL(5,2),
    CONSTRAINT chk_age   CHECK (age >= 0 AND age <= 150),
    CONSTRAINT chk_score CHECK (score >= 0 AND score <= 100)
);
```

> 注意：MySQL 8.0.16 之前的 MySQL 会忽略 CHECK 约束（不报错但也不执行）。

## DEFAULT（默认值约束）

```sql
CREATE TABLE student (
    id         BIGINT PRIMARY KEY AUTO_INCREMENT,
    name       VARCHAR(50) NOT NULL,
    age        INT DEFAULT 18,           -- 默认 18 岁
    score      DECIMAL(5,2) DEFAULT 0,  -- 默认 0 分
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_deleted TINYINT(1) DEFAULT 0     -- 默认未删除
);
```

## 约束综合示例

```sql
CREATE TABLE user (
    id         BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '用户ID',
    username   VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
    email      VARCHAR(100) NOT NULL UNIQUE COMMENT '邮箱',
    phone      VARCHAR(20) COMMENT '手机号',
    age        INT CHECK (age >= 0 AND age <= 150) COMMENT '年龄',
    is_deleted TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否删除 0-否 1-是',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    -- 组合唯一：同一个人手机号不能重复（手机号可为空）
    UNIQUE KEY uk_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';
```

## 下一步

约束基础学完了，接下来看 [外键 / 检查 / 默认值约束](/database/mysql/object/constraint/foreign-check)。

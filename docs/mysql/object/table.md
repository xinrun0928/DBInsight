# 表（创建 / 修改 / 重命名 / 删除 / 清空）

## 创建表

### 基本语法

```sql
CREATE TABLE student (
    id INT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    age INT,
    score DECIMAL(5,2)
);
```

### 完整示例

```sql
CREATE TABLE student (
    id           BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '学号',
    name         VARCHAR(50) NOT NULL COMMENT '姓名',
    age          INT COMMENT '年龄',
    gender       CHAR(1) COMMENT '性别 M/F',
    class_id     INT COMMENT '班级编号',
    score        DECIMAL(5,2) COMMENT '成绩',
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学生表';
```

### 通过查询结果创建表

```sql
-- 把查询结果直接变成一张新表
CREATE TABLE top_students AS
SELECT * FROM student WHERE score >= 90;
```

> 用这种方式创建的表没有主键和索引，需要手动补充。

### IF NOT EXISTS

```sql
CREATE TABLE IF NOT EXISTS student (
    ...
);
```

## 查看表结构

```sql
-- 查看表结构（描述）
DESC student;
DESCRIBE student;

-- 查看建表语句
SHOW CREATE TABLE student;

-- 查看所有列信息
SHOW COLUMNS FROM student;
SHOW COLUMNS FROM student LIKE '%name%';
```

## 修改表结构（ALTER TABLE）

### 添加列

```sql
-- 在末尾添加列
ALTER TABLE student ADD COLUMN email VARCHAR(100);

-- 在指定位置添加列
ALTER TABLE student ADD COLUMN phone VARCHAR(20) AFTER name;

-- 在最前面添加列
ALTER TABLE student ADD COLUMN new_id INT FIRST;
```

### 修改列

```sql
-- 修改列定义（可以改类型、大小、默认值）
ALTER TABLE student MODIFY COLUMN score DECIMAL(6,2);

-- 修改列名和定义
ALTER TABLE student CHANGE COLUMN score score_new DECIMAL(6,2);
```

### 删除列

```sql
ALTER TABLE student DROP COLUMN email;
```

> 删除列前请确认没有外键引用该列。

### 添加约束

```sql
-- 添加主键
ALTER TABLE student ADD PRIMARY KEY (id);

-- 添加唯一约束
ALTER TABLE student ADD UNIQUE (name);

-- 添加外键
ALTER TABLE student ADD FOREIGN KEY (class_id) REFERENCES class(id);
```

### 添加索引

```sql
ALTER TABLE student ADD INDEX idx_name (name);
ALTER TABLE student ADD FULLTEXT INDEX idx_intro (intro);
```

## 重命名表

```sql
-- 方式一
RENAME TABLE student TO stu;

-- 方式二
ALTER TABLE student RENAME TO stu;

-- 批量重命名
RENAME TABLE student TO stu1, teacher TO tea1;
```

### 跨数据库重命名

```sql
RENAME TABLE school.student TO new_school.student;
```

## 删除表

```sql
DROP TABLE student;
```

**危险操作！** 删除后数据无法恢复。

```sql
-- IF EXISTS 防止报错
DROP TABLE IF EXISTS student;

-- 同时删除多个表
DROP TABLE student, teacher, class;
```

## 清空表

### TRUNCATE（DDL，快，推荐）

```sql
TRUNCATE TABLE student;
```

特点：
- **删除并重建表**，速度极快（不记录每行删除）
- **重置 AUTO_INCREMENT** 为初始值
- **不能回滚**（因为是 DDL，不是 DML）
- 不触发 DELETE 触发器

适用场景：快速清空测试数据、不需要保留事务日志。

### DELETE（可以回滚）

```sql
DELETE FROM student;
```

特点：
- **逐行删除**，记录每行操作
- **可加 WHERE** 条件删除部分数据
- **可回滚**（在事务中）
- **不重置 AUTO_INCREMENT**

适用场景：需要回滚、需要条件删除、需要触发器执行。

### 对比

| 特性 | TRUNCATE | DELETE |
|------|---------|--------|
| 类型 | DDL | DML |
| 速度 | 极快 | 慢 |
| WHERE 条件 | ❌ 不支持 | ✅ 支持 |
| 回滚 | ❌ 不可以 | ✅ 可以 |
| 重置自增 | ✅ 重置 | ❌ 不重置 |
| 触发器 | ❌ 不触发 | ✅ 触发 |
| 释放空间 | ✅ 释放 | ❌ 不立即释放 |

## 复制表结构

```sql
-- 只复制结构
CREATE TABLE student_copy LIKE student;

-- 复制结构和数据
CREATE TABLE student_copy AS SELECT * FROM student;

-- 只复制部分列
CREATE TABLE student_copy AS
SELECT name, score FROM student WHERE score >= 60;
```

## 临时表

临时表只在当前会话中可见，会话结束后自动删除：

```sql
-- 临时表：会话结束后自动消失
CREATE TEMPORARY TABLE temp_data (
    id INT,
    value VARCHAR(50)
);

-- 或基于查询创建
CREATE TEMPORARY TABLE temp_summary AS
SELECT class_id, AVG(score) AS avg_score
FROM student GROUP BY class_id;
```

## 表重命名注意事项

重命名表时，如果表有外键引用，需要注意：
- 外键约束名称必须唯一
- 视图引用不受影响
- 触发器引用不受影响

## 下一步

建表和管理学完了，接下来学习 [阿里命名规范 / MySQL8 DDL 原子化](/database/mysql/object/naming-rule)。

# 外键 / 检查 / 默认值约束

## 外键约束（FOREIGN KEY）

外键用于建立两张表之间的**引用完整性**——子表中的某个列，必须引用父表中已存在的值。

### 外键的基本概念

```sql
-- 父表（被引用）
CREATE TABLE class (
    id   INT PRIMARY KEY,
    name VARCHAR(50)
);

-- 子表（引用父表）
CREATE TABLE student (
    id       BIGINT PRIMARY KEY AUTO_INCREMENT,
    name     VARCHAR(50),
    class_id INT,
    FOREIGN KEY (class_id) REFERENCES class(id)  -- 外键约束
);
```

现在插入数据时：

```sql
-- ✅ 可以插入：class_id 在 class 表中存在
INSERT INTO student (name, class_id) VALUES ('张三', 1);

-- ❌ 不可以插入：class_id=99 在 class 表中不存在
INSERT INTO student (name, class_id) VALUES ('李四', 99);
-- ERROR 1452: Cannot add or update a child row: a foreign key constraint fails
```

### 外键的级联操作

父表记录被删除/更新时，子表相关记录怎么处理？

```sql
CREATE TABLE student (
    id       BIGINT PRIMARY KEY AUTO_INCREMENT,
    name     VARCHAR(50),
    class_id INT,
    FOREIGN KEY (class_id) REFERENCES class(id)
        ON DELETE CASCADE   -- 父表删除，子表对应行自动删除
        ON UPDATE CASCADE   -- 父表更新，子表对应行自动更新
);
```

| 选项 | 说明 |
|------|------|
| `ON DELETE CASCADE` | 父表删除，子表对应行级联删除 |
| `ON DELETE SET NULL` | 父表删除，子表对应行设为 NULL（需要列允许 NULL） |
| `ON DELETE SET DEFAULT` | 父表删除，子表对应行设为默认值 |
| `ON DELETE RESTRICT` | 阻止删除（默认） |
| `ON DELETE NO ACTION` | 同 RESTRICT |
| `ON UPDATE CASCADE` | 父表更新，子表对应行自动更新 |
| `ON UPDATE SET NULL` | 父表更新，子表对应行设为 NULL |
| `ON UPDATE RESTRICT` | 阻止更新（默认） |

### 级联操作的危险

```sql
-- 一个极端例子
FOREIGN KEY (parent_id) REFERENCES parent(id)
ON DELETE CASCADE
ON UPDATE CASCADE

-- 如果 parent 表有 3 层嵌套的级联删除/更新
-- 删除顶层父记录 → 一次性删掉整棵树
-- 如果不小心删错了……完蛋
```

### 外键的使用场景与争议

| 场景 | 建议 |
|------|------|
| 小型项目、表少 | ✅ 可以用外键，让数据库帮你维护一致性 |
| 高并发系统 | ❌ 不推荐外键，锁竞争严重，影响性能 |
| 微服务架构 | ❌ 通常不用外键，每个服务只管理自己的表 |
| 核心业务数据 | ✅ 用外键（如订单必须关联已存在的用户） |

> **阿里规范**（高并发互联网公司）：禁止使用外键。数据一致性在应用层保证。

### 命名外键约束

```sql
ALTER TABLE student
ADD CONSTRAINT fk_student_class
FOREIGN KEY (class_id) REFERENCES class(id)
ON DELETE SET NULL ON UPDATE CASCADE;
```

## CHECK 约束

CHECK 约束限制列值必须满足条件（MySQL 8.0.16+）。

```sql
CREATE TABLE student (
    id    BIGINT PRIMARY KEY AUTO_INCREMENT,
    name  VARCHAR(50) NOT NULL,
    age   INT,
    score DECIMAL(5,2),
    -- 年龄必须在 0~150 之间
    CONSTRAINT chk_age   CHECK (age >= 0 AND age <= 150),
    -- 成绩必须在 0~100 之间
    CONSTRAINT chk_score CHECK (score >= 0 AND score <= 100)
);

INSERT INTO student (name, age, score) VALUES ('张三', -5, 85);   -- ERROR
INSERT INTO student (name, age, score) VALUES ('张三', 20, 105);  -- ERROR
INSERT INTO student (name, age, score) VALUES ('张三', 20, 85);   -- OK
```

### MySQL 8.0 之前的 CHECK

MySQL 8.0.16 之前 CHECK 语法存在但**被忽略**。绕过方式：用触发器模拟：

```sql
-- 在插入/更新前检查
CREATE TRIGGER check_age_insert
BEFORE INSERT ON student
FOR EACH ROW
BEGIN
    IF NEW.age < 0 OR NEW.age > 150 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Age must be between 0 and 150';
    END IF;
END;
```

## DEFAULT 约束（默认值）

```sql
CREATE TABLE student (
    id         BIGINT PRIMARY KEY AUTO_INCREMENT,
    name       VARCHAR(50) NOT NULL,
    age        INT DEFAULT 18,           -- 默认 18 岁
    score      DECIMAL(5,2) DEFAULT 0,  -- 默认 0 分
    is_deleted TINYINT(1) DEFAULT 0,    -- 默认未删除
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### DEFAULT 支持的默认值类型

| 类型 | 示例 |
|------|------|
| 数值 | `DEFAULT 0` |
| 字符串 | `DEFAULT 'unknown'` |
| 表达式 | `DEFAULT (NOW())` — MySQL 8.0+ 支持表达式默认值 |
| 函数 | `DEFAULT CURRENT_TIMESTAMP` |

### 表达式默认值（MySQL 8.0+）

```sql
CREATE TABLE order_info (
    id            BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_no      VARCHAR(32) NOT NULL,
    total_amount  DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at    DATETIME NOT NULL DEFAULT (NOW()),  -- 表达式默认值
    updated_at    DATETIME NOT NULL DEFAULT (NOW()) ON UPDATE (NOW())
);
```

## 约束的管理

### 查看约束

```sql
SHOW CREATE TABLE student;
```

### 删除约束

```sql
-- 删除外键约束
ALTER TABLE student DROP FOREIGN KEY fk_student_class;

-- 删除唯一约束（需要知道约束名）
ALTER TABLE user DROP INDEX uk_email;

-- 删除主键约束
ALTER TABLE student DROP PRIMARY KEY;
```

## 约束综合设计示例

```sql
CREATE TABLE `order` (
    id            BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_no      VARCHAR(32) NOT NULL UNIQUE COMMENT '订单号',
    user_id       BIGINT NOT NULL COMMENT '用户ID',
    total_amount  DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '订单总额',
    status        TINYINT NOT NULL DEFAULT 1 COMMENT '状态 1-待支付 2-已支付 3-已取消',
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_status CHECK (status IN (1, 2, 3)),
    CONSTRAINT chk_amount CHECK (total_amount >= 0)
);

CREATE TABLE order_item (
    id         BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id   BIGINT NOT NULL COMMENT '订单ID',
    product_id BIGINT NOT NULL COMMENT '商品ID',
    quantity   INT NOT NULL DEFAULT 1 COMMENT '数量',
    price      DECIMAL(10,2) NOT NULL COMMENT '单价',

    CONSTRAINT fk_order_item_order   FOREIGN KEY (order_id)   REFERENCES `order`(id) ON DELETE CASCADE,
    CONSTRAINT fk_order_item_product FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE RESTRICT,
    CONSTRAINT chk_quantity CHECK (quantity > 0),
    CONSTRAINT chk_price    CHECK (price >= 0)
);
```

## 下一步

约束学完了，接下来学习 [视图（创建/查看/更新/删除）](/database/mysql/object/view)。

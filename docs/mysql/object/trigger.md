# 触发器（创建 / 查看 / 删除）

## 什么是触发器

**触发器（Trigger）** 是在表发生 **INSERT / UPDATE / DELETE** 操作时，**自动执行**的一段 SQL 代码。

```sql
-- 触发器：当往 student 表插入数据时，自动记录日志
CREATE TRIGGER trg_student_insert
AFTER INSERT ON student
FOR EACH ROW
BEGIN
    INSERT INTO student_log (action, student_id, created_at)
    VALUES ('INSERT', NEW.id, NOW());
END;
```

## 创建触发器

### 基本语法

```sql
CREATE TRIGGER trigger_name
{BEFORE | AFTER} {INSERT | UPDATE | DELETE}
ON table_name
FOR EACH ROW
BEGIN
    -- 触发器体
END;
```

### INSERT 触发器

```sql
-- INSERT 触发器中可以访问 NEW（即将插入的新行）
CREATE TRIGGER trg_after_insert
AFTER INSERT ON student
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (msg) VALUES (
        CONCAT('New student added: ', NEW.name)
    );
END;
```

### UPDATE 触发器

```sql
-- UPDATE 触发器中可以访问 OLD（修改前的行）和 NEW（修改后的行）
CREATE TRIGGER trg_before_update_score
BEFORE UPDATE ON student
FOR EACH ROW
BEGIN
    -- 记录分数变更历史
    INSERT INTO score_history (student_id, old_score, new_score, changed_at)
    VALUES (OLD.id, OLD.score, NEW.score, NOW());

    -- 如果分数降低超过 20%，记录警告
    IF OLD.score - NEW.score > 20 THEN
        INSERT INTO alert_log (student_id, message)
        VALUES (OLD.id, CONCAT('Score dropped significantly: ', OLD.score, ' -> ', NEW.score));
    END IF;
END;
```

### DELETE 触发器

```sql
-- DELETE 触发器中可以访问 OLD（被删除的行）
CREATE TRIGGER trg_before_delete
BEFORE DELETE ON student
FOR EACH ROW
BEGIN
    -- 软删除替代硬删除
    -- 但 DELETE 触发器不能直接操作同表，需要在应用层处理
    INSERT INTO student_backup
    SELECT OLD.*, NOW() AS deleted_at;
END;
```

## 触发器中 NEW 和 OLD 的可访问性

| 操作 | NEW.列 | OLD.列 |
|------|--------|--------|
| INSERT | ✅ 可访问 | ❌ 不可访问 |
| UPDATE | ✅ 可访问（修改后的值） | ✅ 可访问（修改前的值） |
| DELETE | ❌ 不可访问 | ✅ 可访问 |

## 查看触发器

```sql
-- 查看所有触发器
SHOW TRIGGERS;

-- 查看特定表的触发器
SHOW TRIGGERS FROM school_db LIKE 'student';

-- 查看触发器定义
SHOW CREATE TRIGGER trg_after_insert;

-- 从 information_schema 查询
SELECT * FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = 'school_db';
```

## 删除触发器

```sql
DROP TRIGGER IF EXISTS trg_after_insert;
```

## 修改触发器

MySQL 不支持直接修改触发器，只能先删除再重建。

## 触发器的应用场景

### 场景一：数据校验

```sql
-- 插入/更新前检查分数范围
CREATE TRIGGER check_score_insert
BEFORE INSERT ON student
FOR EACH ROW
BEGIN
    IF NEW.score < 0 OR NEW.score > 100 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Score must be between 0 and 100';
    END IF;
END;
```

### 场景二：数据同步

```sql
-- 订单创建后，异步通知库存服务
CREATE TRIGGER trg_order_created
AFTER INSERT ON `order`
FOR EACH ROW
BEGIN
    -- 在实际生产中，这里可能通过消息队列发送通知
    INSERT INTO notification_queue (order_id, event_type, payload)
    VALUES (NEW.id, 'ORDER_CREATED', NEW.order_no);
END;
```

### 场景三：自动计算

```sql
-- 订单明细插入后，自动更新订单总额
CREATE TRIGGER trg_order_item_insert
AFTER INSERT ON order_item
FOR EACH ROW
BEGIN
    UPDATE `order`
    SET total_amount = (
        SELECT SUM(price * quantity)
        FROM order_item
        WHERE order_id = NEW.order_id
    )
    WHERE id = NEW.order_id;
END;
```

## 触发器的限制

| 限制 | 说明 |
|------|------|
| 不能触发同一张表的 DML | `CREATE TRIGGER ... ON t1 AFTER INSERT ON t1` 不允许 |
| 触发器中不能有 DDL | 不能写 CREATE、DROP、ALTER |
| 触发器中不能有事务控制 | 不能写 COMMIT、ROLLBACK |
| OLD/NEW 行数据有限制 | 只有当前行，不能访问其他行 |
| 性能影响 | 每行 DML 都会额外执行触发器代码 |

## 触发器 vs 存储过程

| 方面 | 触发器 | 存储过程 |
|------|--------|---------|
| 调用方式 | 自动（事件触发） | 手动 CALL |
| 参数 | 无 | 可有 IN/OUT |
| 事务控制 | 不可用 | 可用 |
| 场景 | 数据校验、自动处理 | 复杂业务逻辑 |

## 触发器的潜在问题

### 性能陷阱

```sql
-- 错误示例：触发器中查同表，导致 O(n²) 复杂度
CREATE TRIGGER trg_update
AFTER UPDATE ON t1
FOR EACH ROW
BEGIN
    -- 这条 UPDATE 会触发自身触发器，可能无限递归
    UPDATE t1 SET updated_at = NOW() WHERE id = OLD.id;
END;
```

### 无限递归

MySQL 默认不开启 `recursive trigger`。但如果表有自引用触发器，需要注意。

### 维护困难

触发器的逻辑分散在多个地方，不像应用代码那样容易追踪。**阿里规范禁止使用触发器**。

## 下一步

数据库对象管理部分全部完成。接下来进入 [MySQL 高级特性（基础）](/database/mysql/advanced/charset)——字符集、SQL 模式、用户权限、逻辑架构和存储引擎。

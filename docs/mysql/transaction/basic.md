# 事务基础

事务是数据库最核心的概念之一，也是最容易出错的知识点。

一个经典的场景：用户转账，A 账户扣了 100 元，但系统崩溃了，B 账户没收到。钱去哪了？

没有事务，这个问题无解。事务就是用来解决这类问题的。

---

## 事务是什么

**事务（Transaction）** 是数据库中一组原子性的 SQL 操作，要么全部成功，要么全部失败。

```
转账场景（两条 UPDATE）：
BEGIN;
  UPDATE accounts SET balance = balance - 100 WHERE id = 'A';
  UPDATE accounts SET balance = balance + 100 WHERE id = 'B';
COMMIT;

如果第二条失败 → ROLLBACK → A 的扣款也回滚
如果系统崩溃 → ROLLBACK → 两条都不执行
```

---

## 事务的 ACID 特性

| 特性 | 说明 | MySQL 实现 |
|-----|------|-----------|
| **A**tomicity（原子性） | 事务是最小执行单元，不可分割 | Undo Log |
| **C**onsistency（一致性） | 事务执行前后，数据库状态一致 | 依赖 A + I + D |
| **I**solation（隔离性） | 并发事务相互隔离，不互相干扰 | 锁 + MVCC |
| **D**urability（持久性） | 事务提交后，数据永久保存 | Redo Log + 刷盘 |

### 原子性（Atomicity）

原子性确保事务中的所有操作要么全部成功，要么全部失败。

```
BEGIN;
  INSERT INTO orders (...) VALUES (...);  -- 成功
  INSERT INTO order_items (...) VALUES (...);  -- 失败（外键约束）
COMMIT;  -- 不会执行，整个事务回滚
```

MySQL 通过 **Undo Log** 实现原子性：事务执行过程中，记录每一步的"反操作"，失败时回滚。

### 一致性（Consistency）

一致性是目标，原子性、隔离性、持久性是手段。

```
账户表：id=A, balance=1000
事务：转出 100

执行前：A=1000 ✓（一致）
执行中：A=900（不一致，但不可见）
执行后：A=900 ✓（一致）
```

只要满足原子性、隔离性、持久性，数据库就一定能达到一致状态。

### 隔离性（Isolation）

隔离性控制并发事务之间的可见性。不同的隔离级别，决定了脏读、不可重复读、幻读的发生程度。

| 隔离级别 | 脏读 | 不可重复读 | 幻读 |
|---------|-----|-----------|-----|
| READ UNCOMMITTED | 可能 | 可能 | 可能 |
| READ COMMITTED | 不可能 | 可能 | 可能 |
| REPEATABLE READ | 不可能 | 不可能 | 可能（InnoDB 不可能） |
| SERIALIZABLE | 不可能 | 不可能 | 不可能 |

### 持久性（Durability）

事务提交后，结果必须永久保存，即使系统崩溃也不能丢失。

MySQL 通过 **Redo Log** + **刷盘策略** 实现持久性。

```
事务提交 → 写入 Redo Log（顺序写入，快）
        → 后续由后台线程刷到磁盘（慢，但不影响事务提交速度）
        → 即使崩溃，恢复时从 Redo Log 恢复
```

---

## 事务的使用方式

### 显式事务

```sql
-- 开启事务
START TRANSACTION;
-- 或者
BEGIN;

-- 执行操作
UPDATE accounts SET balance = balance - 100 WHERE id = 'A';
UPDATE accounts SET balance = balance + 100 WHERE id = 'B';

-- 提交
COMMIT;
-- 或回滚
-- ROLLBACK;
```

### 隐式提交

以下语句会**自动提交**当前事务（即使前面有 BEGIN）：

```sql
BEGIN;
INSERT INTO log (...) VALUES (...);  -- 自动提交！
-- 此时 log 已经插入了，但之前的操作如果还没 COMMIT 就丢失了
```

会触发隐式提交的语句：

| 语句类型 | 示例 |
|---------|-----|
| DDL | CREATE, ALTER, DROP, TRUNCATE |
| 管理语句 | ANALYZE, CHECK, OPTIMIZE, REPAIR |
| 复制语句 | LOAD DATA, MASTER, SLAVE |
| 控制语句 | GRANT, REVOKE |
| 事务控制 | SET AUTOCOMMIT=1 |

> **避免踩坑**：不要在事务中混用 DDL 和 DML。先 BEGIN，再 DML，最后 COMMIT，不要在中间执行 DDL。

### 自动提交

MySQL 默认开启自动提交（AUTOCOMMIT=1）：

```sql
SHOW VARIABLES LIKE 'autocommit';
-- ON：每条语句自动提交，等价于事务
-- OFF：需要手动 BEGIN / COMMIT

-- 临时关闭自动提交
SET autocommit = 0;
UPDATE accounts SET balance = 900 WHERE id = 'A';
-- 此时没有 COMMIT，其他事务看不到这个修改
COMMIT;  -- 显式提交
```

> **生产建议**：OLTP 系统保持 AUTOCOMMIT=ON，用短事务（每条语句一个事务）。OLAP 批量操作关闭自动提交，显式管理大事务。

### 保存点（Savepoint）

```sql
BEGIN;
  INSERT INTO orders (...) VALUES (...);   -- 订单1
  SAVEPOINT s1;
  INSERT INTO orders (...) VALUES (...);   -- 订单2
  SAVEPOINT s2;
  INSERT INTO orders (...) VALUES (...);   -- 订单3
  ROLLBACK TO s1;  -- 回滚到 s1，订单2和订单3撤销，订单1保留
COMMIT;
```

---

## 事务的隔离级别

MySQL 支持 4 种隔离级别：

```sql
-- 查看当前隔离级别
SELECT @@transaction_isolation;

-- 设置隔离级别（会话级）
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- 设置隔离级别（全局级）
SET GLOBAL TRANSACTION ISOLATION LEVEL SERIALIZABLE;
```

### READ UNCOMMITTED（读未提交）

```sql
-- 事务A：开启 READ UNCOMMITTED
SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
BEGIN;
UPDATE accounts SET balance = 900 WHERE id = 'A';  -- 未提交

-- 事务B：读到了事务A未提交的修改
SELECT balance FROM accounts WHERE id = 'A';
-- 结果：900（脏读）
```

**特点**：可以看到其他事务未提交的修改。性能最高，隔离性最差，实际很少使用。

### READ COMMITTED（读已提交）

```sql
-- 事务A：
BEGIN;
UPDATE accounts SET balance = 900 WHERE id = 'A';
-- 不提交

-- 事务B：
SELECT balance FROM accounts WHERE id = 'A';
-- 结果：1000（读不到未提交的）

COMMIT;  -- 事务A提交

SELECT balance FROM accounts WHERE id = 'A';
-- 结果：900（提交后才能看到）
```

**特点**：只能看到已提交的修改。解决了脏读问题，但不可重复读仍可能发生。

### REPEATABLE READ（可重复读，默认）

```sql
-- 事务B：
BEGIN;
SELECT balance FROM accounts WHERE id = 'A';
-- 结果：1000

-- 事务A：
BEGIN;
UPDATE accounts SET balance = 900 WHERE id = 'A';
COMMIT;

-- 事务B：
SELECT balance FROM accounts WHERE id = 'A';
-- 结果：1000（事务B开启时的一致性快照）
-- 同一个事务中多次读取，结果一致
```

**特点**：MySQL InnoDB 的默认隔离级别。通过 MVCC（多版本并发控制）实现，事务开始时创建一个数据快照，整个事务期间都看到这个快照。

### SERIALIZABLE（串行化）

```sql
-- 事务B：
BEGIN;
SELECT balance FROM accounts WHERE id = 'A';
-- 结果：1000

-- 事务A：
BEGIN;
UPDATE accounts SET balance = 900 WHERE id = 'A';
-- 事务A 阻塞！（被事务B 的共享锁阻塞）

COMMIT;  -- 事务B 提交后，事务A 才能继续
```

**特点**：完全串行执行，性能最差，但隔离性最强。所有读操作都会加共享锁。

---

## 事务的陷阱

### 陷阱一：长事务

```sql
-- ❌ 长事务：占用大量锁资源
BEGIN;
-- 大量查询
SELECT * FROM orders;  -- 可能锁住数据
-- 思考了几分钟...
UPDATE orders SET status = 'cancelled' WHERE ...;
COMMIT;  -- 几分钟的锁，几千个请求在等
```

**解决方案**：

- 拆分长事务为短事务
- 用乐观锁替代悲观锁
- 监控长事务并告警

```sql
-- 查看运行中的长事务
SELECT 
    trx_mysql_thread_id,
    trx_started,
    TIMESTAMPDIFF(SECOND, trx_started, NOW()) AS running_seconds,
    trx_query
FROM information_schema.INNODB_TRX
WHERE trx_state = 'RUNNING'
ORDER BY trx_started;
```

### 陷阱二：忘记提交/回滚

```sql
-- ❌ Python/Java 代码中
conn.begin()     # 开启事务
# ... 处理逻辑 ...
# 如果中途抛异常，没有 rollback
# 连接关闭时自动 rollback（但连接可能被复用）
# 建议：
try:
    conn.begin()
    # ... 
    conn.commit()
except:
    conn.rollback()
    raise
```

### 陷阱三：大事务

大事务意味着长时间锁定数据，风险极高。

**判断标准**：

| 事务大小 | 风险 |
|---------|-----|
| < 1000 行 | 低风险 |
| 1000~10000 行 | 中风险 |
| 10 万行以上 | 高风险，必须拆分 |

**优化方案**：

```sql
-- ❌ 大批量更新（一次性锁住所有行）
UPDATE orders SET status = 'completed' WHERE created_at < '2023-01-01';
-- 30 万行被锁，可能导致大量超时

-- ✅ 分批处理（每批 1000 行）
DELIMITER $$
CREATE PROCEDURE batch_update_orders()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_min_id BIGINT;
    DECLARE v_max_id BIGINT;
    
    SELECT MIN(id), MAX(id) INTO v_min_id, v_max_id 
    FROM orders WHERE created_at < '2023-01-01';
    
    WHILE v_min_id <= v_max_id DO
        UPDATE orders 
        SET status = 'completed' 
        WHERE id BETWEEN v_min_id AND v_min_id + 999
          AND created_at < '2023-01-01';
        
        COMMIT;  -- 每批提交，释放锁
        
        SET v_min_id = v_min_id + 1000;
    END WHILE;
END$$
DELIMITER ;
```

---

## 小结

事务是数据库一致性的基石：

| 特性 | 保障机制 | 失效后果 |
|-----|---------|---------|
| 原子性 | Undo Log | 部分成功部分失败 |
| 隔离性 | 锁 + MVCC | 并发数据混乱 |
| 持久性 | Redo Log + 刷盘 | 崩溃后数据丢失 |
| 一致性 | 以上三者共同保证 | 数据逻辑错误 |

**实际开发建议**：

- OLTP 系统保持 REPEATABLE READ（InnoDB 默认）
- 事务尽量短（毫秒级，不要超过 1 秒）
- 不要在事务中执行网络 I/O 或大量计算
- 监控长事务，发现立即处理

---

## 下一步

事务的隔离级别之间有什么区别？脏读、不可重复读、幻读是怎么发生的？

从 [隔离级别与并发问题](/database/mysql/transaction/isolation) 继续。

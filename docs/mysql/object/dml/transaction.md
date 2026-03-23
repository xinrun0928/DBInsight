# 事务控制（COMMIT / ROLLBACK）

## 什么是事务

事务是**一组操作**，要么全部成功，要么全部失败，不存在中间状态。

一个经典的转账场景：

```sql
-- 转账 1000 元：张三 -1000，李四 +1000
-- 如果只执行了第一步，李四没收到钱，银行要赔钱
-- 如果只执行了第二步，张三账户凭空多了钱
-- 必须保证：两步同时成功，或同时失败

START TRANSACTION;
UPDATE account SET balance = balance - 1000 WHERE id = 1;  -- 张三扣款
UPDATE account SET balance = balance + 1000 WHERE id = 2;  -- 李四收款
COMMIT;  -- 两步都成功，提交事务
```

如果中途出错：

```sql
START TRANSACTION;
UPDATE account SET balance = balance - 1000 WHERE id = 1;
UPDATE account SET balance = balance + 1000 WHERE id = 2;
-- 突然网络断了，或服务器崩了，或余额不足报错
ROLLBACK;  -- 撤销所有操作，张三的余额不变
```

## 事务的四大特性（ACID）

| 特性 | 说明 |
|------|------|
| **Atomicity（原子性）** | 事务是最小执行单元，不可分割。要么全做，要么全不做。 |
| **Consistency（一致性）** | 事务执行前后，数据库状态必须保持一致（如转账前后余额总和不变）。 |
| **Isolation（隔离性）** | 并发执行的事务互相隔离，互不干扰。 |
| **Durability（持久性）** | 事务提交后，结果永久保存，即使系统崩溃也不丢失。 |

> 原子性和持久性靠 redo log 保证，一致性靠数据库约束（外键、唯一索引等）保证，隔离性靠锁和 MVCC 保证。

## 事务的基本操作

```sql
-- 开启事务（方式一）
START TRANSACTION;

-- 开启事务（方式二，等价）
BEGIN;

-- 提交事务
COMMIT;

-- 回滚事务（撤销所有未提交的操作）
ROLLBACK;

-- 回滚到保存点
SAVEPOINT savepoint_name;
ROLLBACK TO SAVEPOINT savepoint_name;
```

## 隐式提交

以下语句会自动提交当前事务（开启一个新事务）：

- DDL 语句：`CREATE`, `ALTER`, `DROP`, `TRUNCATE`
- DCL 语句：`GRANT`, `REVOKE`
- 部分 DML：`LOCK TABLES`, `SET autocommit=1`

```sql
START TRANSACTION;
UPDATE account SET balance = balance - 1000 WHERE id = 1;
CREATE TABLE temp (...);  -- 这条语句会自动提交事务！
-- UPDATE 操作已被提交，无法 ROLLBACK 了！
```

## 保存点（SAVEPOINT）

在事务中设置中间回滚点：

```sql
START TRANSACTION;
UPDATE account SET balance = balance - 1000 WHERE id = 1;  -- 张三扣款
SAVEPOINT sp1;
UPDATE account SET balance = balance + 500 WHERE id = 2;   -- 李四先收一半
SAVEPOINT sp2;
UPDATE account SET balance = balance + 500 WHERE id = 3;   -- 王五收另一半
-- 此时发现李四不应该收到钱
ROLLBACK TO SAVEPOINT sp2;  -- 回滚到 sp2 之后的状态，李四的 +500 被撤销
-- 继续执行
UPDATE account SET balance = balance + 1000 WHERE id = 4;   -- 赵六收这 1000
COMMIT;
```

## 事务的隔离级别

并发事务会引发三个问题：

| 问题 | 说明 |
|------|------|
| **脏读** | 读取了其他事务未提交的数据 |
| **不可重复读** | 同一行数据，两次读取结果不一致（因为被其他事务修改/删除了） |
| **幻读** | 两次读取结果集行数不一致（因为其他事务插入了新行） |

MySQL 提供了 4 种隔离级别：

| 隔离级别 | 脏读 | 不可重复读 | 幻读 | 说明 |
|---------|------|-----------|------|------|
| `READ UNCOMMITTED` | ❌ 不允许 | ✅ 允许 | ✅ 允许 | 性能最高，安全性最差 |
| `READ COMMITTED` | ✅ 不允许 | ❌ 允许 | ✅ 允许 | Oracle 默认 |
| `REPEATABLE READ` | ✅ 不允许 | ✅ 不允许 | ✅ 允许 | MySQL **默认** |
| `SERIALIZABLE` | ✅ 不允许 | ✅ 不允许 | ✅ 不允许 | 性能最差，安全性最高 |

> MySQL InnoDB 在 `REPEATABLE READ` 下通过 MVCC + 间隙锁解决了幻读问题。

### 查看和设置隔离级别

```sql
-- 查看当前隔离级别
SELECT @@transaction_isolation;

-- 设置当前会话隔离级别
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- 设置全局隔离级别
SET GLOBAL TRANSACTION ISOLATION LEVEL READ COMMITTED;
```

## 自动提交（autocommit）

MySQL 默认开启自动提交模式：

```sql
-- 每条 DML 语句自动提交
SET autocommit = 1;

-- 关闭自动提交，手动控制事务
SET autocommit = 0;
```

> 建议：应用层显式用 `START TRANSACTION`，不要依赖 autocommit。

## 事务使用规范

```sql
-- ✅ 推荐：显式开启事务
START TRANSACTION;
-- 业务操作
COMMIT;  -- 或 ROLLBACK;

-- ❌ 不推荐：依赖 autocommit
SET autocommit = 0;
-- 业务操作
SET autocommit = 1;

-- ✅ 推荐：尽量减少事务时长（减少锁持有时间）
START TRANSACTION;
UPDATE ... WHERE id = 1;  -- 只锁一行，快速提交
COMMIT;

-- ❌ 不好：长事务（锁住大量数据）
START TRANSACTION;
UPDATE ... WHERE ...;  -- 更新大量行，锁范围大
COMMIT;
```

## 下一步

事务控制学完了，接下来学习 [约束分类 / 非空 / 唯一 / 主键 / AUTO_INCREMENT](/database/mysql/object/constraint/basic)。

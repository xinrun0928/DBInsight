# 权限管理 / 访问控制 / 角色使用

## 权限管理基础

### MySQL 的权限层级

| 层级 | 说明 |
|------|------|
| 全局 | `*.*`，管理整个 MySQL 实例 |
| 数据库 | `school_db.*`，管理某个数据库 |
| 表 | `school_db.student`，管理某张表 |
| 列 | `school_db.student(name)`，管理某列 |
| 存储过程/函数 | `school_db.*`，管理存储过程和函数 |

### 常用权限一览

| 权限 | 级别 | 说明 |
|------|------|------|
| `ALL` | 全局/DB/表 | 所有权限（不含 GRANT） |
| `SELECT` | 列/表 | 查询 |
| `INSERT` | 列/表 | 插入 |
| `UPDATE` | 列/表 | 更新 |
| `DELETE` | 表 | 删除 |
| `CREATE` | DB/表 | 创建 |
| `DROP` | DB/表 | 删除 |
| `ALTER` | 表 | 修改表结构 |
| `INDEX` | 表 | 创建/删除索引 |
| `REFERENCES` | DB/表 | 外键 |
| `CREATE VIEW` | DB | 创建视图 |
| `SHOW VIEW` | 表 | 查看视图定义 |
| `CREATE ROUTINE` | DB | 创建存储过程/函数 |
| `ALTER ROUTINE` | DB | 修改存储过程/函数 |
| `EXECUTE` | DB | 执行存储过程/函数 |
| `CREATE USER` | 全局 | 创建用户 |
| `RELOAD` | 全局 | FLUSH 操作 |
| `SHUTDOWN` | 全局 | 关闭服务器 |
| `SUPER` | 全局 | 高级操作 |
| `PROCESS` | 全局 | 查看进程 |

## 授予权限（GRANT）

### 基本语法

```sql
GRANT 权限 ON 范围 TO '用户'@'主机';
```

### 授予示例

```sql
-- 授予所有权限（生产环境不推荐）
GRANT ALL ON school_db.* TO 'dev'@'%';

-- 授予开发人员读写权限
GRANT SELECT, INSERT, UPDATE, DELETE ON school_db.* TO 'dev'@'%';

-- 授予只读权限
GRANT SELECT ON school_db.* TO 'readonly'@'%';

-- 授予管理员权限
GRANT ALL ON *.* TO 'admin'@'localhost' WITH GRANT OPTION;
-- WITH GRANT OPTION：允许该用户给别人授权

-- 授予特定表的特定列权限
GRANT SELECT(id, name), INSERT(id, name, score) ON school_db.student TO 'dev'@'%';

-- 授予存储过程执行权限
GRANT EXECUTE ON PROCEDURE school_db.* TO 'app'@'%';
```

### 常用权限配置

```sql
-- 应用读写账号（最小权限原则）
GRANT SELECT, INSERT, UPDATE, DELETE ON app_db.* TO 'app_user'@'%';

-- 报表只读账号
GRANT SELECT ON app_db.* TO 'report_user'@'%';

-- DBA 管理员账号
GRANT ALL PRIVILEGES ON *.* TO 'dba'@'localhost' WITH GRANT OPTION;

-- 备份账号
GRANT SELECT, LOCK TABLES, RELOAD, REPLICATION CLIENT ON *.* TO 'backup'@'%';
```

## 撤销权限（REVOKE）

```sql
-- 撤销 DELETE 权限
REVOKE DELETE ON school_db.* FROM 'dev'@'%';

-- 撤销所有权限
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'dev'@'%';

-- 撤销 WITH GRANT OPTION
REVOKE GRANT OPTION ON school_db.* FROM 'dev'@'%';
```

## 刷新权限

```sql
FLUSH PRIVILEGES;
```

> 大多数情况下，GRANT/REVOKE 会自动刷新权限。但某些情况下（如直接操作 mysql.user 表）需要手动刷新。

## 查看权限

```sql
-- 查看用户的所有权限
SHOW GRANTS FOR 'dev'@'%';

-- 查看当前用户的权限
SHOW GRANTS;
SHOW GRANTS FOR CURRENT_USER();
```

## 角色（MySQL 8.0）

角色是 MySQL 8.0 引入的功能，类似于「权限组」——先把权限打包成角色，再把角色分配给用户。

### 创建角色

```sql
CREATE ROLE 'app_readwrite';
CREATE ROLE 'app_readonly';
CREATE ROLE 'app_admin';
```

### 给角色分配权限

```sql
-- 给读写角色分配读写权限
GRANT SELECT, INSERT, UPDATE, DELETE ON app_db.* TO 'app_readwrite';

-- 给只读角色分配只读权限
GRANT SELECT ON app_db.* TO 'app_readonly';

-- 给管理员角色分配所有权限
GRANT ALL ON app_db.* TO 'app_admin';
```

### 给用户分配角色

```sql
-- 给开发者分配读写角色
GRANT 'app_readwrite' TO 'dev'@'%';

-- 给测试人员分配只读角色
GRANT 'app_readonly' TO 'tester'@'%';

-- 给组长分配管理员角色
GRANT 'app_admin' TO 'leader'@'%';
```

### 设置默认角色

用户登录后，需要激活角色才能使用权限：

```sql
-- 设置默认角色（登录时自动激活）
SET DEFAULT ROLE 'app_readwrite' FOR 'dev'@'%';

-- 或者在配置文件里设置
[mysqld]
mandatory_roles='app_readwrite'
```

### 查看和设置当前角色

```sql
-- 查看当前激活的角色
SELECT CURRENT_ROLE();

-- 手动激活角色（当前会话）
SET ROLE 'app_readwrite';
SET ROLE ALL;  -- 激活所有已分配的角色
```

### 删除角色

```sql
DROP ROLE 'app_readonly';
```

## 最小权限原则

生产环境遵循「最小权限原则」：

```sql
-- ❌ 应用共用 root 账号（危险）
GRANT ALL ON *.* TO 'root'@'%';  -- 绝对禁止

-- ✅ 为每个应用创建独立账号，只给需要的权限
GRANT SELECT, INSERT, UPDATE, DELETE ON order_db.* TO 'order_app'@'%';

-- ✅ 为不同功能创建不同账号
GRANT SELECT ON order_db.* TO 'order_query'@'%';    -- 查询服务
GRANT INSERT, UPDATE ON order_db.* TO 'order_write'@'%'; -- 写入服务
```

## 常见权限问题

### ERROR 1045: Access denied

```sql
-- 原因：用户名或密码错误
-- 排查：
SELECT user, host, authentication_string FROM mysql.user WHERE user = 'dev';
-- 检查密码是否正确
ALTER USER 'dev'@'%' IDENTIFIED BY '正确的密码';
```

### ERROR 1044: Access denied

```sql
-- 原因：用户没有被授权访问目标数据库
-- 解决：
GRANT SELECT ON target_db.* TO 'dev'@'%';
FLUSH PRIVILEGES;
```

### ERROR 1142: SELECT command denied

```sql
-- 原因：用户没有 SELECT 权限
-- 解决：
GRANT SELECT ON school_db.* TO 'dev'@'%';
FLUSH PRIVILEGES;
```

## 下一步

权限管理学完了，接下来看 [MySQL 逻辑架构 / SQL 执行流程](/database/mysql/advanced/architecture)——一条 SQL 发出去，MySQL 内部是怎么处理的。

# 用户（创建 / 修改 / 删除 / 密码管理）

## MySQL 用户的基本概念

MySQL 的用户由两部分组成：**用户名 + 主机来源**。

```
'root'@'localhost'     -- 只能从本机连接
'admin'@'192.168.1.%' -- 只能从指定网段连接
'app'@'%'              -- 允许任何主机连接
```

同一个用户名，不同主机来源，是完全独立的两个用户。

## 创建用户

### 基本语法

```sql
-- 创建用户（同时设置密码）
CREATE USER '用户名'@'主机' IDENTIFIED BY '密码';

-- 示例
CREATE USER 'dev'@'localhost' IDENTIFIED BY 'Dev@2024!';
CREATE USER 'dev'@'%' IDENTIFIED BY 'Dev@2024!';
```

### 创建时指定认证插件

```sql
-- MySQL 8.0 默认（强加密）
CREATE USER 'dev'@'%' IDENTIFIED BY '密码';

-- 旧版兼容插件
CREATE USER 'dev_old'@'%' IDENTIFIED WITH mysql_native_password BY '密码';

-- 密码为空（不推荐）
CREATE USER 'guest'@'%';
```

### 用户名和主机规则

```sql
-- '%'：允许任何主机
CREATE USER 'app'@'%' IDENTIFIED BY '密码';

-- '192.168.1.%'：指定网段
CREATE USER 'app'@'192.168.1.%' IDENTIFIED BY '密码';

-- '192.168.1.100'：指定 IP
CREATE USER 'app'@'192.168.1.100' IDENTIFIED BY '密码';

-- '%.example.com'：指定域名
CREATE USER 'app'@'%.example.com' IDENTIFIED BY '密码';
```

## 修改用户

### 修改密码

```sql
-- 修改自己的密码
ALTER USER 'dev'@'%' IDENTIFIED BY 'NewP@ssw0rd!';
SET PASSWORD = 'NewP@ssw0rd!';

-- 修改其他用户密码（需要权限）
ALTER USER 'dev'@'%' IDENTIFIED BY 'NewP@ssw0rd!';

-- MySQL 8.0 推荐方式（强制密码复杂度）
ALTER USER 'dev'@'%' IDENTIFIED BY 'NewP@ssw0rd!';
```

### 重命名用户

```sql
RENAME USER 'dev'@'%' TO 'developer'@'%';
```

### 锁定/解锁用户

```sql
-- 锁定用户（禁止登录）
ALTER USER 'dev'@'%' ACCOUNT LOCK;

-- 解锁用户
ALTER USER 'dev'@'%' ACCOUNT UNLOCK;
```

## 删除用户

```sql
DROP USER 'dev'@'%';
```

> **危险操作**。删除用户会同时撤销其所有权限。删除前请确认没有正在运行的连接。

## 查看用户信息

```sql
-- 查看所有用户
SELECT user, host, account_locked, plugin FROM mysql.user;

-- 查看用户权限
SHOW GRANTS FOR 'dev'@'%';

-- 查看用户密码过期状态
SELECT user, host, password_lifetime, account_status FROM mysql.user;
```

## 密码管理

### 设置密码过期策略

```sql
-- 设置密码 90 天过期
ALTER USER 'dev'@'%' PASSWORD EXPIRE INTERVAL 90 DAY;

-- 设置密码永不过期
ALTER USER 'dev'@'%' PASSWORD EXPIRE NEVER;

-- 全局设置（所有新用户的密码策略）
SET GLOBAL default_password_lifetime = 90;
```

### MySQL 8.0 的密码验证组件

MySQL 8.0 支持 `VALIDATE_PASSWORD` 组件强制密码复杂度：

```sql
-- 安装验证组件
INSTALL COMPONENT 'file://component_validate_password';

-- 查看密码策略
SHOW VARIABLES LIKE 'validate_password%';
```

| 变量 | 说明 |
|------|------|
| `validate_password.length` | 最小长度（默认 8） |
| `validate_password.policy` | 策略（LOW/MEDIUM/STRONG） |
| `validate_password.number_count` | 最少数字 |
| `validate_password.special_char_count` | 最少特殊字符 |

## 下一步

用户创建好了，接下来学习 [权限管理 / 访问控制 / 角色使用](/database/mysql/advanced/permission)——怎么给用户分配最小权限。
